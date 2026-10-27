import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createBookings, getSlots } from "@/lib/booking-core";
import { serviceDuration } from "@/lib/scheduling";
import { loadServiceDefs } from "@/lib/scheduling-data";

// Public endpoints: they only expose safe fields and always book through the shared engine.
const slug = z.string().regex(/^[a-z0-9-]{3,40}$/);
const pick = z.object({ service_id: z.string().uuid(), professional_id: z.union([z.string().uuid(), z.literal("any")]) });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function companyBySlug(s: string) {
  const sb = await admin();
  const { data } = await sb.from("companies").select("id,name,slug,phone,address,accent_color").eq("slug", s).maybeSingle();
  if (!data) throw new Error("Estabelecimento não encontrado");
  return { sb, company: data };
}

export const getPublicCompany = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ slug }).parse(i))
  .handler(async ({ data }) => {
    const { sb, company } = await companyBySlug(data.slug);
    const [defs, { data: svcs }, { data: profs }] = await Promise.all([
      loadServiceDefs(sb, company.id, { onlineOnly: true }),
      sb.from("services").select("id,description,category").eq("company_id", company.id),
      sb.from("professionals").select("id,name,photo_url").eq("company_id", company.id).eq("active", true).eq("online_booking", true),
    ]);
    return {
      company,
      services: defs.map((d) => {
        const extra = svcs?.find((s) => s.id === d.id);
        return { id: d.id, name: d.name, price: d.price, duration: serviceDuration(d), category: extra?.category ?? "Geral", description: extra?.description ?? null, professional_ids: d.professional_ids };
      }),
      professionals: profs ?? [],
    };
  });

export const getPublicSlots = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ slug, date, picks: z.array(pick).min(1).max(6) }).parse(i))
  .handler(async ({ data }) => {
    const { sb, company } = await companyBySlug(data.slug);
    const slots = await getSlots(sb, company.id, data.date, data.picks, { onlineOnly: true });
    return { slots };
  });

export const createPublicBooking = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        slug,
        date,
        time: z.string().regex(/^\d{2}:\d{2}$/),
        picks: z.array(pick).min(1).max(6),
        name: z.string().trim().min(2).max(100),
        phone: z.string().trim().regex(/^\+?\d{10,14}$/, "Telefone inválido (DDD + número)"),
        consentReminders: z.boolean(),
        recurrence: z.object({ freq: z.enum(["weekly", "biweekly", "monthly"]), count: z.number().int().min(1).max(12) }).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { sb, company } = await companyBySlug(data.slug);
    const phone = data.phone.replace(/\D/g, "");
    let { data: client } = await sb.from("clients").select("id").eq("company_id", company.id).eq("phone", phone).maybeSingle();
    if (!client) {
      const { data: c, error } = await sb
        .from("clients")
        .insert({ company_id: company.id, name: data.name, phone, whatsapp: phone, consent_reminders: data.consentReminders })
        .select("id")
        .single();
      if (error) throw new Error("Não foi possível registrar seus dados");
      client = c;
    }
    return createBookings(sb, {
      companyId: company.id,
      date: data.date,
      time: data.time,
      picks: data.picks,
      clientId: client.id,
      source: "online",
      recurrence: data.recurrence ?? null,
      onlineOnly: true,
    });
  });
