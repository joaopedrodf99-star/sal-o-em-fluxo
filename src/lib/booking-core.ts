/**
 * Single booking engine used by the app, the public booking page and the WhatsApp chatbot.
 * Always re-plans from fresh database state; the database exclusion constraints are the final guard.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { planBooking, availableSlots, type Recurrence } from "@/lib/scheduling";
import { loadDayContext, loadServiceDefs } from "@/lib/scheduling-data";
import { addDays, addMonths, hmToMin, localToMs, fmtDate } from "@/lib/time";

type DB = SupabaseClient<Database>;
export type ServicePick = { service_id: string; professional_id: string | "any" };

export async function getSlots(sb: DB, companyId: string, date: string, picks: ServicePick[], opts: { parallel?: boolean; onlineOnly?: boolean } = {}) {
  const [ctx, defs] = await Promise.all([
    loadDayContext(sb, companyId, date, { onlineOnly: opts.onlineOnly }),
    loadServiceDefs(sb, companyId, { onlineOnly: opts.onlineOnly }),
  ]);
  const services = picks.map((p) => {
    const service = defs.find((d) => d.id === p.service_id);
    if (!service) throw new Error("Serviço indisponível");
    return { service, professional_id: p.professional_id };
  });
  const { data: company } = await sb.from("companies").select("slot_minutes").eq("id", companyId).single();
  return availableSlots({ services, parallel: opts.parallel }, ctx, ctx.dayStart, ctx.dayEnd, company?.slot_minutes ?? 15, Date.now());
}

export type BookInput = {
  companyId: string;
  date: string;
  time: string;
  picks: ServicePick[];
  parallel?: boolean;
  clientId: string | null;
  source: "manual" | "online" | "whatsapp";
  notes?: string | null;
  isFitIn?: boolean;
  recurrence?: Recurrence | null;
  onlineOnly?: boolean;
};

function occurrenceDates(date: string, r?: Recurrence | null): string[] {
  if (!r || r.count <= 1) return [date];
  const out: string[] = [];
  for (let i = 0; i < Math.min(r.count, 52); i++) {
    out.push(r.freq === "weekly" ? addDays(date, 7 * i) : r.freq === "biweekly" ? addDays(date, 14 * i) : addMonths(date, i));
  }
  return out;
}

export async function createBookings(sb: DB, input: BookInput) {
  const defs = await loadServiceDefs(sb, input.companyId, { onlineOnly: input.onlineOnly });
  const services = input.picks.map((p) => {
    const service = defs.find((d) => d.id === p.service_id);
    if (!service) throw new Error("Serviço indisponível");
    return { service, professional_id: p.professional_id };
  });
  const dates = occurrenceDates(input.date, input.recurrence);
  const group = dates.length > 1 ? crypto.randomUUID() : null;
  const created: { date: string; id: string; start: number; end: number }[] = [];
  const failed: { date: string; reason: string }[] = [];
  for (const date of dates) {
    const start = localToMs(date, hmToMin(input.time));
    if (start < Date.now() - 5 * 60_000 && input.source !== "manual") {
      failed.push({ date, reason: "Horário no passado" });
      continue;
    }
    const ctx = await loadDayContext(sb, input.companyId, date, { onlineOnly: input.onlineOnly });
    if (!input.isFitIn && (start < ctx.dayStart || start >= ctx.dayEnd)) {
      failed.push({ date, reason: "Fora do horário de funcionamento" });
      continue;
    }
    const plan = planBooking({ start, services, parallel: input.parallel }, ctx);
    if (!plan.ok) {
      failed.push({ date, reason: plan.reason });
      continue;
    }
    const payload = {
      company_id: input.companyId,
      client_id: input.clientId,
      professional_id: plan.services[0].professional_id,
      start_at: new Date(plan.start).toISOString(),
      end_at: new Date(plan.end).toISOString(),
      source: input.source,
      notes: input.notes ?? null,
      is_fit_in: !!input.isFitIn,
      recurrence_group: group,
      services: plan.services.map((s) => ({
        service_id: s.service_id,
        professional_id: s.professional_id,
        name: s.name,
        price: s.price,
        start_at: new Date(s.start).toISOString(),
        end_at: new Date(s.end).toISOString(),
        segments: s.segments.map((g) => ({
          label: g.label,
          professional_id: g.professional_id,
          resource_id: g.resource_id,
          occupies_professional: g.occupies_professional,
          start_at: new Date(g.start).toISOString(),
          end_at: new Date(g.end).toISOString(),
        })),
      })),
    };
    const { data, error } = await sb.rpc("book_appointment", { p: payload as never });
    if (error) failed.push({ date, reason: error.message });
    else created.push({ date, id: data as string, start: plan.start, end: plan.end });
  }
  return { created, failed: failed.map((f) => ({ ...f, label: fmtDate(f.date) })) };
}

export async function rescheduleBooking(sb: DB, input: { appointmentId: string; date: string; time: string; professionalId?: string | null }) {
  const { data: appt, error } = await sb.from("appointments").select("id,company_id,professional_id,status").eq("id", input.appointmentId).single();
  if (error || !appt) throw new Error("Agendamento não encontrado");
  const { data: items } = await sb.from("appointment_services").select("service_id,professional_id,start_at").eq("appointment_id", appt.id).order("start_at");
  const defs = await loadServiceDefs(sb, appt.company_id);
  const starts = (items ?? []).map((i) => new Date(i.start_at).getTime());
  const parallel = starts.length > 1 && starts.every((s) => s === starts[0]);
  const services = (items ?? []).map((i) => {
    const service = defs.find((d) => d.id === i.service_id);
    if (!service) throw new Error("Serviço do agendamento foi removido; recrie o agendamento");
    const pid = input.professionalId && i.professional_id === appt.professional_id ? input.professionalId : i.professional_id!;
    return { service, professional_id: pid };
  });
  const ctx = await loadDayContext(sb, appt.company_id, input.date, { excludeAppointmentId: appt.id });
  const plan = planBooking({ start: localToMs(input.date, hmToMin(input.time)), services, parallel }, ctx);
  if (!plan.ok) throw new Error(plan.reason);
  const { error: e2 } = await sb.rpc("reschedule_appointment", {
    _id: appt.id,
    p: {
      start_at: new Date(plan.start).toISOString(),
      end_at: new Date(plan.end).toISOString(),
      professional_id: plan.services[0].professional_id,
      services: plan.services.map((s) => ({
        service_id: s.service_id,
        professional_id: s.professional_id,
        name: s.name,
        price: s.price,
        start_at: new Date(s.start).toISOString(),
        end_at: new Date(s.end).toISOString(),
        segments: s.segments.map((g) => ({ ...g, start_at: new Date(g.start).toISOString(), end_at: new Date(g.end).toISOString() })),
      })),
    } as never,
  });
  if (e2) throw new Error(e2.message);
  return { ok: true };
}
