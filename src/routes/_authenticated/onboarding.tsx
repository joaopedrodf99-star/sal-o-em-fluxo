import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Cadastrar estabelecimento — Navalha" }] }),
  component: Onboarding,
});

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function Onboarding() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("create_company", { _name: name, _slug: slug });
    setBusy(false);
    if (error) return toast.error(error.message.includes("companies_slug_key") ? "Este link já está em uso" : error.message);
    localStorage.setItem("company_id", data as string);
    toast.success("Estabelecimento criado!");
    nav({ to: "/dashboard" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={create} className="w-full max-w-md space-y-5">
        <h1 className="text-5xl">Seu estabelecimento</h1>
        <p className="text-muted-foreground">Você será o administrador. Depois poderá convidar sua equipe.</p>
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input required value={name} onChange={(e) => { setName(e.target.value); setSlug(slugify(e.target.value)); }} placeholder="Barbearia do João" />
        </div>
        <div className="space-y-1.5">
          <Label>Link de agendamento</Label>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">/agendar/<Input required value={slug} onChange={(e) => setSlug(slugify(e.target.value))} /></div>
        </div>
        <Button className="w-full" disabled={busy}>Criar</Button>
      </form>
    </div>
  );
}
