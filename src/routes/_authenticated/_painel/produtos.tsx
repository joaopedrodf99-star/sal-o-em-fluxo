import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, AlertTriangle } from "lucide-react";
import { useCompany } from "@/lib/company";
import { useRows, useSave, friendly, downloadCSV, type Row } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Field, Stat, Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, fmtDate, fmtDateTime } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_painel/produtos")({
  head: () => ({ meta: [{ title: "Estoque — Navalha" }] }),
  component: Products,
});
type P = Row<"products">;
const MOV: Record<string, string> = { in: "Entrada", out: "Saída", sale: "Venda", consumption: "Insumo", adjust_in: "Inventário +", adjust_out: "Inventário −", refund: "Estorno" };

function Products() {
  const { company } = useCompany();
  const { data = [] } = useRows("products", company.id, { order: "name" });
  const { data: moves = [] } = useRows("stock_movements", company.id, { order: "created_at", asc: false });
  const [edit, setEdit] = useState<Partial<P> | null>(null);
  const [move, setMove] = useState<P | null>(null);
  const low = data.filter((p) => p.active && Number(p.quantity) <= Number(p.min_quantity));
  const value = data.reduce((a, p) => a + Number(p.cost) * Math.max(0, Number(p.quantity)), 0);
  return (
    <div>
      <PageHeader title="Estoque" actions={<>
        <Button variant="outline" onClick={() => downloadCSV("estoque", data.map((p) => ({ produto: p.name, sku: p.sku, tipo: p.kind === "retail" ? "Revenda" : "Insumo", quantidade: p.quantity, minimo: p.min_quantity, custo: p.cost, preco: p.price })))}>Exportar CSV</Button>
        <Button onClick={() => setEdit({ kind: "retail", active: true, unit: "un", cost: 0, price: 0, quantity: 0, min_quantity: 0, commission_pct: 10 })}><Plus className="h-4 w-4" /> Novo produto</Button>
      </>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Valor em estoque (custo)" value={brl(value)} />
        <Stat label="Produtos" value={data.length} />
        <Stat label="Abaixo do mínimo" value={low.length} tone={low.length ? "bad" : undefined} />
      </div>
      <Tabs defaultValue="list">
        <TabsList><TabsTrigger value="list">Produtos</TabsTrigger><TabsTrigger value="mov">Movimentações</TabsTrigger></TabsList>
        <TabsContent value="list">
          {data.length === 0 ? <Empty>Nenhum produto.</Empty> : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Tipo</TableHead><TableHead>Qtd.</TableHead><TableHead>Custo</TableHead><TableHead>Preço</TableHead><TableHead>Margem</TableHead><TableHead>Validade</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>{data.map((p) => {
                  const margin = Number(p.price) > 0 ? ((Number(p.price) - Number(p.cost)) / Number(p.price)) * 100 : 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}<div className="text-xs text-muted-foreground">{p.sku} {p.supplier && `• ${p.supplier}`}</div></TableCell>
                      <TableCell>{p.kind === "retail" ? "Revenda" : "Insumo"}</TableCell>
                      <TableCell className="tabular-nums">{Number(p.quantity)} {p.unit} {Number(p.quantity) <= Number(p.min_quantity) && <AlertTriangle className="inline h-3 w-3 text-destructive" />}</TableCell>
                      <TableCell>{brl(p.cost)}</TableCell><TableCell>{p.kind === "retail" ? brl(p.price) : "—"}</TableCell>
                      <TableCell>{p.kind === "retail" ? `${margin.toFixed(0)}%` : "—"}</TableCell><TableCell>{fmtDate(p.expiry_date)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right"><Button size="sm" variant="ghost" onClick={() => setMove(p)}>Movimentar</Button><Button size="sm" variant="ghost" onClick={() => setEdit(p)}>Editar</Button></TableCell>
                    </TableRow>
                  );
                })}</TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="mov">
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Produto</TableHead><TableHead>Tipo</TableHead><TableHead>Qtd.</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
              <TableBody>{moves.slice(0, 200).map((m) => (
                <TableRow key={m.id}><TableCell>{fmtDateTime(m.created_at)}</TableCell><TableCell>{data.find((p) => p.id === m.product_id)?.name}</TableCell><TableCell><Badge variant="secondary">{MOV[m.type] ?? m.type}</Badge></TableCell><TableCell>{Number(m.quantity)}</TableCell><TableCell>{m.reason}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
      {edit && <ProductForm value={edit} onClose={() => setEdit(null)} />}
      {move && <MoveDialog product={move} onClose={() => setMove(null)} />}
    </div>
  );
}

function ProductForm({ value, onClose }: { value: Partial<P>; onClose: () => void }) {
  const { company } = useCompany();
  const [f, setF] = useState<Partial<P>>(value);
  const save = useSave("products", onClose);
  const set = (k: keyof P, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Produto</DialogTitle></DialogHeader>
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); const { quantity: _q, ...rest } = f; save.mutate({ ...(f.id ? rest : f), company_id: company.id, expiry_date: f.expiry_date || null }); }}>
          <Field label="Nome *" className="col-span-2"><Input required value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="SKU"><Input value={f.sku ?? ""} onChange={(e) => set("sku", e.target.value)} /></Field>
          <Field label="Tipo"><select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={f.kind} onChange={(e) => set("kind", e.target.value)}><option value="retail">Revenda</option><option value="supply">Insumo</option></select></Field>
          <Field label="Categoria"><Input value={f.category ?? ""} onChange={(e) => set("category", e.target.value)} /></Field>
          <Field label="Fornecedor"><Input value={f.supplier ?? ""} onChange={(e) => set("supplier", e.target.value)} /></Field>
          <Field label="Custo (R$)"><Input type="number" min={0} step="0.01" value={f.cost ?? 0} onChange={(e) => set("cost", Number(e.target.value))} /></Field>
          <Field label="Preço de venda (R$)"><Input type="number" min={0} step="0.01" value={f.price ?? 0} onChange={(e) => set("price", Number(e.target.value))} /></Field>
          <Field label="Unidade"><Input value={f.unit ?? ""} onChange={(e) => set("unit", e.target.value)} placeholder="un, ml, g" /></Field>
          <Field label="Estoque mínimo"><Input type="number" min={0} step="0.001" value={f.min_quantity ?? 0} onChange={(e) => set("min_quantity", Number(e.target.value))} /></Field>
          {!f.id && <Field label="Quantidade inicial"><Input type="number" min={0} step="0.001" value={f.quantity ?? 0} onChange={(e) => set("quantity", Number(e.target.value))} /></Field>}
          <Field label="Comissão na venda (%)"><Input type="number" min={0} max={100} value={f.commission_pct ?? ""} onChange={(e) => set("commission_pct", e.target.value === "" ? null : Number(e.target.value))} /></Field>
          <Field label="Validade"><Input type="date" value={f.expiry_date ?? ""} onChange={(e) => set("expiry_date", e.target.value)} /></Field>
          <label className="col-span-2 flex items-center gap-2 text-sm"><Switch checked={!!f.active} onCheckedChange={(v) => set("active", v)} /> Ativo</label>
          <Button className="col-span-2">Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({ product, onClose }: { product: P; onClose: () => void }) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [type, setType] = useState("in");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    let t = type, q = qty;
    if (type === "inventory") { const d = qty - Number(product.quantity); if (d === 0) return onClose(); t = d > 0 ? "adjust_in" : "adjust_out"; q = Math.abs(d); }
    if (q <= 0) return toast.error("Quantidade inválida");
    const { error } = await supabase.from("stock_movements").insert({ company_id: company.id, product_id: product.id, type: t, quantity: q, reason: reason || (type === "inventory" ? "Inventário" : null) });
    if (error) return toast.error(friendly(error.message));
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["stock_movements"] });
    toast.success("Movimentação registrada");
    onClose();
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{product.name} — atual {Number(product.quantity)} {product.unit}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Field label="Tipo"><select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}><option value="in">Entrada (compra)</option><option value="out">Saída (perda/uso)</option><option value="inventory">Inventário (contagem real)</option></select></Field>
          <Field label={type === "inventory" ? "Quantidade contada" : "Quantidade"}><Input type="number" step="0.001" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
          <Field label="Motivo"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Button className="w-full">Registrar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
