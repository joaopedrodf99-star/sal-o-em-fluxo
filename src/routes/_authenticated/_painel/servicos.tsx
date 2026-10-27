import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Pause, User } from "lucide-react";
import { useCompany } from "@/lib/company";
import { useRows, friendly, type Row } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Field, Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl } from "@/lib/time";
import { RESOURCE_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_painel/servicos")({
  head: () => ({ meta: [{ title: "Serviços — Navalha" }] }),
  component: Services,
});
type Svc = Row<"services">;
type Step = { name: string; duration_min: number; occupies_professional: boolean; resource_type: string | null };
type SP = { professional_id: string; commission_pct: number | null; commission_fixed: number | null };
type Sup = { product_id: string; quantity: number };

function Services() {
  const { company } = useCompany();
  const { data = [] } = useRows("services", company.id, { order: "name" });
  const { data: steps = [] } = useRows("service_steps", company.id, { order: "position" });
  const [edit, setEdit] = useState<Partial<Svc> | null>(null);
  const cats = [...new Set(data.map((s) => s.category ?? "Geral"))];
  return (
    <div>
      <PageHeader title="Serviços" subtitle="Configure etapas, pausas, recursos, comissões e divisão." actions={<Button onClick={() => setEdit({ active: true, online_booking: true, price: 0, buffer_after_min: 0, category: "Geral" })}><Plus className="h-4 w-4" /> Novo serviço</Button>} />
      {data.length === 0 && <Empty>Nenhum serviço cadastrado.</Empty>}
      {cats.map((c) => (
        <div key={c} className="mb-6">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{c}</div>
          <div className="grid gap-3 md:grid-cols-2">
            {data.filter((s) => (s.category ?? "Geral") === c).map((s) => {
              const st = steps.filter((x) => x.service_id === s.id);
              const total = st.reduce((a, x) => a + x.duration_min, 0) + s.buffer_after_min;
              return (
                <button key={s.id} onClick={() => setEdit(s)} className="rounded-xl border bg-card p-4 text-left hover:border-foreground/30">
                  <div className="flex justify-between"><span className="font-medium">{s.name}</span><span className="tabular-nums">{brl(s.price)}</span></div>
                  <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
                    {st.map((x) => <div key={x.id} style={{ flex: x.duration_min }} className={cn(x.occupies_professional ? "bg-brand" : "bg-muted-foreground/25")} />)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{total} min</span>{st.length > 1 && <span>• {st.length} etapas</span>}
                    {s.prof_share_pct != null && <span>• profissional {Number(s.prof_share_pct)}% / casa {100 - Number(s.prof_share_pct)}%</span>}
                    {!s.online_booking && <Badge variant="secondary">Só interno</Badge>}{!s.active && <Badge variant="secondary">Inativo</Badge>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {edit && <ServiceForm value={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ServiceForm({ value, onClose }: { value: Partial<Svc>; onClose: () => void }) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const { data: allSteps = [] } = useRows("service_steps", company.id, { order: "position" });
  const { data: allSp = [] } = useRows("service_professionals", company.id);
  const { data: allSup = [] } = useRows("service_supplies", company.id);
  const { data: profs = [] } = useRows("professionals", company.id, { order: "name" });
  const { data: products = [] } = useRows("products", company.id, { order: "name" });
  const { data: resources = [] } = useRows("resources", company.id);
  const [f, setF] = useState<Partial<Svc>>(value);
  const [steps, setSteps] = useState<Step[]>(() => {
    const s = allSteps.filter((x) => x.service_id === value.id);
    return s.length ? s.map(({ name, duration_min, occupies_professional, resource_type }) => ({ name, duration_min, occupies_professional, resource_type })) : [{ name: "Execução", duration_min: 30, occupies_professional: true, resource_type: null }];
  });
  const [sp, setSp] = useState<SP[]>(() => allSp.filter((x) => x.service_id === value.id).map((x) => ({ professional_id: x.professional_id, commission_pct: x.commission_pct, commission_fixed: x.commission_fixed })));
  const [sup, setSup] = useState<Sup[]>(() => allSup.filter((x) => x.service_id === value.id).map((x) => ({ product_id: x.product_id, quantity: Number(x.quantity) })));
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Svc, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const types = [...new Set([...RESOURCE_TYPES, ...resources.map((r) => r.type)])];
  const total = steps.reduce((a, s) => a + s.duration_min, 0) + (f.buffer_after_min ?? 0);
  const updStep = (i: number, p: Partial<Step>) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, d: number) => setSteps((s) => { const a = [...s]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); return a; });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!steps.length || steps.some((s) => !s.name || s.duration_min <= 0)) return toast.error("Cada etapa precisa de nome e duração");
    if (!steps.some((s) => s.occupies_professional)) return toast.error("Ao menos uma etapa deve ocupar o profissional");
    if (f.prof_share_pct != null && (f.prof_share_pct < 0 || f.prof_share_pct > 100)) return toast.error("Divisão deve estar entre 0 e 100%");
    setBusy(true);
    try {
      const row = { name: f.name!, description: f.description ?? null, category: f.category || "Geral", price: Number(f.price ?? 0), commission_pct: f.commission_pct ?? null, commission_fixed: f.commission_fixed ?? null, buffer_after_min: Number(f.buffer_after_min ?? 0), online_booking: !!f.online_booking, active: !!f.active, prof_share_pct: f.prof_share_pct ?? null, company_id: company.id };
      const res = f.id ? await supabase.from("services").update(row).eq("id", f.id).select().single() : await supabase.from("services").insert(row).select().single();
      if (res.error) throw res.error;
      const id = res.data.id;
      for (const t of ["service_steps", "service_professionals", "service_supplies"] as const) {
        const { error } = await supabase.from(t).delete().eq("service_id", id);
        if (error) throw error;
      }
      const r1 = await supabase.from("service_steps").insert(steps.map((s, i) => ({ ...s, position: i, service_id: id, company_id: company.id })));
      if (r1.error) throw r1.error;
      if (sp.length) { const r = await supabase.from("service_professionals").insert(sp.map((x) => ({ ...x, service_id: id, company_id: company.id }))); if (r.error) throw r.error; }
      if (sup.length) { const r = await supabase.from("service_supplies").insert(sup.filter((x) => x.product_id && x.quantity > 0).map((x) => ({ ...x, service_id: id, company_id: company.id }))); if (r.error) throw r.error; }
      qc.invalidateQueries();
      toast.success("Serviço salvo");
      onClose();
    } catch (err) {
      toast.error(friendly((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar serviço" : "Novo serviço"}</DialogTitle></DialogHeader>
        <form onSubmit={submit}>
          <Tabs defaultValue="geral">
            <TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="geral">Geral</TabsTrigger><TabsTrigger value="etapas">Etapas ({total} min)</TabsTrigger><TabsTrigger value="equipe">Profissionais e comissão</TabsTrigger><TabsTrigger value="ficha">Ficha técnica</TabsTrigger></TabsList>
            <TabsContent value="geral" className="grid grid-cols-2 gap-3 pt-3">
              <Field label="Nome *" className="col-span-2"><Input required value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="Categoria"><Input value={f.category ?? ""} onChange={(e) => set("category", e.target.value)} /></Field>
              <Field label="Preço (R$)"><Input type="number" min={0} step="0.01" value={f.price ?? 0} onChange={(e) => set("price", Number(e.target.value))} /></Field>
              <Field label="Descrição" className="col-span-2"><Textarea value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
              <Field label="Parte do profissional nas comandas (%)">
                <Input type="number" min={0} max={100} step="0.01" value={f.prof_share_pct ?? ""} placeholder="usa comissão padrão" onChange={(e) => set("prof_share_pct", e.target.value === "" ? null : Number(e.target.value))} />
              </Field>
              <Field label="Parte do estabelecimento (%)"><Input disabled value={f.prof_share_pct == null ? "—" : String(100 - Number(f.prof_share_pct))} /></Field>
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!f.online_booking} onCheckedChange={(v) => set("online_booking", v)} /> Agendamento online</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!f.active} onCheckedChange={(v) => set("active", v)} /> Ativo</label>
            </TabsContent>
            <TabsContent value="etapas" className="space-y-3 pt-3">
              <div className="flex h-8 overflow-hidden rounded-md border text-[10px]">
                {steps.map((s, i) => <div key={i} style={{ flex: s.duration_min }} className={cn("flex items-center justify-center truncate px-1", s.occupies_professional ? "bg-brand text-accent-foreground" : "bg-muted text-muted-foreground")}>{s.name} {s.duration_min}′</div>)}
                {(f.buffer_after_min ?? 0) > 0 && <div style={{ flex: f.buffer_after_min! }} className="flex items-center justify-center bg-secondary">int.</div>}
              </div>
              {steps.map((s, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-lg border p-2">
                  <Input className="col-span-12 sm:col-span-4" value={s.name} onChange={(e) => updStep(i, { name: e.target.value })} />
                  <div className="col-span-4 flex items-center gap-1 sm:col-span-2"><Input type="number" min={1} value={s.duration_min} onChange={(e) => updStep(i, { duration_min: Number(e.target.value) })} /><span className="text-xs">min</span></div>
                  <button type="button" onClick={() => updStep(i, { occupies_professional: !s.occupies_professional })} className={cn("col-span-8 flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs sm:col-span-3", !s.occupies_professional && "border-dashed")}>
                    {s.occupies_professional ? <><User className="h-3 w-3" /> Ocupa profissional</> : <><Pause className="h-3 w-3" /> Libera profissional</>}
                  </button>
                  <select className="col-span-7 h-9 rounded-md border bg-background px-2 text-xs sm:col-span-2" value={s.resource_type ?? ""} onChange={(e) => updStep(i, { resource_type: e.target.value || null })}>
                    <option value="">Sem recurso</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className="col-span-5 flex justify-end sm:col-span-1">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-3 w-3" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={i === steps.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-3 w-3" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSteps((x) => x.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSteps((s) => [...s, { name: "Etapa", duration_min: 15, occupies_professional: true, resource_type: null }])}><Plus className="h-3 w-3" /> Etapa</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setSteps((s) => [...s, { name: "Pausa", duration_min: 30, occupies_professional: false, resource_type: null }])}><Pause className="h-3 w-3" /> Pausa</Button>
                <Field label="Intervalo após (min)" className="ml-auto w-40"><Input type="number" min={0} value={f.buffer_after_min ?? 0} onChange={(e) => set("buffer_after_min", Number(e.target.value))} /></Field>
              </div>
              <p className="text-xs text-muted-foreground">Etapas que liberam o profissional permitem encaixes, mas a retomada fica reservada. Recursos são reservados apenas na etapa indicada.</p>
            </TabsContent>
            <TabsContent value="equipe" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Comissão do serviço (%)"><Input type="number" min={0} max={100} step="0.01" value={f.commission_pct ?? ""} placeholder="padrão do profissional" onChange={(e) => set("commission_pct", e.target.value === "" ? null : Number(e.target.value))} /></Field>
                <Field label="Ou valor fixo por atendimento (R$)"><Input type="number" min={0} step="0.01" value={f.commission_fixed ?? ""} onChange={(e) => set("commission_fixed", e.target.value === "" ? null : Number(e.target.value))} /></Field>
              </div>
              <p className="text-xs text-muted-foreground">Selecione quem realiza. Sem seleção, todos podem realizar. Valores individuais prevalecem.</p>
              {profs.map((p) => {
                const cur = sp.find((x) => x.professional_id === p.id);
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <label className="flex w-48 items-center gap-2"><Switch checked={!!cur} onCheckedChange={(v) => setSp((s) => (v ? [...s, { professional_id: p.id, commission_pct: null, commission_fixed: null }] : s.filter((x) => x.professional_id !== p.id)))} />{p.name}</label>
                    {cur && <>
                      <Input className="w-28" type="number" placeholder="% próprio" value={cur.commission_pct ?? ""} onChange={(e) => setSp((s) => s.map((x) => (x.professional_id === p.id ? { ...x, commission_pct: e.target.value === "" ? null : Number(e.target.value) } : x)))} />
                      <Input className="w-28" type="number" placeholder="R$ fixo" value={cur.commission_fixed ?? ""} onChange={(e) => setSp((s) => s.map((x) => (x.professional_id === p.id ? { ...x, commission_fixed: e.target.value === "" ? null : Number(e.target.value) } : x)))} />
                    </>}
                  </div>
                );
              })}
            </TabsContent>
            <TabsContent value="ficha" className="space-y-2 pt-3">
              <p className="text-xs text-muted-foreground">Insumos baixados automaticamente do estoque a cada atendimento finalizado.</p>
              {sup.map((x, i) => (
                <div key={i} className="flex gap-2">
                  <select className="h-9 flex-1 rounded-md border bg-background px-2 text-sm" value={x.product_id} onChange={(e) => setSup((s) => s.map((y, j) => (j === i ? { ...y, product_id: e.target.value } : y)))}>
                    <option value="">Produto…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                  </select>
                  <Input className="w-28" type="number" step="0.001" min={0} value={x.quantity} onChange={(e) => setSup((s) => s.map((y, j) => (j === i ? { ...y, quantity: Number(e.target.value) } : y)))} />
                  <Button type="button" size="icon" variant="ghost" onClick={() => setSup((s) => s.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => setSup((s) => [...s, { product_id: "", quantity: 1 }])}><Plus className="h-3 w-3" /> Insumo</Button>
            </TabsContent>
          </Tabs>
          <Button className="mt-4 w-full" disabled={busy}>Salvar serviço</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
