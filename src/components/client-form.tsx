import { useState } from "react";
import { useCompany } from "@/lib/company";
import { useRows, useSave, type Row } from "@/lib/data";
import { Field } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Client = Row<"clients">;

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

