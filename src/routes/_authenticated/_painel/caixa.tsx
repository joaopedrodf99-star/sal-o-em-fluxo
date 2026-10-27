import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useCompany } from "@/lib/company";
import { friendly } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { expectedCash } from "@/lib/finance";
import { PageHeader, Field, Stat, Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, fmtDateTime } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_painel/caixa")({
  head: () => ({ meta: [{ title: "Caixa — Navalha" }] }),
  component: Cash,
});

const TYPE: Record<string, string> = { sale: "Venda", withdrawal: "Sangria", supply: "Suprimento", expense: "Despesa", income: "Entrada", refund: "Estorno" };
const KIND: Record<string, string> = { cash: "Dinheiro", pix: "Pix", debit: "Débito", credit: "Crédito", other: "Outro" };

function Cash() {
  const { company } = useCompany();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["cash_registers", company.id],
    queryFn: async () => {
      const { data: regs } = await supabase.from("cash_registers").select("*").eq("company_id", company.id).order("opened_at", { ascending: false }).limit(20);
      const open = regs?.find((r) => r.status === "open") ?? null;
      const { data: moves } = open ? await supabase.from("cash_movements").select("*").eq("register_id", open.id).order("created_at", { ascending: false }) : { data: [] };
      return { regs: regs ?? [], open, moves: moves ?? [] };
    },
  });
  const [opening, setOpening] = useState(0);
  const [mov, setMov] = useState<null | "withdrawal" | "supply" | "expense" | "income">(null);
  const [closing, setClosing] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["cash_registers"] });

  async function openReg() {
    const { error } = await supabase.from("cash_registers").insert({ company_id: company.id, opening_balance: opening });
    if (error) return toast.error(error.message.includes("one_open_register") ? "Já existe um caixa aberto" : friendly(error.message));
    toast.success("Caixa aberto");
    refresh();
  }

  if (!data) return null;
  const { open, moves } = data;
  const exp = open ? expectedCash(Number(open.opening_balance), moves.map((m) => ({ ...m, amount: Number(m.amount) }))) : 0;
  const byKind = moves.filter((m) => ["sale", "refund"].includes(m.type)).reduce<Record<string, number>>((a, m) => ({ ...a, [m.method_kind]: (a[m.method_kind] ?? 0) + Number(m.amount) }), {});

  return (
    <div>
      <PageHeader title="Caixa" subtitle={open ? `Aberto em ${fmtDateTime(open.opened_at)}` : "Fechado"}
        actions={open && <>
          <Button variant="outline" onClick={() => setMov("supply")}>Suprimento</Button>
          <Button variant="outline" onClick={() => setMov("withdrawal")}>Sangria</Button>
          <Button variant="outline" onClick={() => setMov("expense")}>Despesa</Button>
          <Button variant="outline" onClick={() => setMov("income")}>Entrada</Button>
          <Button onClick={() => setClosing(true)}>Fechar caixa</Button>
        </>} />
      {!open ? (
        <div className="max-w-sm space-y-3 rounded-xl border bg-card p-6">
          <Field label="Saldo inicial em dinheiro (R$)"><Input type="number" min={0} step="0.01" value={opening} onChange={(e) => setOpening(Number(e.target.value))} /></Field>
          <Button className="w-full" onClick={openReg}>Abrir caixa</Button>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Dinheiro esperado" value={brl(exp)} hint={`inicial ${brl(open.opening_balance)}`} />
            {Object.entries(KIND).map(([k, l]) => <Stat key={k} label={l} value={brl(byKind[k] ?? 0)} />).slice(1)}
          </div>
          {moves.length === 0 ? <Empty>Sem movimentações.</Empty> : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>Hora</TableHead><TableHead>Tipo</TableHead><TableHead>Forma</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>{moves.map((m) => (
                  <TableRow key={m.id}><TableCell>{fmtDateTime(m.created_at)}</TableCell><TableCell><Badge variant="secondary">{TYPE[m.type] ?? m.type}</Badge></TableCell><TableCell>{KIND[m.method_kind] ?? m.method_kind}</TableCell><TableCell>{m.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{["withdrawal", "expense"].includes(m.type) ? "−" : ""}{brl(Math.abs(Number(m.amount)))}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
        </>
      )}
      <h2 className="mb-3 mt-10 text-2xl">Fechamentos anteriores</h2>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Abertura</TableHead><TableHead>Fechamento</TableHead><TableHead>Esperado</TableHead><TableHead>Contado</TableHead><TableHead>Diferença</TableHead><TableHead>Justificativa</TableHead></TableRow></TableHeader>
          <TableBody>{data.regs.filter((r) => r.status === "closed").map((r) => (
            <TableRow key={r.id}><TableCell>{fmtDateTime(r.opened_at)}</TableCell><TableCell>{fmtDateTime(r.closed_at)}</TableCell><TableCell>{brl(r.expected_cash)}</TableCell><TableCell>{brl(r.counted_cash)}</TableCell>
              <TableCell className={Number(r.difference) !== 0 ? "text-destructive" : ""}>{brl(r.difference)}</TableCell><TableCell>{r.justification ?? "—"}</TableCell></TableRow>
          ))}</TableBody>
        </Table>
      </div>
      {mov && open && <MoveDialog type={mov} registerId={open.id} onClose={() => { setMov(null); refresh(); }} />}
      {closing && open && <CloseDialog id={open.id} expected={exp} onClose={() => { setClosing(false); refresh(); }} />}
    </div>
  );
}

function MoveDialog({ type, registerId, onClose }: { type: string; registerId: string; onClose: () => void }) {
  const { company } = useCompany();
  const [amount, setAmount] = useState(0);
  const [desc, setDesc] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (amount <= 0) return toast.error("Informe um valor");
    if (!desc.trim()) return toast.error("Informe a descrição");
    const { error } = await supabase.from("cash_movements").insert({ company_id: company.id, register_id: registerId, type, method_kind: "cash", amount, description: desc });
    if (error) return toast.error(friendly(error.message));
    if (type === "expense") await supabase.from("financial_entries").insert({ company_id: company.id, type: "payable", category: "Caixa", description: desc, amount, due_date: new Date().toISOString().slice(0, 10), status: "paid", paid_at: new Date().toISOString() });
    toast.success("Registrado");
    onClose();
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{TYPE[type]}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Field label="Valor em dinheiro (R$)"><Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
          <Field label="Descrição"><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <Button className="w-full">Registrar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CloseDialog({ id, expected, onClose }: { id: string; expected: number; onClose: () => void }) {
  const [counted, setCounted] = useState(expected);
  const [just, setJust] = useState("");
  const diff = Math.round((counted - expected) * 100) / 100;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("close_cash_register", { _id: id, _counted: counted, _justification: just });
    if (error) return toast.error(error.message);
    toast.success("Caixa fechado");
    onClose();
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Fechar caixa</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="text-sm">Dinheiro esperado: <b>{brl(expected)}</b></div>
          <Field label="Dinheiro contado (R$)"><Input type="number" step="0.01" value={counted} onChange={(e) => setCounted(Number(e.target.value))} /></Field>
          {diff !== 0 && <div className="text-sm text-destructive">Diferença de {brl(diff)} — justificativa obrigatória</div>}
          <Field label="Justificativa"><Input value={just} onChange={(e) => setJust(e.target.value)} /></Field>
          <Button className="w-full">Confirmar fechamento</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
