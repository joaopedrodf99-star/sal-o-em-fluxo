import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — Navalha" },
      { name: "description", content: "Defina uma nova senha de acesso." },
      { property: "og:title", content: "Nova senha — Navalha" },
      { property: "og:description", content: "Defina uma nova senha de acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const nav = useNavigate();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Mínimo 8 caracteres");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada");
    nav({ to: "/dashboard" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={save} className="w-full max-w-sm space-y-4">
        <h1 className="text-4xl">Nova senha</h1>
        <Input type="password" placeholder="Nova senha" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button className="w-full">Salvar</Button>
      </form>
    </div>
  );
}
