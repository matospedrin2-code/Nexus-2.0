import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { fetchMemory } from "@/lib/nexus";

const KIND_LABEL: Record<string, string> = {
  briefing: "BRIEFING",
  user: "SENHOR",
  nexus: "NEXUS",
};

/** Gaveta da memória persistente — briefings e conversa arquivados no Mongo. */
export default function MemoryTimelineDrawer() {
  const memoryQuery = useQuery({
    queryKey: ["memory"],
    queryFn: () => fetchMemory(40),
    refetchOnWindowFocus: false,
    retry: false,
  });
  const events = memoryQuery.data ?? [];

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" data-testid="nexus-open-memory-btn" aria-label="Abrir memória persistente" />
        }
      >
        <History className="size-4" aria-hidden="true" />
        Memória
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto border-cyan-500/30 bg-[#050d1c]/95 sm:max-w-md" data-testid="nexus-memory-drawer">
        <SheetHeader>
          <SheetTitle className="font-heading text-lg uppercase tracking-widest text-cyan-300">
            Memória Persistente
          </SheetTitle>
          <SheetDescription className="text-slate-400">
            Tudo o que foi dito fica arquivado — o NEXUS lembra mesmo depois de fechar o app, senhor.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-2 space-y-3 px-4 pb-6" data-testid="nexus-memory-timeline">
          {memoryQuery.isPending && (
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-400/70">
              Sincronizando arquivo…
            </p>
          )}
          {memoryQuery.isSuccess && events.length === 0 && (
            <p className="text-sm text-slate-400">
              Arquivo vazio — nenhum registro ainda, senhor.
            </p>
          )}
          {events.map((event) => (
            <article
              key={`${event.kind}-${event.id}`}
              className="rounded-md border border-cyan-500/20 bg-slate-950/70 p-3"
              data-testid={`nexus-memory-item-${event.kind}`}
            >
              <header className="mb-1 flex items-center justify-between gap-2">
                <Badge variant={event.kind === "briefing" ? "default" : "secondary"}>
                  {KIND_LABEL[event.kind] ?? event.kind}
                </Badge>
                <time className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  {format(new Date(event.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </time>
              </header>
              <p className="line-clamp-4 text-sm leading-relaxed text-slate-300">{event.text}</p>
            </article>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}