import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useCompany } from "@/lib/company";
import { useRows } from "@/lib/data";
import { fetchSlots, createAppointment } from "@/server/appointments.functions";
import { Field } from "@/components/page";
import { ClientForm } from "@/components/client-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl, fmtTime, fmtDate } from "@/lib/time";
import { cn } from "@/lib/utils";

type Pick = { service_id: string; professional_id: string };

export function AppointmentDialog({ initial, onClose }: { initial: { date: string; time?: string; professionalId?: string }; onClose: () => void }) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const { data: clients = [] } = useRows("clients", company.id, { order: "name" });
  const { data: services = [] } = useRows("services", company.id, { order: "name" });
  const { data: profs = [] } = useRows("professionals", company.id, { order: "name" });
  const { data: steps = [] } = useRows("service_steps", company.id);
  const slotsFn = useServerFn(fetchSlots);
  const createFn = useServerFn(createAppointment);
  const [clientQ, setClientQ] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [newClient, setNewClient] = useState(false);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [parallel, setParallel] = useState(false);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time ?? "");
  const [fitIn, setFitIn] = useState(false);
  const [recur, setRecur] = useState<"" | "weekly" | "biweekly" | "monthly">("");
  const [count, setCount] = useState(4);
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);
  const active = services.filter((s) => s.active);

  const matches = useMemo(() => {
    const t = clientQ.toLowerCase();
    return t ? clients.filter((c) => c.name.toLowerCase().includes(t) || (c.phone ?? "").includes(t)).slice(0, 6) : [];
  }, [clientQ, clients]);
  const client = clients.find((c) => c.id === clientId);
  const total = picks.reduce((a, p) => a + Number(services.find((s) => s.id === p.service_id)?.price ?? 0), 0);
  const durOf = (id: string) => steps.filter((s) => s.service_id === id).reduce((a, s) => a + s.duration_min, 0) + (services.find((s) => s.id === id)?.buffer_after_min ?? 0);

  useEffect(() => {
    setSlots(null);
    if (!picks.length || picks.some((p) => !p.service_id)) return;
    let alive = true;
    slotsFn({ data: { companyId: company.id, date, picks: picks as never, parallel } })
      .then((r) => alive && setSlots(r.slots))
      .catch((e) => toast.error(e.message));
    return () => { alive = false; };
  }, [JSON.stringify(picks), date, parallel]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!picks.length || picks.some((p) => !p.service_id)) return toast.error("Selecione os serviços");
    if (!/^\d{2}:\d{2}$/.test(time)) return toast.error("Selecione um horário");
    setLoading(true);
    try {
      const r = await createFn({ data: { companyId: company.id, clientId, date, time, picks: picks as never, parallel, notes: notes || null, isFitIn: fitIn, recurrence: recur ? { freq: recur, count } : null } });
      qc.invalidateQueries();
      if (r.created.length) toast.success(`${r.created.length} agendamento(s) criado(s)`);
      for (const f of r.failed) toast.error(`${f.label}: ${f.reason}`);
      if (r.created.length) onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Novo agendamento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Field label="Cliente">
            {client ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">{client.name} • {client.phone ?? "sem telefone"}<button className="text-muted-foreground" onClick={() => setClientId(null)}>trocar</button></div>
            ) : (
              <div className="relative">
                <Input placeholder="Buscar por nome ou telefone (opcional)" value={clientQ} onChange={(e) => setClientQ(e.target.value)} />
                {matches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow">
                    {matches.map((c) => <button key={c.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setClientId(c.id); setClientQ(""); }}>{c.name} <span className="text-muted-foreground">{c.phone}</span></button>)}
                  </div>
                )}
                <button className="mt-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setNewClient(true)}>+ cadastrar novo cliente</button>
              </div>
            )}
          </Field>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Serviços</div>
            {picks.map((p, i) => {
              const s = services.find((x) => x.id === p.service_id);
              return (
                <div key={i} className="flex flex-wrap gap-2">
                  <select className="h-9 min-w-48 flex-1 rounded-md border bg-background px-2 text-sm" value={p.service_id} onChange={(e) => setPicks((x) => x.map((y, j) => (j === i ? { ...y, service_id: e.target.value } : y)))}>
                    <option value="">Serviço…</option>{active.map((s) => <option key={s.id} value={s.id}>{s.name} — {brl(s.price)} • {durOf(s.id)} min</option>)}
                  </select>
                  <select className="h-9 w-48 rounded-md border bg-background px-2 text-sm" value={p.professional_id} onChange={(e) => setPicks((x) => x.map((y, j) => (j === i ? { ...y, professional_id: e.target.value } : y)))}>
                    <option value="any">Qualquer disponível</option>{profs.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <Button size="icon" variant="ghost" onClick={() => setPicks((x) => x.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  {s?.description && <div className="w-full text-xs text-muted-foreground">{s.description}</div>}
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => setPicks((x) => [...x, { service_id: "", professional_id: initial.professionalId ?? "any" }])}><Plus className="h-3 w-3" /> Adicionar serviço</Button>
            {picks.length > 1 && <label className="flex items-center gap-2 text-sm"><Switch checked={parallel} onCheckedChange={setParallel} /> Executar em paralelo (profissionais diferentes ao mesmo tempo)</label>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Horário"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          </div>
          {slots && (
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Horários disponíveis em {fmtDate(date)} {slots.length === 0 && "— nenhum"}</div>
              <div className="flex flex-wrap gap-1">
                {slots.map((s) => <button key={s} onClick={() => setTime(fmtTime(s))} className={cn("rounded-md border px-2 py-1 text-xs tabular-nums", fmtTime(s) === time && "border-foreground bg-foreground text-background")}>{fmtTime(s)}</button>)}
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm"><Switch checked={fitIn} onCheckedChange={setFitIn} /> Encaixe (permite fora do horário de funcionamento; conflitos continuam bloqueados)</label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Repetir">
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={recur} onChange={(e) => setRecur(e.target.value as never)}>
                <option value="">Não repetir</option><option value="weekly">Semanal</option><option value="biweekly">Quinzenal</option><option value="monthly">Mensal</option>
              </select>
            </Field>
            {recur && <Field label="Ocorrências"><Input type="number" min={2} max={52} value={count} onChange={(e) => setCount(Number(e.target.value))} /></Field>}
          </div>
          <Field label="Observações"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm"><span>Total estimado</span><span className="font-semibold">{brl(total)}</span></div>
          <Button className="w-full" disabled={loading} onClick={submit}>{loading ? "Validando disponibilidade…" : "Agendar"}</Button>
        </div>
        {newClient && <ClientForm value={{ consent_reminders: true, name: clientQ }} onClose={() => setNewClient(false)} onSaved={(c) => setClientId(c.id)} />}
      </DialogContent>
    </Dialog>
  );
}
