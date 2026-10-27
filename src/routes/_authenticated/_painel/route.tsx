import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, CalendarDays, Users, Scissors, UserCog, Armchair, Package, Wallet, Receipt, Percent, BarChart3,
  Settings, ClipboardList, ListChecks, Bell, Moon, Sun, LogOut, Menu, CalendarCheck, HandCoins,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CompanyProvider, ROLE_LABEL, type Company, type Role } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_painel")({ component: Shell });

const ALL: Role[] = ["admin", "manager", "receptionist", "professional"];
const STAFF: Role[] = ["admin", "manager", "receptionist"];
const MGMT: Role[] = ["admin", "manager"];
const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: MGMT },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, roles: ALL },
  { to: "/comandas", label: "Comandas da semana", icon: ClipboardList, roles: ALL },
  { to: "/fechamentos", label: "Fechamentos", icon: CalendarCheck, roles: ALL },
  { to: "/lista-espera", label: "Lista de espera", icon: ListChecks, roles: STAFF },
  { to: "/clientes", label: "Clientes", icon: Users, roles: ALL },
  { to: "/caixa", label: "Caixa", icon: Wallet, roles: STAFF },
  { to: "/financeiro", label: "Financeiro", icon: Receipt, roles: MGMT },
  { to: "/comissoes", label: "Comissões", icon: HandCoins, roles: MGMT },
  { to: "/servicos", label: "Serviços", icon: Scissors, roles: MGMT },
  { to: "/profissionais", label: "Profissionais", icon: UserCog, roles: MGMT },
  { to: "/recursos", label: "Recursos", icon: Armchair, roles: MGMT },
  { to: "/produtos", label: "Estoque", icon: Package, roles: MGMT },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, roles: MGMT },
  { to: "/configuracoes", label: "Configurações", icon: Settings, roles: MGMT },
] as const;

function hexToken(hex?: string | null) {
  return hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : undefined;
}

function Shell() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setSelected(localStorage.getItem("company_id"));
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["memberships"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("company_members").select("role, company:companies(*)").eq("user_id", u.user!.id);
      if (error) throw error;
      return { userId: u.user!.id, list: (data ?? []).map((m) => ({ role: m.role as Role, company: m.company as unknown as Company })) };
    },
  });

  useEffect(() => {
    if (data && data.list.length === 0) nav({ to: "/onboarding" });
  }, [data, nav]);

  const current = useMemo(() => data?.list.find((m) => m.company.id === selected) ?? data?.list[0], [data, selected]);

  const { data: notes } = useQuery({
    queryKey: ["notifications", current?.company.id],
    enabled: !!current,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*").eq("company_id", current!.company.id).order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
  });
  const unread = (notes ?? []).filter((n) => !n.read_at).length;

  if (isLoading || !current || !data) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;

  const role = current.role;
  const items = NAV.filter((n) => (n.roles as readonly Role[]).includes(role));
  const toggleTheme = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    localStorage.setItem("theme", d ? "dark" : "light");
  };
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }
  async function markRead() {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("company_id", current!.company.id).is("read_at", null);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5 text-sidebar-accent-foreground">
        <span className="h-3 w-3 rounded-full brand-dot" />
        <span className="font-display text-2xl">Navalha</span>
      </div>
      {data.list.length > 1 ? (
        <div className="px-3 pb-3">
          <Select value={current.company.id} onValueChange={(v) => { localStorage.setItem("company_id", v); setSelected(v); qc.invalidateQueries(); }}>
            <SelectTrigger className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"><SelectValue /></SelectTrigger>
            <SelectContent>{data.list.map((m) => <SelectItem key={m.company.id} value={m.company.id}>{m.company.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ) : (
        <div className="px-5 pb-3 text-sm text-sidebar-foreground/70">{current.company.name}</div>
      )}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {items.map((n) => (
          <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              path.startsWith(n.to) && "bg-sidebar-accent text-sidebar-accent-foreground")}>
            <n.icon className={cn("h-4 w-4", path.startsWith(n.to) && "text-brand")} /> {n.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3 text-xs">
        <div className="px-2 pb-2 text-sidebar-foreground/60">{ROLE_LABEL[role]}</div>
        <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-sidebar-accent"><LogOut className="h-4 w-4" /> Sair</button>
      </div>
    </div>
  );

  return (
    <CompanyProvider
      value={{
        company: current.company,
        role,
        userId: data.userId,
        memberships: data.list,
        switchCompany: (id) => { localStorage.setItem("company_id", id); setSelected(id); },
        can: (...r) => r.includes(role),
      }}
    >
      <div className="flex min-h-screen" style={hexToken(current.company.accent_color) ? ({ "--brand": current.company.accent_color } as React.CSSProperties) : undefined}>
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 lg:block">{sidebar}</aside>
        <Sheet open={open} onOpenChange={setOpen}><SheetContent side="left" className="w-64 p-0">{sidebar}</SheetContent></Sheet>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></Button>
            <div className="flex-1" />
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Alternar tema">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
                  <Bell className="h-4 w-4" />
                  {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full brand-dot" />}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b p-3 text-sm font-medium">Notificações
                  {unread > 0 && <button onClick={markRead} className="text-xs text-muted-foreground hover:text-foreground">Marcar como lidas</button>}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {(notes ?? []).length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma notificação</div>}
                  {(notes ?? []).map((n) => (
                    <div key={n.id} className={cn("border-b p-3 text-sm", !n.read_at && "bg-muted/50")}>
                      <div className="font-medium">{n.title}</div>
                      <div className="text-muted-foreground">{n.body}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{fmtDateTime(n.created_at)}</div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </header>
          <main className="flex-1 p-4 md:p-8"><Outlet /></main>
        </div>
      </div>
    </CompanyProvider>
  );
}
