// All business times are in America/Sao_Paulo (UTC-3, no DST since 2019).
export const TZ = "America/Sao_Paulo";
const OFFSET_MIN = -180;

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" + minutes-of-day (local) -> epoch ms */
export function localToMs(date: string, minutes: number): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 0, minutes) - OFFSET_MIN * 60_000;
}

export function hmToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + (m || 0);
}
export function minToHm(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

function shifted(ms: number) {
  return new Date(ms + OFFSET_MIN * 60_000);
}
/** epoch ms or ISO -> local "YYYY-MM-DD" */
export function localDate(t: number | string | Date): string {
  const d = shifted(new Date(t).getTime());
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function localMinutes(t: number | string | Date): number {
  const d = shifted(new Date(t).getTime());
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
export function weekday(date: string): number {
  return new Date(localToMs(date, 12 * 60)).getUTCDay();
}
export function addDays(date: string, n: number): string {
  return localDate(localToMs(date, 12 * 60) + n * 86_400_000);
}
export function addMonths(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(Math.min(d, last))}`;
}
export function today(): string {
  return localDate(Date.now());
}

export function fmtDate(t: number | string | Date | null | undefined): string {
  if (!t) return "—";
  const s = typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : localDate(t);
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}
export function fmtTime(t: number | string | Date): string {
  return minToHm(localMinutes(t));
}
export function fmtDateTime(t: number | string | Date | null | undefined): string {
  if (!t) return "—";
  return `${fmtDate(t)} ${fmtTime(t)}`;
}

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function brl(v: number | string | null | undefined): string {
  return brlFmt.format(Number(v ?? 0));
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
