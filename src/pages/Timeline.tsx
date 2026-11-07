import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { fetchMemory } from "@/lib/nexus";

const KIND_LABEL: Record<string, string> = {
  briefing: "BRIEFING",
  user: "SENHOR",
  nexus: "NEXUS",
};

export default function Timeline() {
  const memoryQuery = useQuery({
    queryKey: ["memory"],
    queryFn: () => fetchMemory(200),
    refetchOnWindowFocus: false,
    retry: false,
  });
  const events = memoryQuery.data ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="hud-glow font-heading text-3xl font-black uppercase tracking-tighter text-cyan-300">
            Memória Persistente
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.25em] text-cyan-400/70">
            Arquivo completo — o NEXUS não esquece nada, senhor
          </p>
        </div>
        <Link
          to="/"
          className={buttonVariants({ variant: "outline", size: "sm" })}
          data-testid="nexus-timeline-back-link"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Voltar ao HUD
        </Link>
      </header>

      <main className="space-y-4" data-testid="nexus-timeline-list">
        {memoryQuery.isPending && (
          <p className="font-mono text-sm text-cyan-400/70" data-testid="nexus-timeline-loading">
            Sincronizando arquivo de memória…
          </p>
        )}
        {memoryQuery.isSuccess && events.length === 0 && (
          <p className="text-sm text-slate-400" data-testid="nexus-timeline-empty">
            Arquivo vazio — nenhum briefing ou conversa registrada ainda, senhor.
          </p>
        )}
        {events.map((event) => (
          <article
            key={`${event.kind}-${event.id}`}
            className="hud-brackets rounded-lg border border-cyan-500/25 bg-slate-950/70 p-4 backdrop-blur-xl"
            data-testid={`nexus-memory-item-${event.kind}`}
          >
            <header className="mb-2 flex items-center justify-between gap-3">
              <Badge variant={event.kind === "briefing" ? "default" : "secondary"}>
                <History className="mr-1 size-3" aria-hidden="true" />
                {KIND_LABEL[event.kind] ?? event.kind}
              </Badge>
              <time className="font-mono text-[11px] uppercase tracking-widest text-slate-500">
                {format(new Date(event.created_at), "EEEE · dd 'de' MMMM 'de' yyyy · HH:mm", {
                  locale: ptBR,
                })}
              </time>
            </header>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{event.text}</p>
            {event.cards.length > 0 && (
              <footer className="mt-3 flex flex-wrap gap-2">
                {event.cards.map((card) => (
                  <Badge key={card.type} variant="outline" className="font-mono text-[10px]">
                    {card.title}
                  </Badge>
                ))}
              </footer>
            )}
          </article>
        ))}
      </main>
    </div>
  );
}