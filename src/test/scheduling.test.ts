import { describe, expect, it } from "vitest";
import { planBooking, availableSlots, type ServiceDef, type SchedulingContext } from "@/lib/scheduling";
import { localToMs, fmtTime } from "@/lib/time";

const D = "2026-11-03";
const at = (hm: string) => { const [h, m] = hm.split(":").map(Number); return localToMs(D, h * 60 + m); };

const dye: ServiceDef = { id: "dye", name: "Pintura", price: 150, buffer_after_min: 0, professional_ids: [], steps: [
  { name: "Aplicação", duration_min: 15, occupies_professional: true, resource_type: "cadeira" },
  { name: "Pausa química", duration_min: 40, occupies_professional: false, resource_type: null },
  { name: "Finalização", duration_min: 20, occupies_professional: true, resource_type: "lavatorio" },
]};
const cut: ServiceDef = { id: "cut", name: "Corte", price: 50, buffer_after_min: 0, professional_ids: [], steps: [
  { name: "Corte", duration_min: 30, occupies_professional: true, resource_type: "cadeira" },
]};
const mani: ServiceDef = { id: "m", name: "Manicure", price: 40, buffer_after_min: 0, professional_ids: ["A", "B"], steps: [{ name: "Manicure", duration_min: 40, occupies_professional: true, resource_type: null }]};
const pedi: ServiceDef = { ...mani, id: "p", name: "Pedicure" };

function ctx(profs = ["A"]): SchedulingContext {
  return {
    professionals: profs.map((id) => ({ id, windows: [{ start: at("08:00"), end: at("18:00") }] })),
    resources: [{ id: "c1", type: "cadeira" }, { id: "l1", type: "lavatorio" }],
    busyProfessional: {}, busyResource: {},
  };
}
function commitPlan(c: SchedulingContext, plan: ReturnType<typeof planBooking>) {
  if (!plan.ok) throw new Error(plan.reason);
  for (const s of plan.services) for (const g of s.segments) {
    if (g.occupies_professional && g.professional_id) (c.busyProfessional[g.professional_id] ??= []).push(g);
    if (g.resource_id) (c.busyResource[g.resource_id] ??= []).push(g);
  }
}

describe("agenda inteligente", () => {
  it("pintura às 09:00 dura 75 min e termina 10:15", () => {
    const p = planBooking({ start: at("09:00"), services: [{ service: dye, professional_id: "A" }] }, ctx());
    expect(p.ok && fmtTime(p.end)).toBe("10:15");
  });

  it("permite encaixe de corte 09:20–09:50 durante a pausa química", () => {
    const c = ctx();
    commitPlan(c, planBooking({ start: at("09:00"), services: [{ service: dye, professional_id: "A" }] }, c));
    expect(planBooking({ start: at("09:20"), services: [{ service: cut, professional_id: "A" }] }, c).ok).toBe(true);
  });

  it("impede corte que ultrapassa a retomada às 09:55", () => {
    const c = ctx();
    commitPlan(c, planBooking({ start: at("09:00"), services: [{ service: dye, professional_id: "A" }] }, c));
    expect(planBooking({ start: at("09:30"), services: [{ service: cut, professional_id: "A" }] }, c).ok).toBe(false);
  });

  it("impede dois agendamentos simultâneos para o mesmo profissional", () => {
    const c = ctx();
    commitPlan(c, planBooking({ start: at("10:00"), services: [{ service: cut, professional_id: "A" }] }, c));
    expect(planBooking({ start: at("10:15"), services: [{ service: cut, professional_id: "A" }] }, c).ok).toBe(false);
  });

  it("bloqueia quando o recurso (cadeira) está ocupado, mesmo com profissional livre", () => {
    const c = ctx(["A", "B"]);
    commitPlan(c, planBooking({ start: at("10:00"), services: [{ service: cut, professional_id: "A" }] }, c));
    expect(planBooking({ start: at("10:00"), services: [{ service: cut, professional_id: "B" }] }, c).ok).toBe(false);
  });

  it("'qualquer profissional' escolhe o próximo disponível", () => {
    const c = ctx(["A", "B"]);
    c.resources.push({ id: "c2", type: "cadeira" });
    commitPlan(c, planBooking({ start: at("10:00"), services: [{ service: cut, professional_id: "A" }] }, c));
    const p = planBooking({ start: at("10:00"), services: [{ service: cut, professional_id: "any" }] }, c);
    expect(p.ok && p.services[0].professional_id).toBe("B");
  });

  it("manicure e pedicure em paralelo com profissionais diferentes terminam juntas", () => {
    const p = planBooking({ start: at("14:00"), parallel: true, services: [{ service: mani, professional_id: "any" }, { service: pedi, professional_id: "any" }] }, ctx(["A", "B"]));
    expect(p.ok && [fmtTime(p.end), p.services.map((s) => s.professional_id).join()]).toEqual(["14:40", "A,B"]);
  });

  it("em sequência, manicure e pedicure com um profissional somam 80 min", () => {
    const p = planBooking({ start: at("14:00"), services: [{ service: mani, professional_id: "A" }, { service: pedi, professional_id: "A" }] }, ctx(["A"]));
    expect(p.ok && fmtTime(p.end)).toBe("15:20");
  });

  it("não oferece horários fora do expediente", () => {
    const slots = availableSlots({ services: [{ service: cut, professional_id: "A" }] }, ctx(), at("17:00"), at("19:00"), 15);
    expect(slots.map(fmtTime)).toEqual(["17:00", "17:15", "17:30"]);
  });
});
