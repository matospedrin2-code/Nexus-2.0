import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface DialogueEntry {
  id: string;
  role: "user" | "nexus";
  text: string;
  at?: string;
}

/** Linha do NEXUS com efeito máquina de escrever. */
function Typewriter({ text, onDone }: { text: string; onDone?: () => void }) {
  const [shown, setShown] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    setShown(0);
    doneRef.current = false;
    const step = Math.max(1, Math.round(text.length / 240));
    const id = window.setInterval(() => {
      setShown((s) => {
        const next = Math.min(text.length, s + step);
        if (next >= text.length && !doneRef.current) {
          doneRef.current = true;
          window.clearInterval(id);
          onDone?.();
        }
        return next;
      });
    }, 28);
    return () => window.clearInterval(id);
    // onDone é estável no chamador; a linha é recriada por texto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <span>
      {text.slice(0, shown)}
      {shown < text.length && (
        <span className="animate-[nexus-blink_1s_steps(2)_infinite] text-cyan-400">▌</span>
      )}
    </span>
  );
}

interface NexusDialogueFeedProps {
  entries: DialogueEntry[];
  live: { id: string; text: string } | null;
  notice?: string | null;
  onLiveDone?: () => void;
}

/** Fluxo terminal do diálogo: falas do NEXUS (ciano, brilho) e do Senhor. */
export default function NexusDialogueFeed({ entries, live, notice, onLiveDone }: NexusDialogueFeedProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length, live?.id, notice]);

  return (
    <div
      className="max-h-[42vh] min-h-56 space-y-4 overflow-y-auto pr-1"
      data-testid="nexus-dialogue-output"
      aria-live="polite"
    >
      {entries.length === 0 && !live && !notice && (
        <p className="font-mono text-sm text-cyan-400/70">
          NEXUS em silêncio operacional — emita o briefing matinal, senhor.
        </p>
      )}
      {notice && (
        <p className="font-mono text-sm text-cyan-300 animate-[nexus-blink_1.2s_ease-in-out_infinite]">
          {notice}
        </p>
      )}
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={cn("flex", entry.role === "user" ? "justify-end" : "justify-start")}
        >
          <div
            className={cn(
              "max-w-[90%] rounded-md border px-4 py-3 text-sm leading-relaxed",
              entry.role === "user"
                ? "border-slate-600/50 bg-slate-800/60 text-slate-200"
                : "border-cyan-500/30 bg-slate-950/75 font-mono text-base text-cyan-100 drop-shadow-[0_0_12px_rgba(0,240,255,0.35)]",
            )}
          >
            <span
              className={cn(
                "mr-2 font-mono text-[10px] uppercase tracking-[0.25em]",
                entry.role === "user" ? "text-slate-400" : "text-cyan-400/80",
              )}
            >
              {entry.role === "user" ? "SENHOR" : "NEXUS"}
            </span>
            {entry.text}
          </div>
        </div>
      ))}
      {live && (
        <div className="flex justify-start">
          <div className="max-w-[90%] rounded-md border border-cyan-500/30 bg-slate-950/75 px-4 py-3 font-mono text-base leading-relaxed text-cyan-100 drop-shadow-[0_0_12px_rgba(0,240,255,0.35)]">
            <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-400/80">
              NEXUS
            </span>
            <Typewriter text={live.text} onDone={onLiveDone} />
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}