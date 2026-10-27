import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Lock, CheckCircle2, XCircle, UserX, Receipt, CalendarClock } from "lucide-react";
import { useCompany } from "@/lib/company";
import { useRows, friendly } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { rescheduleAppointment } from "@/server/appointments.functions";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { PageHeader, Field, STATUS_LABEL } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { addDays, addMonths, brl, fmtDate, fmtTime, hmToMin, localDate, localMinutes, localToMs, minToHm, today, weekday, WEEKDAYS } from "@/lib/time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_painel/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Navalha" }] }),
  component: Agenda,
});

const PX = 1.4; // pixels per minute
type View = "day" | "week" | "month";

function Agenda() {
  const { company, can } = useCompany();
  const qc = useQueryClient();
  const [date, setDate] = useState(today());
  const [view, setView] = useState<View>("day");
  const [profFilter, setProfFilter] = useState("all");
  const [newAppt, setNewAppt] = useState<{ date: string; time?: string; professionalId?: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [block, setBlock] = useState(false);
  const reschedule = useServerFn(rescheduleAppointment);
  const { data: profsAll = [] } = useRows("professionals", company.id, { order: "name" });
  const profs = profsAll.filter((p) => p.active && (profFilter === "all" || p.id === profFilter));

  const range = useMemo(() => {
    if (view === "day") return [date, addDays(date, 1)];
    if (view === "week") { const s = addDays(date, -weekday(date)); return [s, addDays(s, 7)]; }
    const s = date.slice(0, 8) + "01"; return [s, addMonths(s, 1)];
  }, [date, view]);

  const { data } = useQuery({
    queryKey: ["agenda", company.id, range[0], range[1]],
    queryFn: async () => {
      const from = new Date(localToMs(range[0], 0)).toISOString();
      const to = new Date(localToMs(range[1], 0)).toISOString();
      const [{ data: segs, error }, { data: appts }] = await Promise.all([
        supabase.from("schedule_segments").select("*").eq("company_id", company.id).eq("active", true).gte("start_at", from).lt("start_at", to),
        supabase.from("appointments").select("*, client:clients(name,phone), appointment_services(name,price,professional_id)").eq("company_id", company.id).gte("start_at", from).lt("start_at", to).order("start_at"),
      ]);
      if (error) throw error;
      return { segs: segs ?? [], appts: appts ?? [] };
    },
  });
  const appts = (data?.appts ?? []).filter((a) => profFilter === "all" || a.professional_id === profFilter || (a.appointment_services as { professional_id: string }[]).some((s) => s.professional_id === profFilter));
  const apptById = Object.fromEntries((data?.appts ?? []).map((a) => [a.id, a]));
  const open = openId ? apptById[openId] : null;

  const dayStart = hmToMin(company.opening_time);
  const dayEnd = hmToMin(company.closing_time);
  const step = view === "day" ? 1 : view === "week" ? 7 : 30;
  const move = (n: number) => setDate(view === "month" ? addMonths(date, n) : addDays(date, n * step));

  async function onDrop(e: React.DragEvent, profId: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("appt");
    const offset = Number(e.dataTransfer.getData("offset") || 0);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const min = Math.round(((e.clientY - rect.top - offset) / PX + dayStart) / 5) * 5;
    try {
      await reschedule({ data: { appointmentId: id, date, time: minToHm(Math.max(0, min)), professionalId: profId } });
      toast.success(`Reagendado para ${minToHm(min)}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
    qc.invalidateQueries({ queryKey: ["agenda"] });
  }

  const title = view === "day" ? `${WEEKDAYS[weekday(date)]}, ${fmtDate(date)}` : view === "week" ? `Semana de ${fmtDate(range[0])}` : fmtDate(range[0]).slice(3);

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle={title}
        actions={
          <>
            {can("admin", "manager", "receptionist") && <Button variant="outline" onClick={() => setBlock(true)}><Lock className="h-4 w-4" /> Bloquear horário</Button>}
            <Button onClick={() => setNewAppt({ date })}><Plus className="h-4 w-4" /> Agendar</Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" onClick={() => setDate(today())}>Hoje</Button>
        <Button variant="outline" size="icon" onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></Button>
        <Input type="date" className="w-40" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as View)} variant="outline">
          <ToggleGroupItem value="day">Dia</ToggleGroupItem><ToggleGroupItem value="week">Semana</ToggleGroupItem><ToggleGroupItem value="month">Mês</ToggleGroupItem>
        </ToggleGroup>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={profFilter} onChange={(e) => setProfFilter(e.target.value)}>
          <option value="all">Todos os profissionais</option>{profsAll.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {view === "day" && (
        profs.length === 0 ? <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Cadastre profissionais para usar a agenda.</div> :
        <div className="overflow-x-auto rounded-xl border bg-card">
          <div className="flex min-w-max">
            <div className="w-14 shrink-0 border-r">
              <div className="h-10 border-b" />
              <div className="relative" style={{ height: (dayEnd - dayStart) * PX }}>
                {Array.from({ length: Math.ceil((dayEnd - dayStart) / 60) }, (_, i) => (
                  <div key={i} className="absolute right-2 text-[10px] text-muted-foreground" style={{ top: i * 60 * PX - 6 }}>{minToHm(dayStart + i * 60)}</div>
                ))}
              </div>
            </div>
            {profs.map((p) => {
              const segs = (data?.segs ?? []).filter((s) => s.professional_id === p.id && localDate(s.start_at) === date);
              return (
                <div key={p.id} className="w-56 shrink-0 border-r last:border-r-0">
                  <div className="flex h-10 items-center gap-2 border-b px-3 text-sm font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color ?? undefined }} />{p.name}</div>
                  <div
                    className="relative cursor-cell"
                    style={{ height: (dayEnd - dayStart) * PX, backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${30 * PX}px)` }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDrop(e, p.id)}
                    onClick={(e) => {
                      if (e.target !== e.currentTarget) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const min = Math.floor(((e.clientY - rect.top) / PX + dayStart) / 15) * 15;
                      setNewAppt({ date, time: minToHm(min), professionalId: p.id });
                    }}
                  >
                    {segs.map((s) => {
                      const a = s.appointment_id ? apptById[s.appointment_id] : null;
                      const top = (localMinutes(s.start_at) - dayStart) * PX;
                      const h = (new Date(s.end_at).getTime() - new Date(s.start_at).getTime()) / 60_000 * PX;
                      if (s.kind === "block")
                        return (
                          <div key={s.id} className="absolute inset-x-1 flex items-start justify-between rounded-md bg-muted p-1.5 text-[11px] text-muted-foreground" style={{ top, height: h, backgroundImage: "repeating-linear-gradient(45deg, transparent 0 6px, var(--border) 6px 7px)" }}>
                            <span><Lock className="mr-1 inline h-3 w-3" />{s.label ?? "Bloqueado"}</span>
                            {can("admin", "manager", "receptionist") && <button className="hover:text-foreground" onClick={async () => { const { error } = await supabase.from("schedule_segments").delete().eq("id", s.id); if (error) toast.error(friendly(error.message)); qc.invalidateQueries({ queryKey: ["agenda"] }); }}>×</button>}
                          </div>
                        );
                      const pause = !s.occupies_professional;
                      return (
                        <div
                          key={s.id}
                          draggable={!!a && !["completed", "cancelled"].includes(a.status)}
                          onDragStart={(e) => { e.dataTransfer.setData("appt", s.appointment_id!); e.dataTransfer.setData("offset", String(e.clientY - e.currentTarget.getBoundingClientRect().top + (localMinutes(s.start_at) - localMinutes(a!.start_at)) * PX)); }}
                          onClick={() => s.appointment_id && setOpenId(s.appointment_id)}
                          className={cn(
                            "absolute inset-x-1 cursor-pointer overflow-hidden rounded-md border-l-4 px-2 py-1 text-[11px] leading-tight shadow-sm",
                            pause ? "border border-dashed bg-background/60 text-muted-foreground" : "bg-secondary text-secondary-foreground",
                            a?.status === "completed" && "opacity-60",
                          )}
                          style={{ top, height: Math.max(h, 14), borderLeftColor: p.color ?? undefined }}
                        >
                          <div className="font-semibold">{fmtTime(s.start_at)} {a?.client?.name ?? "Sem cadastro"}</div>
                          <div className="truncate">{pause ? `⏸ ${s.label} — profissional livre` : s.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="grid gap-3 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDays(range[0], i)).map((d) => (
            <div key={d} className={cn("rounded-xl border bg-card p-2", d === today() && "border-brand")}>
              <button className="mb-2 w-full text-left text-xs font-semibold" onClick={() => { setDate(d); setView("day"); }}>{WEEKDAYS[weekday(d)].slice(0, 3)} {fmtDate(d).slice(0, 5)}</button>
              <div className="space-y-1">
                {appts.filter((a) => localDate(a.start_at) === d).map((a) => (
                  <button key={a.id} onClick={() => setOpenId(a.id)} className={cn("block w-full rounded-md bg-secondary px-2 py-1 text-left text-[11px]", a.status === "cancelled" && "line-through opacity-50")}>
                    <span className="font-semibold">{fmtTime(a.start_at)}</span> {a.client?.name ?? "—"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "month" && (
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => <div key={w} className="p-1 text-center text-xs text-muted-foreground">{w.slice(0, 3)}</div>)}
          {Array.from({ length: weekday(range[0]) }, (_, i) => <div key={"e" + i} />)}
          {Array.from({ length: Math.round((localToMs(range[1], 0) - localToMs(range[0], 0)) / 86_400_000) }, (_, i) => addDays(range[0], i)).map((d) => {
            const list = appts.filter((a) => localDate(a.start_at) === d && a.status !== "cancelled");
            return (
              <button key={d} onClick={() => { setDate(d); setView("day"); }} className={cn("min-h-20 rounded-lg border bg-card p-2 text-left", d === today() && "border-brand")}>
                <div className="text-xs">{Number(d.slice(8))}</div>
                {list.length > 0 && <div className="mt-2 text-xs"><span className="font-semibold">{list.length}</span> agend.<div className="text-muted-foreground">{brl(list.reduce((a, x) => a + Number(x.total_price), 0))}</div></div>}
              </button>
            );
          })}
        </div>
      )}

      {newAppt && <AppointmentDialog initial={newAppt} onClose={() => setNewAppt(null)} />}
      {open && <ApptDetail appt={open} onClose={() => setOpenId(null)} />}
      {block && <BlockDialog date={date} onClose={() => setBlock(false)} />}
    </div>
  );
}

type Appt = { id: string; status: string; start_at: string; end_at: string; notes: string | null; total_price: number; source: string; is_fit_in: boolean; client: { name: string; phone: string | null } | null; appointment_services: { name: string; price: number }[] };

function ApptDetail({ appt, onClose }: { appt: Appt; onClose: () => void }) {
  const qc = useQueryClient();
  const { can } = useCompany();
  const reschedule = useServerFn(rescheduleAppointment);
  const [d, setD] = useState(localDate(appt.start_at));
  const [t, setT] = useState(fmtTime(appt.start_at));
  const [busy, setBusy] = useState(false);
  const editable = !["completed", "cancelled"].includes(appt.status);
  async function status(s: "confirmed" | "cancelled" | "no_show") {
    let reason: string | null = null;
    if (s === "cancelled") { reason = prompt("Motivo do cancelamento:") ; if (reason === null) return; }
    const { error } = await supabase.rpc("set_appointment_status", { _id: appt.id, _status: s, _reason: reason ?? undefined });
    if (error) return toast.error(error.message);
    toast.success(STATUS_LABEL[s]);
    qc.invalidateQueries({ queryKey: ["agenda"] });
    onClose();
  }
  async function doReschedule() {
    setBusy(true);
    try {
      await reschedule({ data: { appointmentId: appt.id, date: d, time: t } });
      toast.success("Reagendado");
      qc.invalidateQueries({ queryKey: ["agenda"] });
      onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{appt.client?.name ?? "Cliente sem cadastro"}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2"><Badge>{STATUS_LABEL[appt.status]}</Badge><span>{fmtDate(appt.start_at)} {fmtTime(appt.start_at)}–{fmtTime(appt.end_at)}</span>{appt.source === "online" && <Badge variant="secondary">Online</Badge>}{appt.is_fit_in && <Badge variant="secondary">Encaixe</Badge>}</div>
          {appt.client?.phone && <div className="text-muted-foreground">{appt.client.phone}</div>}
          <div className="rounded-lg border">{appt.appointment_services.map((s, i) => <div key={i} className="flex justify-between border-b px-3 py-2 last:border-0"><span>{s.name}</span><span>{brl(s.price)}</span></div>)}</div>
          {appt.notes && <div className="rounded-md bg-muted p-2">{appt.notes}</div>}
          {editable && (
            <>
              <div className="flex flex-wrap gap-2">
                {appt.status === "scheduled" && <Button size="sm" variant="outline" onClick={() => status("confirmed")}><CheckCircle2 className="h-4 w-4" /> Confirmar</Button>}
                <Button size="sm" variant="outline" onClick={() => status("no_show")}><UserX className="h-4 w-4" /> Faltou</Button>
                <Button size="sm" variant="outline" onClick={() => status("cancelled")}><XCircle className="h-4 w-4" /> Cancelar</Button>
                {can("admin", "manager", "receptionist") && <Button size="sm" asChild><Link to="/atendimento/$id" params={{ id: appt.id }}><Receipt className="h-4 w-4" /> Finalizar atendimento</Link></Button>}
              </div>
              {can("admin", "manager", "receptionist") && (
                <div className="flex items-end gap-2 border-t pt-3">
                  <Field label="Nova data"><Input type="date" value={d} onChange={(e) => setD(e.target.value)} /></Field>
                  <Field label="Horário"><Input type="time" value={t} onChange={(e) => setT(e.target.value)} /></Field>
                  <Button size="sm" disabled={busy} onClick={doReschedule}><CalendarClock className="h-4 w-4" /> Reagendar</Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BlockDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const { data: profs = [] } = useRows("professionals", company.id, { order: "name" });
  const { data: resources = [] } = useRows("resources", company.id, { order: "name" });
  const [f, setF] = useState({ prof: "", resource: "", date, start: "12:00", end: "13:00", label: "Folga" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.prof && !f.resource) return toast.error("Escolha um profissional ou recurso");
    if (f.end <= f.start) return toast.error("Fim deve ser após o início");
    const { error } = await supabase.from("schedule_segments").insert({
      company_id: company.id, kind: "block", label: f.label, professional_id: f.prof || null, resource_id: f.resource || null, occupies_professional: true,
      start_at: new Date(localToMs(f.date, hmToMin(f.start))).toISOString(), end_at: new Date(localToMs(f.date, hmToMin(f.end))).toISOString(),
    });
    if (error) return toast.error(error.message.includes("overlap") ? "Já existe atendimento neste período" : friendly(error.message));
    toast.success("Horário bloqueado");
    qc.invalidateQueries({ queryKey: ["agenda"] });
    onClose();
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Bloquear horário</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <Field label="Profissional"><select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={f.prof} onChange={(e) => setF({ ...f, prof: e.target.value })}><option value="">—</option>{profs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Ou recurso"><select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={f.resource} onChange={(e) => setF({ ...f, resource: e.target.value })}><option value="">—</option>{resources.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Data"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Motivo"><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
          <Field label="Início"><Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
          <Field label="Fim"><Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
          <Button className="col-span-2">Bloquear</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
