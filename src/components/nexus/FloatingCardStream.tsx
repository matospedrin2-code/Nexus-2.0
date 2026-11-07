import { motion } from "motion/react";
import { CalendarDays, CloudSun, HeartPulse, LayoutGrid, Mail, Newspaper, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BriefingCard } from "@/lib/nexus";

const ICONS: Record<string, typeof CloudSun> = {
  clima: CloudSun,
  agenda: CalendarDays,
  emails: Mail,
  noticias: Newspaper,
  saude: HeartPulse,
};

interface FloatingCardStreamProps {
  cards: BriefingCard[];
  revealed: number;
  onDismiss?: (index: number) => void;
}

/** Painéis glassmorphism que surgem em sequência conforme as tags [CARD_*] chegam. */
export default function FloatingCardStream({ cards, revealed, onDismiss }: FloatingCardStreamProps) {
  const visible = cards.slice(0, Math.max(0, revealed));
  if (visible.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="nexus-card-stream">
      {visible.map((card, index) => {
        const Icon = ICONS[card.type] ?? LayoutGrid;
        return (
          <motion.article
            key={`${card.type}-${index}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            data-testid={`nexus-card-${card.type}`}
            className="hud-brackets relative rounded-lg border border-cyan-500/25 bg-slate-950/70 p-5 shadow-[0_0_25px_rgba(0,240,255,0.06)] backdrop-blur-xl"
          >
            <header className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-cyan-400" aria-hidden="true" />
                <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan-400/80">
                  {card.title}
                </h3>
              </div>
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onDismiss(index)}
                  aria-label={`Fechar painel ${card.title}`}
                  data-testid={`nexus-card-close-${card.type}`}
                  className="text-slate-500"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </Button>
              )}
            </header>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {card.content}
            </p>
          </motion.article>
        );
      })}
    </div>
  );
}