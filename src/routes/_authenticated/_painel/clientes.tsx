import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useCompany } from "@/lib/company";
import { useRows, useSave, type Row } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Field, Empty, STATUS_LABEL } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, fmtDate, fmtDateTime } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_painel/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Navalha" }] }),
  component: Clients,
});

type Client = Row<"clients">;

function Clients() {
  const { company } = useCompany();
  const { data: clients = [] } = useRows("clients", company.id, { order: "name" });
  const { data: stats } = useQuery({
    queryKey: ["client-stats", company.id],
    queryFn: async () => {
      const [{ data: sales }, { data: appts }] = await Promise.all([
        supabase.from("sales").select("client_id,total,created_at").eq("company_id", company.id).eq("status", "completed"),
        supabase.from("appointments").select("client_id,start_at,status").eq("company_id", company.id).eq("status", "completed"),
      ]);
      const m: Record<string, { spent: number; last: string | null }> = {};
      for (const s of sales ?? []) if (s.client_id) { const x = (m[s.client_id] ??= { spent: 0, last: null }); x.spent += Number(s.total); if (!x.last || s.created_at > x.last) x.last = s.created_at; }
      for (const a of appts ?? []) if (a.client_id) { const x = (m[a.client_id] ??= { spent: 0, last: null }); if (!x.last || a.start_at > x.last) x.last = a.start_at; }
      return m;
    },
  });
  const [q, setQ] = useState("");
  const [onlyInactive, setOnlyInactive] = useState(false);
  const [edit, setEdit] = useState<Partial<Client> | null>(null);
  const [view, setView] = useState<Client | null>(null);
  const cutoff = Date.now() - 60 * 86_400_000;
  const list = useMemo(
    () =>
      clients.filter((c) => {
        const t = q.toLowerCase();
        const hit = !t || c.name.toLowerCase().includes(t) || (c.phone ?? "").includes(t) || (c.email ?? "").toLowerCase().includes(t);
        const last = stats?.[c.id]?.last;
        return hit && (!onlyInactive || !last || new Date(last).getTime() < cutoff);
      }),
    [clients, q, onlyInactive, stats, cutoff],
  );

  return (
    <div>
      <PageHeader title="Clientes" subtitle={`${clients.length} cadastrados`} actions={<Button onClick={() => setEdit({ consent_reminders: true })}><Plus className="h-4 w-4" /> Novo cliente</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Nome, telefone ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={onlyInactive} onCheckedChange={setOnlyInactive} /> Inativos há 60+ dias</label>
      </div>
      {list.length === 0 ? <Empty>Nenhum cliente encontrado.</Empty> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Total gasto</TableHead><TableHead>Última visita</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setView(c)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>{brl(stats?.[c.id]?.spent ?? 0)}</TableCell>
                  <TableCell>{fmtDate(stats?.[c.id]?.last)}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEdit(c); }}>Editar</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {edit && <ClientForm value={edit} onClose={() => setEdit(null)} />}
      {view && <ClientHistory client={view} onClose={() => setView(null)} />}
    </div>
  );
}

export function ClientForm({ value, onClose, onSaved }: { value: Partial<Client>; onClose: () => void; onSaved?: (c: Client) => void }) {
  const { company } = useCompany();
  const { data: profs = [] } = useRows("professionals", company.id, { order: "name" });
  const [f, setF] = useState<Partial<Client>>(value);
  const save = useSave("clients");
  const set = (k: keyof Client, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const phone = (f.phone ?? "").replace(/\D/g, "") || null;
    const c = await save.mutateAsync({ ...f, phone, whatsapp: (f.whatsapp ?? "").replace(/\D/g, "") || phone, company_id: company.id, email: f.email || null, birth_date: f.birth_date || null } as never);
    onSaved?.(c);
    onClose();
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{f.id ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <Field label="Nome *" className="col-span-2"><Input required value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Telefone"><Input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="11999998888" /></Field>
          <Field label="WhatsApp"><Input value={f.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} /></Field>
          <Field label="E-mail"><Input type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Nascimento"><Input type="date" value={f.birth_date ?? ""} onChange={(e) => set("birth_date", e.target.value)} /></Field>
          <Field label="Profissional preferido">
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={f.preferred_professional_id ?? ""} onChange={(e) => set("preferred_professional_id", e.target.value || null)}>
              <option value="">—</option>{profs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Lembrete de retorno (dias)"><Input type="number" min={0} value={f.return_reminder_days ?? ""} onChange={(e) => set("return_reminder_days", e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="Observações" className="col-span-2"><Textarea value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
          <label className="col-span-2 flex items-center gap-2 text-sm"><Switch checked={!!f.consent_reminders} onCheckedChange={(v) => set("consent_reminders", v)} /> Aceita lembretes de agendamento</label>
          <label className="col-span-2 flex items-center gap-2 text-sm"><Switch checked={!!f.consent_marketing} onCheckedChange={(v) => set("consent_marketing", v)} /> Aceita comunicações promocionais (LGPD)</label>
          <Button className="col-span-2" disabled={save.isPending}>Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClientHistory({ client, onClose }: { client: Client; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["client-history", client.id],
    queryFn: async () => {
      const [{ data: appts }, { data: items }] = await Promise.all([
        supabase.from("appointments").select("id,start_at,status,total_price,appointment_services(name)").eq("client_id", client.id).order("start_at", { ascending: false }).limit(50),
        supabase.from("sale_items").select("description,quantity,total,kind,sales!inner(client_id,created_at,status)").eq("sales.client_id", client.id).eq("kind", "product"),
      ]);
      return { appts: appts ?? [], products: items ?? [] };
    },
  });
  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle className="font-display text-3xl font-normal">{client.name}</SheetTitle></SheetHeader>
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          <div>{client.phone ?? "Sem telefone"} {client.email && `• ${client.email}`}</div>
          {client.notes && <div className="rounded-md bg-muted p-2 text-foreground">{client.notes}</div>}
        </div>
        <h3 className="mt-6 text-sm font-semibold">Atendimentos</h3>
        <div className="mt-2 space-y-2">
          {(data?.appts ?? []).map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div><div>{fmtDateTime(a.start_at)}</div><div className="text-muted-foreground">{(a.appointment_services as { name: string }[]).map((s) => s.name).join(", ")}</div></div>
              <div className="text-right"><Badge variant="secondary">{STATUS_LABEL[a.status]}</Badge><div className="mt-1">{brl(a.total_price)}</div></div>
            </div>
          ))}
          {data?.appts.length === 0 && <div className="text-sm text-muted-foreground">Sem atendimentos.</div>}
        </div>
        <h3 className="mt-6 text-sm font-semibold">Produtos comprados</h3>
        <div className="mt-2 space-y-1 text-sm">
          {(data?.products ?? []).map((p, i) => <div key={i} className="flex justify-between"><span>{p.quantity}× {p.description}</span><span>{brl(p.total)}</span></div>)}
          {data?.products.length === 0 && <div className="text-muted-foreground">Nenhum.</div>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
