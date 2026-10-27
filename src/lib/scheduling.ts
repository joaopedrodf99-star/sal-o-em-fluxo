/**
 * Scheduling engine — pure and deterministic. Used by the app UI, the public
 * booking page, the server validation and (later) the WhatsApp chatbot.
 * Times are epoch milliseconds.
 */
export type Interval = { start: number; end: number };

export type StepDef = {
  name: string;
  duration_min: number;
  occupies_professional: boolean;
  resource_type: string | null;
};
export type ServiceDef = {
  id: string;
  name: string;
  price: number;
  buffer_after_min: number;
  steps: StepDef[];
  professional_ids: string[];
};
export type ProfessionalAvailability = { id: string; windows: Interval[] };
export type ResourceDef = { id: string; type: string };
export type BusyMap = Record<string, Interval[]>;

export type SchedulingContext = {
  professionals: ProfessionalAvailability[];
  resources: ResourceDef[];
  busyProfessional: BusyMap;
  busyResource: BusyMap;
};

export type ServiceChoice = { service: ServiceDef; professional_id: string | "any" };
export type BookingRequest = { start: number; services: ServiceChoice[]; parallel?: boolean };

export type PlannedSegment = {
  label: string;
  professional_id: string | null;
  resource_id: string | null;
  occupies_professional: boolean;
  start: number;
  end: number;
};
export type PlannedService = {
  service_id: string;
  name: string;
  price: number;
  professional_id: string;
  start: number;
  end: number;
  segments: PlannedSegment[];
};
export type Plan =
  | { ok: true; start: number; end: number; services: PlannedService[] }
  | { ok: false; reason: string };

const MIN = 60_000;

export function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end;
}
function free(list: Interval[] | undefined, iv: Interval) {
  return !(list ?? []).some((b) => overlaps(b, iv));
}
function insideWindows(windows: Interval[], iv: Interval) {
  return windows.some((w) => w.start <= iv.start && iv.end <= w.end);
}

/** Total duration (minutes) of a service including the buffer. */
export function serviceDuration(s: Pick<ServiceDef, "steps" | "buffer_after_min">) {
  return s.steps.reduce((a, st) => a + st.duration_min, 0) + (s.buffer_after_min || 0);
}

function cloneBusy(m: BusyMap): BusyMap {
  const out: BusyMap = {};
  for (const k of Object.keys(m)) out[k] = [...m[k]];
  return out;
}

function tryService(
  svc: ServiceDef,
  profId: string,
  start: number,
  ctx: SchedulingContext,
  busyP: BusyMap,
  busyR: BusyMap,
): PlannedService | string {
  const prof = ctx.professionals.find((p) => p.id === profId);
  if (!prof) return "Profissional indisponível nesta data";
  if (svc.professional_ids.length && !svc.professional_ids.includes(profId))
    return "Profissional não realiza este serviço";
  const segs: PlannedSegment[] = [];
  const localR = cloneBusy(busyR);
  let t = start;
  const steps: StepDef[] = [...svc.steps];
  if (svc.buffer_after_min > 0)
    steps.push({ name: "Intervalo", duration_min: svc.buffer_after_min, occupies_professional: true, resource_type: null });
  for (const st of steps) {
    const iv = { start: t, end: t + st.duration_min * MIN };
    if (st.occupies_professional) {
      if (!insideWindows(prof.windows, iv)) return "Fora do horário de trabalho do profissional";
      if (!free(busyP[profId], iv)) return "Profissional ocupado neste horário";
    }
    let resourceId: string | null = null;
    if (st.resource_type) {
      const r = ctx.resources.find((r) => r.type === st.resource_type && free(localR[r.id], iv));
      if (!r) return `Sem ${st.resource_type} disponível às etapas solicitadas`;
      resourceId = r.id;
      (localR[r.id] ??= []).push(iv);
    }
    segs.push({
      label: st.name,
      professional_id: profId,
      resource_id: resourceId,
      occupies_professional: st.occupies_professional,
      ...iv,
    });
    t = iv.end;
  }
  return { service_id: svc.id, name: svc.name, price: svc.price, professional_id: profId, start, end: t, segments: segs };
}

function commit(ps: PlannedService, busyP: BusyMap, busyR: BusyMap) {
  for (const s of ps.segments) {
    if (s.occupies_professional && s.professional_id) (busyP[s.professional_id] ??= []).push(s);
    if (s.resource_id) (busyR[s.resource_id] ??= []).push(s);
  }
}

export function planBooking(req: BookingRequest, ctx: SchedulingContext): Plan {
  if (!req.services.length) return { ok: false, reason: "Selecione ao menos um serviço" };
  const busyP = cloneBusy(ctx.busyProfessional);
  const busyR = cloneBusy(ctx.busyResource);
  const out: PlannedService[] = [];
  let cursor = req.start;
  for (const choice of req.services) {
    const start = req.parallel ? req.start : cursor;
    const candidates =
      choice.professional_id === "any"
        ? ctx.professionals.map((p) => p.id).filter((id) => !choice.service.professional_ids.length || choice.service.professional_ids.includes(id))
        : [choice.professional_id];
    if (!candidates.length) return { ok: false, reason: `Nenhum profissional habilitado para ${choice.service.name}` };
    let lastErr = "Sem disponibilidade";
    let chosen: PlannedService | null = null;
    for (const pid of candidates) {
      const r = tryService(choice.service, pid, start, ctx, busyP, busyR);
      if (typeof r === "string") lastErr = r;
      else {
        chosen = r;
        break;
      }
    }
    if (!chosen) return { ok: false, reason: `${choice.service.name}: ${lastErr}` };
    commit(chosen, busyP, busyR);
    out.push(chosen);
    cursor = chosen.end;
  }
  return {
    ok: true,
    start: Math.min(...out.map((s) => s.start)),
    end: Math.max(...out.map((s) => s.end)),
    services: out,
  };
}

/** Lists start times (epoch ms) where the whole request fits. */
export function availableSlots(
  req: Omit<BookingRequest, "start">,
  ctx: SchedulingContext,
  dayStart: number,
  dayEnd: number,
  stepMin = 15,
  notBefore = 0,
): number[] {
  const out: number[] = [];
  for (let t = dayStart; t < dayEnd; t += stepMin * MIN) {
    if (t < notBefore) continue;
    const p = planBooking({ ...req, start: t }, ctx);
    if (p.ok) out.push(t);
  }
  return out;
}

/** Build working windows from a weekly schedule entry, removing breaks. */
export function windowsFromHours(
  dayStartMs: number,
  entry: { start: string; end: string; break_start?: string; break_end?: string } | undefined,
): Interval[] {
  if (!entry) return [];
  const toMs = (hm: string) => {
    const [h, m] = hm.split(":").map(Number);
    return dayStartMs + (h * 60 + m) * MIN;
  };
  const s = toMs(entry.start);
  const e = toMs(entry.end);
  if (entry.break_start && entry.break_end) {
    const bs = toMs(entry.break_start);
    const be = toMs(entry.break_end);
    return [
      { start: s, end: bs },
      { start: be, end: e },
    ].filter((w) => w.end > w.start);
  }
  return [{ start: s, end: e }];
}

export type Recurrence = { freq: "weekly" | "biweekly" | "monthly"; count: number };
