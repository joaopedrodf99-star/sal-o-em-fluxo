import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/lib/company";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Field, Stat, Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addDays, brl, fmtDateTime, today } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_painel/comandas")({
  head: () => ({ meta: [{ title: "Comandas da semana — Navalha" }] }),
  component: Tickets,
});

type Ticket = {
  id: string; company_id: string; professional_id: string; client_name: string | null; service_name: string;
  performed_at: string; amount: number; discount: number; method_kind: string; method_name: string | null;
  prof_pct: number; prof_amount: number; est_amount: number; status: string; notes: string | null;
};
type Professional = { id: string; name: string; active: boolean; default_commission_pct: number };
type Service = { id: string; name: string; price: number; active: boolean; prof_share_pct: number | null };
type Method = { id: string; name: string; kind: string; active: boolean };

const METHODS: Record<string, string> = { cash: "Dinheiro", pix: "Pix", debit: "Débito", credit: "Crédito", other: "Outro" };

function weekStart(date: string) {
  const d = new Date(date + "T12:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function money(v: unknown) { return Number(v ?? 0); }

function Tickets() {
  const { company, role } = useCompany();
  const qc = useQueryClient();
  const [start, setStart] = useState(weekStart(today()));
  const end = addDays(start, 6);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingReverse, setEditingReverse] = useState<Ticket | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["tickets", company.id, start, end],
    queryFn: async () => {
      const [t, p, s, m] = await Promise.all([
        supabase.from("tickets").select("*").eq("company_id", company.id).gte("performed_at", start + "T00:00:00-03:00").lt("performed_at", addDays(end, 1) + "T00:00:00-03:00").order("performed_at", { ascending: false }),
        supabase.from("professionals").select("id,name,active,default_commission_pct").eq("company_id", company.id).order("name"),
        supabase.from("services").select("id,name,price,active,prof_share_pct").eq("company_id", company.id).eq("active", true).order("name"),
        supabase.from("payment_methods").select("id,name,kind,active").eq("company_id", company.id).eq("active", true).order("name"),
      ]);
      if (t.error) throw t.error;
      if (p.error) throw p.error;
      if (s.error) throw s.error;
      if (m.error) throw m.error;
      return { tickets: (t.data ?? []) as Ticket[], professionals: (p.data ?? []) as Professional[], services: (s.data ?? []) as Service[], methods: (m.data ?? []) as Method[] };
    },
  });
  const people = new Map((data?.professionals ?? []).map((p) => [p.id, p.name]));
  const filtered = useMemo(() => (data?.tickets ?? []).filter((t) => {
    const q = search.toLowerCase().trim();
    return !q || [t.client_name, t.service_name, people.get(t.professional_id), t.method_name].some((x) => String(x ?? "").toLowerCase().includes(q));
  }), [data?.tickets, search]);
  const active = filtered.filter((t) => t.status === "active");
  const gross = active.reduce((a, t) => a + money(t.amount), 0);
  const net = active.reduce((a, t) => a + money(t.amount) - money(t.discount), 0);
  const professionalShare = active.reduce((a, t) => a + money(t.prof_amount), 0);
  const refresh = () => qc.invalidateQueries({ queryKey: ["tickets", company.id] });

  async function reverseTicket() {
    if (!editingReverse) return;
    const reason = window.prompt("Informe o motivo do estorno:");
    if (!reason?.trim()) return;
    const { error } = await supabase.from("tickets").update({ status: "reversed", reversed_reason: reason.trim() }).eq("id", editingReverse.id);
    if (error) return toast.error(error.message);
    toast.success("Comanda estornada");
    setEditingReverse(null);
    refresh();
  }

  return <div>
    <PageHeader title="Comandas da semana" subtitle="Registre também os atendimentos feitos sem agendamento. Cada comanda guarda a comissão aplicada no momento do lançamento."
      actions={<Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nova comanda</Button>} />
    <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      <Field label="Início da semana"><Input type="date" value={start} onChange={(e) => setStart(weekStart(e.target.value))} /></Field>
      <div className="pb-2 text-sm text-muted-foreground">até {end.split("-").reverse().join("/")}</div>
      <Field label="Pesquisar"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Cliente, serviço ou profissional" value={search} onChange={(e) => setSearch(e.target.value)} /></div></Field>
    </div>
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Comandas ativas" value={String(active.length)} />
      <Stat label="Faturamento bruto" value={brl(gross)} />
      <Stat label="Total líquido" value={brl(net)} hint="Após descontos" />
      <Stat label="Comissão dos profissionais" value={brl(professionalShare)} />
    </div>
    {isLoading ? <p className="py-8 text-center text-muted-foreground">Carregando comandas…</p> : error ? <p className="text-destructive">{(error as Error).message}</p> : filtered.length === 0 ? <Empty>Nenhuma comanda nesta semana. Registre o primeiro atendimento manual.</Empty> :
      <div className="overflow-x-auto rounded-xl border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Serviço</TableHead><TableHead>Profissional</TableHead><TableHead>Pagamento</TableHead><TableHead>Valor líquido</TableHead><TableHead>Comissão</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{filtered.map((t) => <TableRow key={t.id} className={t.status === "reversed" ? "opacity-60" : ""}>
          <TableCell className="whitespace-nowrap">{fmtDateTime(t.performed_at)}</TableCell><TableCell>{t.client_name || "Cliente avulso"}</TableCell><TableCell>{t.service_name}</TableCell>
          <TableCell>{people.get(t.professional_id) ?? "Profissional"}</TableCell><TableCell>{t.method_name || METHODS[t.method_kind] || t.method_kind}</TableCell>
          <TableCell className="whitespace-nowrap">{brl(money(t.amount) - money(t.discount))}{money(t.discount) > 0 && <div className="text-xs text-muted-foreground">Desconto {brl(t.discount)}</div>}</TableCell>
          <TableCell className="whitespace-nowrap">{brl(t.prof_amount)} <span className="text-xs text-muted-foreground">({money(t.prof_pct)}%)</span></TableCell>
          <TableCell><Badge variant={t.status === "active" ? "secondary" : "destructive"}>{t.status === "active" ? "Ativa" : "Estornada"}</Badge></TableCell>
          <TableCell>{t.status === "active" && ["admin", "manager"].includes(role) && <Button variant="ghost" size="icon" aria-label="Estornar comanda" title="Estornar comanda" onClick={() => setEditingReverse(t)}><RotateCcw className="h-4 w-4" /></Button>}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div>}
    {formOpen && data && <TicketForm companyId={company.id} professionals={data.professionals.filter((p) => p.active)} services={data.services} methods={data.methods} onClose={() => { setFormOpen(false); refresh(); }} />}
    <Dialog open={!!editingReverse} onOpenChange={(v) => !v && setEditingReverse(null)}><DialogContent><DialogHeader><DialogTitle>Estornar comanda?</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">O estorno exige um motivo e ficará registrado no histórico. Comandas de fechamentos aprovados não podem ser estornadas.</p>
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditingReverse(null)}>Cancelar</Button><Button variant="destructive" onClick={reverseTicket}>Confirmar estorno</Button></div>
    </DialogContent></Dialog>
  </div>;
}

function TicketForm({ companyId, professionals, services, methods, onClose }: { companyId: string; professionals: Professional[]; services: Service[]; methods: Method[]; onClose: () => void }) {
  const [professionalId, setProfessionalId] = useState(professionals[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [clientName, setClientName] = useState("");
  const [performedAt, setPerformedAt] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
  const [amount, setAmount] = useState(services[0]?.price ?? 0);
  const [discount, setDiscount] = useState(0);
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedService = services.find((s) => s.id === serviceId);
  function chooseService(id: string) { setServiceId(id); setAmount(services.find((s) => s.id === id)?.price ?? 0); }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!professionalId) return toast.error("Cadastre ou selecione um profissional");
    if (!selectedService) return toast.error("Cadastre ou selecione um serviço ativo");
    if (amount < 0 || discount < 0 || discount > amount) return toast.error("Confira o valor e o desconto");
    setSaving(true);
    const method = methods.find((m) => m.id === methodId);
    const { error } = await supabase.from("tickets").insert({
      company_id: companyId, professional_id: professionalId, service_id: serviceId,
      service_name: selectedService.name, client_name: clientName.trim() || null,
      performed_at: new Date(performedAt).toISOString(), amount, discount,
      payment_method_id: methodId || null, method_kind: method?.kind ?? "cash",
      method_name: method?.name ?? null, notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Comanda registrada; comissão calculada pelo sistema");
    onClose();
  }
  return <Dialog open onOpenChange={(v) => !v && onClose()}><DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
    <DialogHeader><DialogTitle>Nova comanda manual</DialogTitle></DialogHeader>
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Profissional *"><select required className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>{professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Serviço *"><select required className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={serviceId} onChange={(e) => chooseService(e.target.value)}>{services.map((s) => <option key={s.id} value={s.id}>{s.name} — {brl(s.price)}</option>)}</select></Field>
        <Field label="Cliente (opcional)"><Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome ou cliente avulso" /></Field>
        <Field label="Data e hora do atendimento *"><Input required type="datetime-local" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} /></Field>
        <Field label="Valor cobrado (R$) *"><Input required type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
        <Field label="Desconto (R$)"><Input type="number" min={0} max={amount} step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></Field>
        <Field label="Forma de pagamento"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={methodId} onChange={(e) => setMethodId(e.target.value)}><option value="">Outra / não definida</option>{methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Observações"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" /></Field>
      </div>
      {selectedService && <div className="rounded-lg bg-muted p-3 text-sm">Comissão configurada para este serviço: <b>{selectedService.prof_share_pct == null ? "padrão do profissional" : selectedService.prof_share_pct + "%"}</b>. O valor final é calculado no banco para evitar divergências.</div>}
      <Button className="w-full" disabled={saving}>{saving ? "Salvando…" : "Registrar comanda"}</Button>
    </form>
  </DialogContent></Dialog>;
}
