import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useCompany } from "@/lib/company";
import { useRows, useSave, useRemove, type Row } from "@/lib/data";
import { PageHeader, Field, Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_painel/lista-espera")({
  head: () => ({ meta: [{ title: "Lista de espera — Navalha" }] }),
  component: Waitlist,
});

function Waitlist() {
  const { company } = useCompany();
  const { data = [] } = useRows("waitlist", company.id, { order: "created_at" });
  const { data: services = [] } = useRows("services", company.id, { order: "name" });
  const { data: profs = [] } = useRows("professionals", company.id, { order: "name" });
  const [edit, setEdit] = useState<Partial<Row<"waitlist">> | null>(null);
  const save = useSave("waitlist", () => setEdit(null));
  const remove = useRemove("waitlist");
  const waiting = data.filter((w) => w.status === "waiting");
  return (
    <div>
      <PageHeader title="Lista de espera" subtitle="Clientes aguardando uma vaga. Avise-os quando um horário abrir." actions={<Button onClick={() => setEdit({ status: "waiting" })}><Plus className="h-4 w-4" /> Adicionar</Button>} />
      {waiting.length === 0 ? <Empty>Ninguém na lista de espera.</Empty> : (
        <div className="space-y-2">
          {waiting.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-4 text-sm">
              <div>
                <div className="font-medium">{w.client_name} <span className="text-muted-foreground">{w.phone}</span></div>
                <div className="text-muted-foreground">{services.find((s) => s.id === w.service_id)?.name ?? "Qualquer serviço"} • {profs.find((p) => p.id === w.professional_id)?.name ?? "qualquer profissional"} • {w.preferred_date ? fmtDate(w.preferred_date) : "qualquer data"}</div>
                {w.notes && <div className="text-muted-foreground">{w.notes}</div>}
              </div>
              <div className="flex gap-2">
                {w.phone && <Button size="sm" variant="outline" asChild><a href={`https://wa.me/55${w.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a></Button>}
                <Button size="sm" variant="outline" onClick={() => save.mutate({ id: w.id, status: "scheduled" })}>Agendado</Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(w.id)}>Remover</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && (
        <Dialog open onOpenChange={() => setEdit(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Lista de espera</DialogTitle></DialogHeader>
            <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate({ ...edit, company_id: company.id, preferred_date: edit.preferred_date || null }); }}>
              <Field label="Nome *"><Input required value={edit.client_name ?? ""} onChange={(e) => setEdit({ ...edit, client_name: e.target.value })} /></Field>
              <Field label="Telefone"><Input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
              <Field label="Serviço"><select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={edit.service_id ?? ""} onChange={(e) => setEdit({ ...edit, service_id: e.target.value || null })}><option value="">Qualquer</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              <Field label="Profissional"><select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={edit.professional_id ?? ""} onChange={(e) => setEdit({ ...edit, professional_id: e.target.value || null })}><option value="">Qualquer</option>{profs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              <Field label="Data preferida"><Input type="date" value={edit.preferred_date ?? ""} onChange={(e) => setEdit({ ...edit, preferred_date: e.target.value })} /></Field>
              <Field label="Observações"><Input value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
              <Button className="col-span-2">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
