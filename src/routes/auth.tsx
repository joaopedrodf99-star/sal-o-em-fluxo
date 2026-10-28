import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Office Cabelos App" },
      { name: "description", content: "Acesse o painel de gestão do seu salão ou barbearia." },
      { property: "og:title", content: "Entrar — Office Cabelos App" },
      { property: "og:description", content: "Acesse o painel de gestão do seu salão ou barbearia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos" : error.message);
    nav({ to: "/dashboard" });
  }
  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("A senha precisa ter ao menos 8 caracteres");
    setBusy(true);
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name } } });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Confirme seu e-mail para entrar.");
  }
  async function forgot() {
    if (!email) return toast.error("Informe seu e-mail");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) return toast.error(error.message);
    toast.success("Enviamos um link de recuperação para seu e-mail");
  }
  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) return toast.error("Não foi possível entrar com Google");
    if (r.redirected) return;
    nav({ to: "/dashboard" });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2 text-sidebar-accent-foreground">
          <span className="h-3 w-3 rounded-full brand-dot" /> Office Cabelos App
        </div>
        <div>
          <h1 className="text-6xl leading-tight text-sidebar-accent-foreground">
            A agenda que entende <em className="text-brand">pausas químicas</em>.
          </h1>
          <p className="mt-6 max-w-md text-sidebar-foreground/70">Agenda por etapas, caixa, comissões e estoque integrados — do agendamento ao recibo.</p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">Seus dados isolados por estabelecimento • LGPD</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 text-foreground lg:hidden"><span className="h-3 w-3 rounded-full brand-dot" /> Office Cabelos App</div>
          <h2 className="mb-6 text-4xl">Bem-vindo</h2>
          <Tabs defaultValue="in">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="in">Entrar</TabsTrigger>
              <TabsTrigger value="up">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="in">
              <form onSubmit={signIn} className="space-y-4 pt-4">
                <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Senha</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button className="w-full" disabled={busy}>Entrar</Button>
                <button type="button" onClick={forgot} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">Esqueci minha senha</button>
              </form>
            </TabsContent>
            <TabsContent value="up">
              <form onSubmit={signUp} className="space-y-4 pt-4">
                <div className="space-y-1.5"><Label>Seu nome</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Senha (mín. 8)</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button className="w-full" disabled={busy}>Criar conta</Button>
              </form>
            </TabsContent>
          </Tabs>
          <div className="my-4 text-center text-xs text-muted-foreground">ou</div>
          <Button variant="outline" className="w-full" onClick={google}>Continuar com Google</Button>
        </div>
      </div>
    </div>
  );
}
