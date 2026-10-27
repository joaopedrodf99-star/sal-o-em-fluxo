import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Layers, Wallet, Package, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Navalha — Gestão para barbearias, salões e estética" },
      { name: "description", content: "Agenda inteligente com etapas e pausas, agendamento online, caixa, comissões e estoque integrados." },
      { property: "og:title", content: "Navalha — Gestão para barbearias, salões e estética" },
      { property: "og:description", content: "Agenda inteligente com etapas e pausas, agendamento online, caixa, comissões e estoque integrados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Layers, t: "Serviços por etapas", d: "Pausas químicas liberam o profissional e reservam a retomada." },
  { icon: CalendarClock, t: "Agenda sem conflitos", d: "Profissionais, cadeiras e lavatórios validados no servidor." },
  { icon: Wallet, t: "Caixa e financeiro", d: "Taxas por modalidade, líquido previsto e fechamento conferido." },
  { icon: Package, t: "Estoque e fichas técnicas", d: "Baixa automática de insumos a cada atendimento." },
  { icon: MessageCircle, t: "Agendamento online", d: "Um link exclusivo para WhatsApp e Instagram." },
  { icon: ShieldCheck, t: "Seguro por padrão", d: "Dados isolados por empresa, auditoria e permissões." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between p-6">
        <div className="flex items-center gap-2 text-sidebar-accent-foreground"><span className="h-3 w-3 rounded-full brand-dot" /> Navalha</div>
        <Button asChild variant="secondary"><Link to="/auth">Entrar</Link></Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <h1 className="max-w-4xl text-6xl leading-[1.05] text-sidebar-accent-foreground md:text-8xl">
          Gestão afiada para quem vive de <em className="text-brand">agenda cheia</em>.
        </h1>
        <p className="mt-8 max-w-xl text-lg text-sidebar-foreground/70">Do agendamento ao recibo: agenda inteligente, caixa, comissões e estoque conversando entre si.</p>
        <Button asChild size="lg" className="mt-10 bg-brand text-sidebar-primary-foreground hover:opacity-90"><Link to="/auth">Começar agora</Link></Button>
        <div className="mt-24 grid gap-px overflow-hidden rounded-xl border border-sidebar-border bg-sidebar-border md:grid-cols-3">
          {features.map((f) => (
            <div key={f.t} className="bg-sidebar p-8">
              <f.icon className="h-5 w-5 text-brand" />
              <h3 className="mt-4 font-semibold text-sidebar-accent-foreground">{f.t}</h3>
              <p className="mt-2 text-sm text-sidebar-foreground/60">{f.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
