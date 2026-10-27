import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcCommission, calcPayment, distributeDiscount, resolveCommissionRule, round2, validatePayments } from "@/lib/finance";
import { addDays, today } from "@/lib/time";

const item = z.object({
  kind: z.enum(["service", "product"]),
  service_id: z.string().uuid().nullable().optional(),
  product_id: z.string().uuid().nullable().optional(),
  professional_ids: z.array(z.string().uuid()).max(4).default([]),
  quantity: z.number().positive().max(1000),
  unit_price: z.number().min(0).optional(), // services: price from the appointment; products always from DB
});

export const finalizeSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        companyId: z.string().uuid(),
        appointmentId: z.string().uuid().nullable(),
        clientId: z.string().uuid().nullable(),
        items: z.array(item).min(1).max(50),
        discount: z.number().min(0),
        tip: z.number().min(0),
        tipProfessionalId: z.string().uuid().nullable().optional(),
        payments: z
          .array(z.object({ payment_method_id: z.string().uuid(), amount: z.number().positive(), installments: z.number().int().min(1).max(18), anticipate: z.boolean() }))
          .min(1)
          .max(6),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: me } = await sb.from("company_members").select("role").eq("company_id", data.companyId).eq("user_id", context.userId).maybeSingle();
    if (!me || !["admin", "manager", "receptionist"].includes(me.role)) throw new Error("Sem permissão para finalizar vendas");

    const [{ data: services }, { data: products }, { data: profs }, { data: overrides }, { data: methods }, apptSvcs] = await Promise.all([
      sb.from("services").select("id,name,price,commission_pct,commission_fixed").eq("company_id", data.companyId),
      sb.from("products").select("id,name,price,commission_pct,quantity,kind").eq("company_id", data.companyId),
      sb.from("professionals").select("id,default_commission_pct").eq("company_id", data.companyId),
      sb.from("service_professionals").select("service_id,professional_id,commission_pct,commission_fixed").eq("company_id", data.companyId),
      sb.from("payment_methods").select("*").eq("company_id", data.companyId).eq("active", true),
      data.appointmentId ? sb.from("appointment_services").select("service_id,price").eq("appointment_id", data.appointmentId) : Promise.resolve({ data: [] as { service_id: string | null; price: number }[] }),
    ]);

    const lines = data.items.map((it) => {
      if (it.kind === "service") {
        const s = services?.find((x) => x.id === it.service_id);
        if (!s) throw new Error("Serviço inválido");
        const apptPrice = apptSvcs.data?.find((a) => a.service_id === s.id)?.price;
        const unit = Number(apptPrice ?? s.price);
        return { it, desc: s.name, unit, total: round2(unit * it.quantity), svc: s, prod: null };
      }
      const p = products?.find((x) => x.id === it.product_id);
      if (!p) throw new Error("Produto inválido");
      if (Number(p.quantity) < it.quantity) throw new Error(`Estoque insuficiente de ${p.name}`);
      return { it, desc: p.name, unit: Number(p.price), total: round2(Number(p.price) * it.quantity), svc: null, prod: p };
    });
    const subtotal = round2(lines.reduce((a, l) => a + l.total, 0));
    if (data.discount > subtotal) throw new Error("Desconto maior que o subtotal");
    if (me.role === "receptionist" && data.discount > subtotal * 0.1) throw new Error("Descontos acima de 10% exigem gerente ou administrador");
    const discounts = distributeDiscount(lines.map((l) => l.total), data.discount);
    const total = round2(subtotal - data.discount + data.tip);
    const err = validatePayments(total, data.payments);
    if (err) throw new Error(err);

    let fees = 0;
    const payments = data.payments.map((p) => {
      const m = methods?.find((x) => x.id === p.payment_method_id);
      if (!m) throw new Error("Forma de pagamento inválida");
      const c = calcPayment(p.amount, m as never, m.kind === "credit" ? p.installments : 1, p.anticipate);
      fees = round2(fees + c.fee);
      return {
        payment_method_id: m.id,
        method_name: m.name + (p.installments > 1 ? ` ${p.installments}x` : ""),
        method_kind: m.kind,
        amount: c.gross,
        installments: p.installments,
        fee_amount: c.fee,
        net_amount: c.net,
        expected_date: addDays(today(), c.receiveDays),
      };
    });

    const items = lines.map((l, i) => {
      const base = round2(l.total - discounts[i]);
      const share = l.it.professional_ids.length ? 1 / l.it.professional_ids.length : 0;
      return {
        kind: l.it.kind,
        service_id: l.svc?.id ?? null,
        product_id: l.prod?.id ?? null,
        professional_id: l.it.professional_ids[0] ?? null,
        description: l.desc,
        quantity: l.it.quantity,
        unit_price: l.unit,
        discount: discounts[i],
        total: base,
        commissions: l.it.professional_ids.map((pid) => {
          const prof = profs?.find((p) => p.id === pid);
          const rule = resolveCommissionRule({
            override: l.svc ? overrides?.find((o) => o.service_id === l.svc!.id && o.professional_id === pid) : null,
            service: l.svc,
            productPct: l.prod ? (l.prod.commission_pct as number | null) : null,
            professionalDefaultPct: Number(prof?.default_commission_pct ?? 0),
          });
          return {
            professional_id: pid,
            base_amount: round2(base * share),
            rate_pct: rule.pct,
            fixed_amount: rule.fixed,
            amount: calcCommission(base, rule, l.it.quantity, share),
            rule: { ...rule, share, discount_applied: discounts[i], computed_at: new Date().toISOString() },
          };
        }),
      };
    });
    if (data.tip > 0 && data.tipProfessionalId) {
      // Tip: separate item, 100% to the professional, not counted as service revenue.
      items.push({
        kind: "tip" as never,
        service_id: null,
        product_id: null,
        professional_id: data.tipProfessionalId,
        description: "Gorjeta",
        quantity: 1,
        unit_price: data.tip,
        discount: 0,
        total: data.tip,
        commissions: [{ professional_id: data.tipProfessionalId, base_amount: data.tip, rate_pct: 100, fixed_amount: 0, amount: data.tip, rule: { source: "tip" } as never }],
      });
    }

    const { data: saleId, error } = await sb.rpc("record_sale", {
      p: {
        company_id: data.companyId,
        appointment_id: data.appointmentId,
        client_id: data.clientId,
        subtotal,
        discount: data.discount,
        tip: data.tip,
        total,
        fees,
        net: round2(total - fees),
        items,
        payments,
      } as never,
    });
    if (error) throw new Error(error.message.includes("sales_appointment_id_key") ? "Este atendimento já foi finalizado" : error.message);
    return { saleId: saleId as string, total, fees, net: round2(total - fees) };
  });

export const addMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ companyId: z.string().uuid(), email: z.string().email(), role: z.enum(["admin", "manager", "receptionist", "professional"]), professionalId: z.string().uuid().nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_crole", { _company: data.companyId, _roles: ["admin"] });
    if (!ok) throw new Error("Apenas administradores gerenciam acessos");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let userId: string | null = null;
    const inv = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);
    if (inv.data?.user) userId = inv.data.user.id;
    else {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      userId = list.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase())?.id ?? null;
    }
    if (!userId) throw new Error(inv.error?.message ?? "Não foi possível convidar este e-mail");
    const { error } = await context.supabase
      .from("company_members")
      .upsert({ company_id: data.companyId, user_id: userId, role: data.role, professional_id: data.professionalId }, { onConflict: "company_id,user_id" });
    if (error) throw new Error(error.message);
    return { ok: true, invited: !!inv.data?.user };
  });

export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ companyId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: members, error } = await context.supabase.from("company_members").select("id,user_id,role,professional_id").eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    const { data: ok } = await context.supabase.rpc("has_crole", { _company: data.companyId, _roles: ["admin", "manager"] });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out = [];
    for (const m of members ?? []) {
      let email: string | null = null;
      if (ok) email = (await supabaseAdmin.auth.admin.getUserById(m.user_id)).data.user?.email ?? null;
      out.push({ ...m, email });
    }
    return out;
  });
