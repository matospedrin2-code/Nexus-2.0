import { motion, AnimatePresence } from "motion/react";
import { Box, ChevronDown, ChevronUp } from "lucide-react";
import FloatingCardStream from "@/components/nexus/FloatingCardStream";
import type { BriefingCard } from "@/lib/nexus";

interface HolographicDataCubeProps {
  cards: BriefingCard[];
  revealed: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onDismissCard?: (index: number) => void;
}

/**
 * Micro-Cápsula Holográfica do NEXUS (estilo JARVIS discreto):
 * Substitui elementos volumosos por uma micro-ancoragem HUD minimalista,
 * ocupando quase zero espaço na tela para que o Orbe central do NEXUS reine absoluto.
 */
export default function HolographicDataCube({
  cards,
  revealed,
  isCollapsed,
  onToggleCollapse,
  onDismissCard,
}: HolographicDataCubeProps) {
  if (cards.length === 0) return null;

  return (
    <div
      className="w-full max-w-4xl flex flex-col items-center"
      data-testid="nexus-holographic-data-cube-root"
    >
      <AnimatePresence mode="wait">
        {!isCollapsed ? (
          /* Estado Expandido: Painéis Holográficos Abertos com barra de topo discreta */
          <motion.div
            key="expanded-stream"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full flex flex-col items-center gap-2.5"
          >
            {/* Barra HUD discreta de recolhimento */}
            <div className="flex w-full items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-400/80">
                  Transmissão HUD · {cards.length} Módulos
                </span>
              </div>

              <button
                type="button"
                onClick={onToggleCollapse}
                className="flex items-center gap-1.5 rounded border border-cyan-500/25 bg-slate-950/70 px-2.5 py-1 font-mono text-[10px] tracking-wider text-cyan-300 transition-colors hover:border-cyan-400/60 hover:bg-cyan-950/40 hover:text-white"
                title="Recolher painéis para manter o HUD limpo"
              >
                <span>Recolher</span>
                <ChevronDown className="size-3 text-cyan-400" />
              </button>
            </div>

            {/* Stream de Cards em Sequência */}
            <FloatingCardStream
              cards={cards}
              revealed={revealed}
              onDismiss={onDismissCard}
            />
          </motion.div>
        ) : (
          /* Estado Recolhido: Micro-Cápsula Holográfica Ultra-Discreta estilo JARVIS */
          <motion.div
            key="collapsed-cube"
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex justify-center py-0.5"
          >
            <button
              type="button"
              onClick={onToggleCollapse}
              data-testid="nexus-data-cube-btn"
              className="group relative flex items-center gap-2 rounded-full border border-cyan-500/30 bg-slate-950/80 px-3.5 py-1 backdrop-blur-xl shadow-[0_0_15px_rgba(0,240,255,0.08)] transition-all duration-200 hover:border-cyan-400/70 hover:bg-cyan-950/50 hover:shadow-[0_0_20px_rgba(0,240,255,0.25)] active:scale-95"
              title="Toque para expandir os painéis do briefing"
            >
              {/* Micro-ícone discreto com ponto pulsante */}
              <div className="relative flex size-3.5 items-center justify-center">
                <Box className="size-3.5 text-cyan-400 group-hover:text-cyan-200 transition-colors" />
                <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-cyan-400 animate-ping opacity-75" />
              </div>

              {/* Rótulo minimalista estilo JARVIS */}
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/90 group-hover:text-cyan-100 transition-colors">
                HUD DADOS · {cards.length}
              </span>

              <span className="text-cyan-500/50">|</span>

              <span className="font-mono text-[9px] tracking-wider text-slate-400 group-hover:text-cyan-300/80 transition-colors">
                Abrir
              </span>

              <ChevronUp className="size-3 text-cyan-400/80 group-hover:text-cyan-200 transition-transform group-hover:-translate-y-0.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
