import { createContext, useContext, type ReactNode } from "react";
import type { Database } from "@/integrations/supabase/types";

export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type Role = Database["public"]["Enums"]["member_role"];

type Ctx = {
  company: Company;
  role: Role;
  userId: string;
  memberships: { company: Company; role: Role }[];
  switchCompany: (id: string) => void;
  can: (...roles: Role[]) => boolean;
};
const CompanyCtx = createContext<Ctx | null>(null);

export function CompanyProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <CompanyCtx.Provider value={value}>{children}</CompanyCtx.Provider>;
}
export function useCompany() {
  const c = useContext(CompanyCtx);
  if (!c) throw new Error("useCompany fora do painel");
  return c;
}
export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  manager: "Gerente",
  receptionist: "Recepcionista",
  professional: "Profissional",
};
