import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarCheck, CheckCircle2, CircleDollarSign, MessageSquareWarning, Plus } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/lib/company";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Field, Stat, Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addDays, brl, today } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_painel/fechamentos")({
  head: () => ({ meta: [{ title: "Fechamentos — Navalha" }] }),
  component: Closings,
});

type Pro = { id: string; name: string; active: boolean };
type Closing = {
  id: string; company_id: string; professional_id: string; period_start: string; period_end: string; status: string;
  services_count: number; gross: number; discounts: number; cash: number; pix: number; card: number; other: number;
  prof_total: number; est_total: number; adjustments_total: number; advances_total: number; paid_total: number; dispute_reason: string | null;
};
type Entry = { id: string; closing_id: string; kind: string; amount: number; method: string | null; reason: string | null; occurred_at: string };
const STATUS: Record<string, string> = { open: "Aberto", review: "Em conferência", awaiting_approval: "Aguardando aprovação", approved: "Aprovado", partially_paid: "Parcialmente pago", paid: "Pago", disputed: "Contestado" };
const KIND: Record<string, string> = { adjustment: "Ajuste", advance: "Adiantamento", payment: "Pagamento" };
function num(v: unknown) { return Number(v ?? 0); }
function monday(date: string) { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); }

function Closings() {
  const { company, role } = useCompany();
  const qc = useQueryClient();
  const [start, setStart] = useState(monday(today()));
  const end = addDays(start, 6);
  const [professionalId, setProfessionalId] = useState("");
  const [entryClosing, setEntryClosing] = useState<Closing | null>(null);
  const [entryKind, setEntryKind] = useState<"adjustment" | "advance" | "payment">("payment");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("pix");
  const [reason, setReason] = useState("");
  const [dispute, setDispute] = useState<Closing | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = role === "admin" || role === "manager";
  const isOwner = role === "admin";
  const { data, isLoading, error } = useQuery({
    queryKey: ["weekly_closings", company.id],
    queryFn: async () => {
      const [c, p, e] = await Promise.all([
        supabase.from("weekly_closings").select("*").eq("company_id", company.id).order("period_start", { ascending: false }),
        supabase.from("professionals").select("id,name,active").eq("company_id", company.id).order("name"),
        supabase.from("closing_entries").select("*").eq("company_id", company.id).order("occurred_at", { ascending: false }),
      ]);
      if (c.error) throw c.error;
      if (p.error) throw p.error;
      if (e.error) throw e.error;
      return { closings: (c.data ?? []) as Closing[], professionals: (p.data ?? []) as Pro[], entries: (e.data ?? []) as Entry[] };
    },
  });
  const names = new Map((data?.professionals ?? []).map((p) => [p.id, p.name]));
  const current = (data?.closings ?? []).filter((c) => c.period_start <= end && c.period_end >= start);
  const due = current.reduce((a, c) => a + Math.max(0, num(c.prof_total) + num(c.adjustments_total) - num(c.advances_total) - num(c.paid_total)), 0);
  const refresh = () => qc.invalidateQueries({ queryKey: ["weekly_closings", company.id] });

  async function openClosing() {
    if (!professionalId) return toast.error("Selecione um profissional");
    setBusy(true);
    const { error } = await supabase.rpc("open_closing", { _company: company.id, _professional: professionalId, _start: start, _end: end });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Fechamento atualizado com as comandas ativas do período");
    refresh();
  }
  async function status(closing: Closing, next: string, why?: string) {
    const { error } = await supabase.rpc("set_closing_status", { _id: closing.id, _status: next, _reason: why ?? null });
    if (error) return toast.error(error.message);
    toast.success(next === "approved" ? "Fechamento aprovado" : next === "review" ? "Enviado para conferência" : next === "awaiting_approval" ? "Enviado para aprovação" : "Status atualizado");
    refresh();
  }
  async function saveEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!entryClosing) return;
    if (amount <= 0 && entryKind !== "adjustment") return toast.error("Informe um valor maior que zero");
    if (!reason.trim()) return toast.error("Informe o motivo/descrição");
    setBusy(true);
    const { error } = await supabase.rpc("add_closing_entry", { _id: entryClosing.id, _kind: entryKind, _amount: amount, _method: method, _reason: reason.trim(), _key: null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(entryKind === "payment" ? "Pagamento registrado" : entryKind === "advance" ? "Adiantamento registrado" : "Ajuste registrado");
    setEntryClosing(null); setReason(""); setAmount(0); refresh();
  }
  async function sendDispute(e: React.FormEvent) {
    e.preventDefault();
    if (!dispute) return;
    if (!disputeReason.trim()) return toast.error("Descreva a contestação");
    await status(dispute, "disputed", disputeReason.trim());
    setDispute(null); setDisputeReason("");
  }

  return <div>
    <PageHeader title="Fechamentos semanais" subtitle="Confira o movimento de cada profissional e registre os pagamentos de sexta-feira." />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Fechamentos no período" value={String(current.length)} />
      <Stat label="Comissões calculadas" value={brl(current.reduce((a, c) => a + num(c.prof_total), 0))} />
      <Stat label="Já pago" value={brl(current.reduce((a, c) => a + num(c.paid_total), 0))} />
      <Stat label="Saldo a pagar" value={brl(due)} />
    </div>
    {canManage && <div className="mb-6 rounded-xl border bg-card p-4">
      <h2 className="mb-3 font-semibold">Abrir / atualizar fechamento da semana</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Início da semana (segunda)"><Input type="date" value={start} onChange={(e) => setStart(monday(e.target.value))} /></Field>
        <Field label="Profissional"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}><option value="">Selecione...</option>{(data?.professionals ?? []).filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <div className="flex items-end"><Button className="w-full" onClick={openClosing} disabled={busy || !professionalId}><Plus className="mr-2 h-4 w-4" /> Calcular semana até {end.split("-").reverse().join("/")}</Button></div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">As comandas ativas do período são vinculadas ao fechamento e os valores são recalculados no banco.</p>
    </div>}
    {isLoading ? <p className="py-8 text-center text-muted-foreground">Carregando fechamentos…</p> : error ? <p className="text-destructive">{(error as Error).message}</p> : current.length === 0 ? <Empty>Nenhum fechamento para esta semana. {canManage ? "Use o formulário acima para calcular o primeiro." : "Quando o fechamento for criado, ele aparecerá aqui."}</Empty> :
      <div className="space-y-4">{current.map((c) => {
        const balance = num(c.prof_total) + num(c.adjustments_total) - num(c.advances_total) - num(c.paid_total);
        const entries = (data?.entries ?? []).filter((e) => e.closing_id === c.id);
        return <section key={c.id} className="rounded-xl border bg-card p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="text-lg font-semibold">{names.get(c.professional_id) ?? "Profissional"}</div><div className="text-sm text-muted-foreground">{c.period_start.split("-").reverse().join("/")} a {c.period_end.split("-").reverse().join("/")}</div></div>
            <Badge variant={c.status === "paid" ? "default" : c.status === "disputed" ? "destructive" : "secondary"}>{STATUS[c.status] ?? c.status}</Badge>
          </div>
          <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Mini label="Atendimentos" value={String(c.services_count)} />
            <Mini label="Bruto" value={brl(c.gross)} />
            <Mini label="Descontos" value={brl(c.discounts)} />
            <Mini label="Parte do profissional" value={brl(c.prof_total)} />
            <Mini label="Adiantamentos" value={brl(c.advances_total)} />
            <Mini label="Saldo devido" value={brl(balance)} />
          </div>
          <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Dinheiro {brl(c.cash)}</span><span>• Pix {brl(c.pix)}</span><span>• Cartão {brl(c.card)}</span><span>• Outros {brl(c.other)}</span>
          </div>
          {c.dispute_reason && <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"><b>Contestação:</b> {c.dispute_reason}</div>}
          <div className="flex flex-wrap gap-2">
            {canManage && !["approved", "partially_paid", "paid"].includes(c.status) && <Button size="sm" variant="outline" onClick={() => status(c, "review")}><CalendarCheck className="mr-1 h-4 w-4" /> Conferir</Button>}
            {canManage && !["approved", "partially_paid", "paid"].includes(c.status) && <Button size="sm" variant="outline" onClick={() => status(c, "awaiting_approval")}>Enviar para aprovação</Button>}
            {isOwner && ["review", "awaiting_approval", "disputed", "open"].includes(c.status) && <Button size="sm" onClick={() => status(c, "approved")}><CheckCircle2 className="mr-1 h-4 w-4" /> Aprovar</Button>}
            {isOwner && ["approved", "partially_paid"].includes(c.status) && balance > 0 && <Button size="sm" onClick={() => { setEntryClosing(c); setEntryKind("payment"); setAmount(Math.round(balance * 100) / 100); }}><CircleDollarSign className="mr-1 h-4 w-4" /> Registrar pagamento</Button>}
            {canManage && !["paid"].includes(c.status) && <Button size="sm" variant="outline" onClick={() => { setEntryClosing(c); setEntryKind("advance"); setAmount(0); }}><Plus className="mr-1 h-4 w-4" /> Adiantamento</Button>}
            {canManage && !["paid"].includes(c.status) && <Button size="sm" variant="outline" onClick={() => { setEntryClosing(c); setEntryKind("adjustment"); setAmount(0); }}><Plus className="mr-1 h-4 w-4" /> Ajuste</Button>}
            {c.status !== "paid" && <Button size="sm" variant="ghost" onClick={() => setDispute(c)}><MessageSquareWarning className="mr-1 h-4 w-4" /> Contestar</Button>}
          </div>
          {entries.length > 0 && <div className="mt-4 border-t pt-3"><div className="mb-2 text-sm font-medium">Histórico financeiro</div><div className="space-y-1">{entries.map((e) => <div key={e.id} className="flex flex-wrap justify-between gap-2 text-sm"><span>{KIND[e.kind] ?? e.kind} — {e.reason || "Sem descrição"} {e.method ? "· " + e.method : ""}</span><span className="tabular-nums">{e.kind === "adjustment" && num(e.amount) > 0 ? "+" : e.kind === "adjustment" ? "" : "−"}{brl(e.amount)}</span></div>)}</div></div>}
        </section>;
      })}</div>}
    <Dialog open={!!entryClosing} onOpenChange={(v) => !v && setEntryClosing(null)}><DialogContent><DialogHeader><DialogTitle>{entryKind === "payment" ? "Registrar pagamento" : entryKind === "advance" ? "Registrar adiantamento" : "Lançar ajuste"}</DialogTitle></DialogHeader>
      <form onSubmit={saveEntry} className="space-y-3">
        <Field label="Valor (R$)"><Input type="number" step="0.01" min={entryKind === "adjustment" ? undefined : 0.01} required value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
        <Field label="Forma de pagamento"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">Dinheiro</option><option value="pix">Pix</option><option value="debit">Débito</option><option value="credit">Crédito</option><option value="other">Outro</option></select></Field>
        <Field label="Motivo / descrição *"><Input required value={reason} onChange={(e) => setReason(e.target.value)} placeholder={entryKind === "payment" ? "Pagamento semanal via Pix" : entryKind === "advance" ? "Adiantamento realizado" : "Descrever ajuste e motivo"} /></Field>
        <Button className="w-full" disabled={busy}>{busy ? "Salvando…" : "Confirmar lançamento"}</Button>
      </form>
    </DialogContent></Dialog>
    <Dialog open={!!dispute} onOpenChange={(v) => !v && setDispute(null)}><DialogContent><DialogHeader><DialogTitle>Contestar fechamento</DialogTitle></DialogHeader>
      <form onSubmit={sendDispute} className="space-y-3"><Field label="Motivo da contestação"><Input required value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} /></Field><Button className="w-full">Enviar contestação</Button></form>
    </DialogContent></Dialog>
  </div>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/60 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-semibold tabular-nums">{value}</div></div>;
}
