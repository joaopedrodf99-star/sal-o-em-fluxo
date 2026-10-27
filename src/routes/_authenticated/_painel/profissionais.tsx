import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useCompany } from "@/lib/company";
import { useRows, useSave, type Row } from "@/lib/data";
import { PageHeader, Field, Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WEEKDAYS, brl } from "@/lib/time";
import type { WorkHour } from "@/lib/scheduling-data";

export const Route = createFileRoute("/_authenticated/_painel/profissionais")({
  head: () => ({ meta: [{ title: "Profissionais — Navalha" }] }),
  component: Pros,
});
type Pro = Row<"professionals">;

function Pros() {
  const { company } = useCompany();
  const { data = [] } = useRows("professionals", company.id, { order: "name" });
  const [edit, setEdit] = useState<Partial<Pro> | null>(null);
  return (
    <div>
      <PageHeader title="Profissionais" actions={<Button onClick={() => setEdit({ active: true, online_booking: true, default_commission_pct: 40, color: "#c9a227" })}><Plus className="h-4 w-4" /> Novo</Button>} />
      {data.length === 0 ? <Empty>Cadastre sua equipe para começar a agendar.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <button key={p.id} onClick={() => setEdit(p)} className="flex items-center gap-4 rounded-xl border bg-card p-4 text-left hover:border-foreground/30">
              {p.photo_url ? <img src={p.photo_url} alt={p.name} className="h-12 w-12 rounded-full object-cover" /> :
                <div className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold" style={{ background: p.color ?? undefined }}>{p.name[0]}</div>}
              <div className="flex-1">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">Comissão padrão {Number(p.default_commission_pct)}% • meta {brl(p.monthly_goal)}</div>
              </div>
              {!p.active && <Badge variant="secondary">Inativo</Badge>}
            </button>
          ))}
        </div>
      )}
      {edit && <ProForm value={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ProForm({ value, onClose }: { value: Partial<Pro>; onClose: () => void }) {
  const { company } = useCompany();
  const [f, setF] = useState<Partial<Pro>>(value);
  const [hours, setHours] = useState<WorkHour[]>((value.work_hours as unknown as WorkHour[]) ?? [1, 2, 3, 4, 5].map((d) => ({ weekday: d, start: "09:00", end: "18:00", break_start: "12:00", break_end: "13:00" })));
  const save = useSave("professionals", onClose);
  const set = (k: keyof Pro, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const setDay = (wd: number, patch: Partial<WorkHour> | null) =>
    setHours((h) => {
      const rest = h.filter((x) => x.weekday !== wd);
      if (patch === null) return rest;
      const cur = h.find((x) => x.weekday === wd) ?? { weekday: wd, start: "09:00", end: "18:00" };
      return [...rest, { ...cur, ...patch }].sort((a, b) => a.weekday - b.weekday);
    });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    for (const h of hours) if (h.end <= h.start) return alert(`${WEEKDAYS[h.weekday]}: fim deve ser após o início`);
    save.mutate({ ...f, company_id: company.id, work_hours: hours as never });
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar profissional" : "Novo profissional"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome *" className="col-span-2"><Input required value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Telefone"><Input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="E-mail"><Input value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="URL da foto"><Input value={f.photo_url ?? ""} onChange={(e) => set("photo_url", e.target.value || null)} /></Field>
            <Field label="Cor na agenda"><Input type="color" value={f.color ?? "#c9a227"} onChange={(e) => set("color", e.target.value)} /></Field>
            <Field label="Comissão padrão (%)"><Input type="number" min={0} max={100} step="0.01" value={f.default_commission_pct ?? 0} onChange={(e) => set("default_commission_pct", Number(e.target.value))} /></Field>
            <Field label="Meta mensal (R$)"><Input type="number" min={0} step="0.01" value={f.monthly_goal ?? 0} onChange={(e) => set("monthly_goal", Number(e.target.value))} /></Field>
          </div>
          <div className="flex gap-6 text-sm">
            <label className="flex items-center gap-2"><Switch checked={!!f.active} onCheckedChange={(v) => set("active", v)} /> Ativo</label>
            <label className="flex items-center gap-2"><Switch checked={!!f.online_booking} onCheckedChange={(v) => set("online_booking", v)} /> Aparece no agendamento online</label>
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold">Horários de trabalho</div>
            <div className="space-y-2">
              {WEEKDAYS.map((name, wd) => {
                const h = hours.find((x) => x.weekday === wd);
                return (
                  <div key={wd} className="flex flex-wrap items-center gap-2 text-sm">
                    <label className="flex w-28 items-center gap-2"><Switch checked={!!h} onCheckedChange={(v) => setDay(wd, v ? {} : null)} />{name}</label>
                    {h ? (
                      <>
                        <Input type="time" className="w-28" value={h.start} onChange={(e) => setDay(wd, { start: e.target.value })} />–
                        <Input type="time" className="w-28" value={h.end} onChange={(e) => setDay(wd, { end: e.target.value })} />
                        <span className="text-muted-foreground">intervalo</span>
                        <Input type="time" className="w-28" value={h.break_start ?? ""} onChange={(e) => setDay(wd, { break_start: e.target.value || undefined })} />–
                        <Input type="time" className="w-28" value={h.break_end ?? ""} onChange={(e) => setDay(wd, { break_end: e.target.value || undefined })} />
                      </>
                    ) : <span className="text-muted-foreground">Folga</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <Button className="w-full" disabled={save.isPending}>Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
