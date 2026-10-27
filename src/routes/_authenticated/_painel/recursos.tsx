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
import { RESOURCE_TYPES } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/_painel/recursos")({
  head: () => ({ meta: [{ title: "Recursos — Navalha" }] }),
  component: Resources,
});


function Resources() {
  const { company } = useCompany();
  const { data = [] } = useRows("resources", company.id, { order: "type" });
  const [edit, setEdit] = useState<Partial<Row<"resources">> | null>(null);
  const save = useSave("resources", () => setEdit(null));
  const types = [...new Set([...RESOURCE_TYPES, ...data.map((r) => r.type)])];
  return (
    <div>
      <PageHeader title="Recursos" subtitle="Cadeiras, lavatórios, salas e equipamentos. Cada unidade comporta um atendimento por vez." actions={<Button onClick={() => setEdit({ type: "cadeira", active: true })}><Plus className="h-4 w-4" /> Novo recurso</Button>} />
      {data.length === 0 ? <Empty>Nenhum recurso. Serviços que exigem recurso só poderão ser agendados após o cadastro.</Empty> : (
        <div className="space-y-6">
          {types.filter((t) => data.some((r) => r.type === t)).map((t) => (
            <div key={t}>
              <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{t} • {data.filter((r) => r.type === t && r.active).length} ativos</div>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {data.filter((r) => r.type === t).map((r) => (
                  <button key={r.id} onClick={() => setEdit(r)} className="flex items-center justify-between rounded-lg border bg-card p-3 text-left text-sm">
                    {r.name} {!r.active && <Badge variant="secondary">Inativo</Badge>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && (
        <Dialog open onOpenChange={() => setEdit(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Recurso</DialogTitle></DialogHeader>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate({ ...edit, company_id: company.id }); }}>
              <Field label="Nome"><Input required value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Cadeira 1" /></Field>
              <Field label="Tipo">
                <Input list="rtypes" required value={edit.type ?? ""} onChange={(e) => setEdit({ ...edit, type: e.target.value.toLowerCase() })} />
                <datalist id="rtypes">{types.map((t) => <option key={t} value={t} />)}</datalist>
              </Field>
              <Field label="Regras / observações"><Input value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!edit.active} onCheckedChange={(v) => setEdit({ ...edit, active: v })} /> Disponível</label>
              <Button className="w-full">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
