import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Tables = Database["public"]["Tables"];
export type TName = keyof Tables;
export type Row<T extends TName> = Tables[T]["Row"];

/** Lists rows of a tenant table for the current company (RLS enforces isolation). */
export function useRows<T extends TName>(table: T, companyId: string, opts: { order?: string; asc?: boolean; select?: string; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [table, companyId, opts.select ?? "*", opts.order],
    enabled: opts.enabled ?? true,
    queryFn: async () => {
      let q = supabase.from(table).select(opts.select ?? "*").eq("company_id" as never, companyId as never);
      if (opts.order) q = q.order(opts.order, { ascending: opts.asc ?? true });
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Row<T>[];
    },
  });
}

export function useSave<T extends TName>(table: T, onDone?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<Row<T>> & { id?: string }) => {
      const { id, ...rest } = row as { id?: string } & Record<string, unknown>;
      const res = id
        ? await supabase.from(table).update(rest as never).eq("id" as never, id as never).select().single()
        : await supabase.from(table).insert(rest as never).select().single();
      if (res.error) throw res.error;
      return res.data as unknown as Row<T>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Salvo");
      onDone?.();
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });
}

export function useRemove(table: TName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id" as never, id as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Removido");
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });
}

export function friendly(msg: string) {
  if (msg.includes("row-level security")) return "Você não tem permissão para esta ação";
  if (msg.includes("violates foreign key")) return "Registro em uso por outros dados — desative em vez de excluir";
  if (msg.includes("duplicate key")) return "Registro duplicado";
  return msg;
}

export function downloadCSV(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return toast.error("Nada para exportar");
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `${name}.csv`;
  a.click();
}
