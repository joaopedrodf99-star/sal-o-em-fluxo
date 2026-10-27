import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { localToMs, weekday, hmToMin, addDays } from "@/lib/time";
import { windowsFromHours, type SchedulingContext, type ServiceDef, type BusyMap } from "@/lib/scheduling";

type DB = SupabaseClient<Database>;
export type WorkHour = { weekday: number; start: string; end: string; break_start?: string; break_end?: string };

export async function loadServiceDefs(sb: DB, companyId: string, opts: { onlineOnly?: boolean } = {}): Promise<ServiceDef[]> {
  let q = sb.from("services").select("id,name,price,buffer_after_min,online_booking,active").eq("company_id", companyId).eq("active", true);
  if (opts.onlineOnly) q = q.eq("online_booking", true);
  const [{ data: svcs, error }, { data: steps }, { data: sp }] = await Promise.all([
    q,
    sb.from("service_steps").select("*").eq("company_id", companyId).order("position"),
    sb.from("service_professionals").select("service_id,professional_id").eq("company_id", companyId),
  ]);
  if (error) throw new Error(error.message);
  return (svcs ?? []).map((s) => {
    const st = (steps ?? []).filter((x) => x.service_id === s.id);
    return {
      id: s.id,
      name: s.name,
      price: Number(s.price),
      buffer_after_min: s.buffer_after_min,
      steps: st.length
        ? st.map((x) => ({ name: x.name, duration_min: x.duration_min, occupies_professional: x.occupies_professional, resource_type: x.resource_type }))
        : [{ name: s.name, duration_min: 30, occupies_professional: true, resource_type: null }],
      professional_ids: (sp ?? []).filter((x) => x.service_id === s.id).map((x) => x.professional_id),
    };
  });
}

/** Builds the scheduling context for one local day. `excludeAppointmentId` ignores its own segments (rescheduling). */
export async function loadDayContext(
  sb: DB,
  companyId: string,
  date: string,
  opts: { excludeAppointmentId?: string; onlineOnly?: boolean } = {},
): Promise<SchedulingContext & { dayStart: number; dayEnd: number }> {
  const dayStartMs = localToMs(date, 0);
  const nextMs = localToMs(addDays(date, 1), 0);
  let profQ = sb.from("professionals").select("id,work_hours,active,online_booking").eq("company_id", companyId).eq("active", true);
  if (opts.onlineOnly) profQ = profQ.eq("online_booking", true);
  const [{ data: company }, { data: profs, error }, { data: resources }, { data: segs }] = await Promise.all([
    sb.from("companies").select("opening_time,closing_time").eq("id", companyId).single(),
    profQ,
    sb.from("resources").select("id,type").eq("company_id", companyId).eq("active", true),
    sb
      .from("schedule_segments")
      .select("appointment_id,professional_id,resource_id,occupies_professional,start_at,end_at")
      .eq("company_id", companyId)
      .eq("active", true)
      .lt("start_at", new Date(nextMs).toISOString())
      .gt("end_at", new Date(dayStartMs).toISOString()),
  ]);
  if (error) throw new Error(error.message);
  const wd = weekday(date);
  const busyProfessional: BusyMap = {};
  const busyResource: BusyMap = {};
  for (const s of segs ?? []) {
    if (opts.excludeAppointmentId && s.appointment_id === opts.excludeAppointmentId) continue;
    const iv = { start: new Date(s.start_at).getTime(), end: new Date(s.end_at).getTime() };
    if (s.professional_id && s.occupies_professional) (busyProfessional[s.professional_id] ??= []).push(iv);
    if (s.resource_id) (busyResource[s.resource_id] ??= []).push(iv);
  }
  return {
    professionals: (profs ?? []).map((p) => ({
      id: p.id,
      windows: windowsFromHours(dayStartMs, ((p.work_hours as unknown as WorkHour[]) ?? []).find((h) => h.weekday === wd)),
    })),
    resources: resources ?? [],
    busyProfessional,
    busyResource,
    dayStart: dayStartMs + hmToMin(company?.opening_time ?? "08:00") * 60_000,
    dayEnd: dayStartMs + hmToMin(company?.closing_time ?? "20:00") * 60_000,
  };
}
