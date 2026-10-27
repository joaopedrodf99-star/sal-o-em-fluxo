import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Printer } from "lucide-react";
import { useCompany } from "@/lib/company";
import { useRows } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { finalizeSale } from "@/server/sales.functions";
import { calcPayment, round2 } from "@/lib/finance";
import { PageHeader, Field } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { brl, fmtDateTime } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_painel/atendimento/$id")({
  head: () => ({ meta: [{ title: "Finalizar atendimento — Navalha" }] }),
  component: Checkout,
});

type Item = { kind: "service" | "product"; service_id?: string; product_id?: string; professional_ids: string[]; quantity: number; price: number; name: string };
type Pay = { payment_method_id: string; amount: number; installments: number; anticipate: boolean };

function Checkout() {
  const { id } = Route.useParams();
  const { company } = useCompany();
  const qc = useQueryClient();
  const nav = useNavigate();
  const finalize = useServerFn(finalizeSale);
  const { data: products = [] } = useRows("products", company.id, { order: "name" });
  const { data: profs = [] } = useRows("professionals", company.id, { order: "name" });
  const { data: methods = [] } = useRows("payment_methods", company.id);
  const { data: appt } = useQuery({
    queryKey: ["appt", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select("*, client:clients(id,name), appointment_services(*)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const { data: register } = useQuery({
    queryKey: ["cash_registers", company.id, "open"],
    queryFn: async () => (await supabase.from("cash_registers").select("id").eq("company_id", company.id).eq("status", "open").maybeSingle()).data,
  });
  const [items, setItems] = useState<Item[]>([]);
  const [discount, setDiscount] = useState(0);
  const [tip, setTip] = useState(0);
  const [pays, setPays] = useState<Pay[]>([]);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ saleId: string; total: number; fees: number; net: number } | null>(null);

  useEffect(() => {
    if (appt && !items.length)
      setItems(appt.appointment_services.map((s) => ({ kind: "service", service_id: s.service_id!, professional_ids: s.professional_id ? [s.professional_id] : [], quantity: 1, price: Number(s.price), name: s.name })));
  }, [appt]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = round2(items.reduce((a, i) => a + i.price * i.quantity, 0));
  const total = round2(subtotal - discount + tip);
  const paid = round2(pays.reduce((a, p) => a + p.amount, 0));
  useEffect(() => {
    if (methods.length && !pays.length && total > 0) setPays([{ payment_method_id: methods.find((m) => m.kind === "pix")?.id ?? methods[0].id, amount: total, installments: 1, anticipate: false }]);
  }, [methods, total]); // eslint-disable-line react-hooks/exhaustive-deps
  const preview = pays.map((p) => { const m = methods.find((x) => x.id === p.payment_method_id); return m ? calcPayment(p.amount, m as never, p.installments, p.anticipate) : null; });
  const fees = round2(preview.reduce((a, p) => a + (p?.fee ?? 0), 0));

  if (!appt) return <div className="text-muted-foreground">Carregando…</div>;
  if (appt.status === "completed" && !receipt) return <div className="space-y-3"><PageHeader title="Atendimento já finalizado" /><Button asChild variant="outline"><Link to="/agenda">Voltar à agenda</Link></Button></div>;

  async function submit() {
    if (!register) return toast.error("Abra o caixa antes de finalizar");
    if (paid !== total) return toast.error(`Faltam ${brl(total - paid)} para fechar o pagamento`);
    setBusy(true);
    try {
      const r = await finalize({
        data: {
          companyId: company.id, appointmentId: id, clientId: appt!.client?.id ?? null, discount, tip, tipProfessionalId: appt!.professional_id,
          items: items.map((i) => ({ kind: i.kind, service_id: i.service_id ?? null, product_id: i.product_id ?? null, professional_ids: i.professional_ids, quantity: i.quantity })),
          payments: pays,
        },
      });
      qc.invalidateQueries();
      setReceipt(r);
      toast.success("Atendimento finalizado");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  if (receipt)
    return (
      <div className="mx-auto max-w-md rounded-xl border bg-card p-6">
        <h2 className="text-3xl">Recibo</h2>
        <div className="mt-1 text-sm text-muted-foreground">{company.name} • {fmtDateTime(Date.now())}</div>
        <div className="mt-1 text-sm">Cliente: {appt.client?.name ?? "—"}</div>
        <div className="my-4 space-y-1 border-y py-3 text-sm">
          {items.map((i, k) => <div key={k} className="flex justify-between"><span>{i.quantity}× {i.name}</span><span>{brl(i.price * i.quantity)}</span></div>)}
          {discount > 0 && <div className="flex justify-between"><span>Desconto</span><span>−{brl(discount)}</span></div>}
          {tip > 0 && <div className="flex justify-between"><span>Gorjeta</span><span>{brl(tip)}</span></div>}
        </div>
        <div className="flex justify-between text-lg font-semibold"><span>Total</span><span>{brl(receipt.total)}</span></div>
        <div className="mt-2 text-sm">{pays.map((p, k) => <div key={k} className="flex justify-between text-muted-foreground"><span>{methods.find((m) => m.id === p.payment_method_id)?.name}{p.installments > 1 && ` ${p.installments}x`}</span><span>{brl(p.amount)}</span></div>)}</div>
        <div className="no-print mt-6 flex gap-2"><Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir</Button><Button onClick={() => nav({ to: "/agenda" })}>Voltar à agenda</Button></div>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Finalizar atendimento" subtitle={`${appt.client?.name ?? "Cliente sem cadastro"} • ${fmtDateTime(appt.start_at)}`} />
      {!register && <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">O caixa está fechado. <Link to="/caixa" className="underline">Abrir caixa</Link></div>}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <section className="rounded-xl border bg-card p-4">
            <div className="mb-3 text-sm font-semibold">Serviços e produtos</div>
            {items.map((it, i) => (
              <div key={i} className="mb-3 space-y-2 border-b pb-3 last:border-0">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{it.name}</span>
                  <div className="flex items-center gap-2">
                    {it.kind === "product" && <Input type="number" min={1} className="w-16" value={it.quantity} onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? { ...y, quantity: Math.max(1, Number(e.target.value)) } : y)))} />}
                    <span className="tabular-nums">{brl(it.price * it.quantity)}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setItems((x) => x.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {profs.map((p) => {
                    const on = it.professional_ids.includes(p.id);
                    return <button key={p.id} onClick={() => setItems((x) => x.map((y, j) => (j === i ? { ...y, professional_ids: on ? y.professional_ids.filter((z) => z !== p.id) : [...y.professional_ids, p.id] } : y)))} className={`rounded-full border px-2 py-0.5 text-xs ${on ? "border-foreground bg-foreground text-background" : "text-muted-foreground"}`}>{p.name}</button>;
                  })}
                  {it.professional_ids.length > 1 && <span className="text-xs text-muted-foreground">comissão dividida igualmente</span>}
                </div>
              </div>
            ))}
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value="" onChange={(e) => { const p = products.find((x) => x.id === e.target.value); if (p) setItems((x) => [...x, { kind: "product", product_id: p.id, professional_ids: appt.professional_id ? [appt.professional_id] : [], quantity: 1, price: Number(p.price), name: p.name }]); }}>
              <option value="">+ Adicionar produto…</option>{products.filter((p) => p.kind === "retail" && p.active).map((p) => <option key={p.id} value={p.id} disabled={Number(p.quantity) <= 0}>{p.name} — {brl(p.price)} ({Number(p.quantity)} em estoque)</option>)}
            </select>
          </section>
          <section className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4">
            <Field label="Desconto (R$)"><Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} /></Field>
            <Field label="Gorjeta (R$)"><Input type="number" min={0} step="0.01" value={tip} onChange={(e) => setTip(Math.max(0, Number(e.target.value)))} /></Field>
          </section>
        </div>
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-xl border bg-card p-4">
            <div className="mb-3 text-sm font-semibold">Pagamento</div>
            {pays.map((p, i) => {
              const m = methods.find((x) => x.id === p.payment_method_id);
              return (
                <div key={i} className="mb-3 space-y-2 border-b pb-3 last:border-0">
                  <div className="flex gap-2">
                    <select className="h-9 flex-1 rounded-md border bg-background px-2 text-sm" value={p.payment_method_id} onChange={(e) => setPays((x) => x.map((y, j) => (j === i ? { ...y, payment_method_id: e.target.value, installments: 1 } : y)))}>
                      {methods.filter((m) => m.active).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <Input type="number" min={0} step="0.01" className="w-28" value={p.amount} onChange={(e) => setPays((x) => x.map((y, j) => (j === i ? { ...y, amount: Number(e.target.value) } : y)))} />
                    {pays.length > 1 && <Button size="icon" variant="ghost" onClick={() => setPays((x) => x.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                  {m?.kind === "credit" && (
                    <div className="flex items-center gap-3 text-xs">
                      <select className="h-8 rounded-md border bg-background px-2" value={p.installments} onChange={(e) => setPays((x) => x.map((y, j) => (j === i ? { ...y, installments: Number(e.target.value) } : y)))}>
                        {Array.from({ length: 12 }, (_, k) => <option key={k} value={k + 1}>{k + 1}x</option>)}
                      </select>
                      <label className="flex items-center gap-1"><Switch checked={p.anticipate} onCheckedChange={(v) => setPays((x) => x.map((y, j) => (j === i ? { ...y, anticipate: v } : y)))} /> Antecipar</label>
                    </div>
                  )}
                  {preview[i] && preview[i]!.fee > 0 && <div className="text-xs text-muted-foreground">Taxa {brl(preview[i]!.fee)} • líquido {brl(preview[i]!.net)} em {preview[i]!.receiveDays} dia(s)</div>}
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => setPays((x) => [...x, { payment_method_id: methods[0]?.id, amount: round2(total - paid), installments: 1, anticipate: false }])}><Plus className="h-3 w-3" /> Dividir pagamento</Button>
          </section>
          <section className="space-y-1 rounded-xl border bg-card p-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between"><span>Desconto</span><span>−{brl(discount)}</span></div>}
            {tip > 0 && <div className="flex justify-between"><span>Gorjeta</span><span>{brl(tip)}</span></div>}
            <div className="flex justify-between text-lg font-semibold"><span>Total</span><span>{brl(total)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Taxas previstas</span><span>{brl(fees)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Líquido previsto</span><span>{brl(total - fees)}</span></div>
            {paid !== total && <div className="text-destructive">Diferença: {brl(total - paid)}</div>}
            <Button className="mt-3 w-full" disabled={busy || !items.length} onClick={submit}>{busy ? "Registrando…" : "Confirmar e finalizar"}</Button>
          </section>
        </div>
      </div>
    </div>
  );
}
