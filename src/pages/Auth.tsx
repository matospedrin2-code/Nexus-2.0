import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import FaceScanner from "@/components/nexus/FaceScanner";
import VoiceWakeController from "@/components/nexus/VoiceWakeController";

const BOOT_LINES = [
  "NEXUS OS 3.2.1 — inicializando núcleo executivo…",
  "Módulos: [RSS AO VIVO] [CLIMA] [FINANÇAS] [BIOMETRIA] [GOOGLE AGENDA] — operacionais",
  "Canal de inteligência: Gemini 2.5 Flash — conectado em tempo real",
  "Periféricos: câmera + microfone em espera de autorização",
  "Aguardando o Senhor…",
];

export default function Auth() {
  const navigate = useNavigate();
  const [bootCount, setBootCount] = useState(0);
  const [proceeding, setProceeding] = useState(false);

  useEffect(() => {
    if (bootCount >= BOOT_LINES.length) return;
    const id = window.setTimeout(() => setBootCount((count) => count + 1), 500);
    return () => window.clearTimeout(id);
  }, [bootCount]);

  const handleResult = (verified: boolean) => {
    if (proceeding) return;
    setProceeding(true);
    sessionStorage.setItem("nexus_auto_briefing", "1");
    sessionStorage.setItem("nexus_face_verified", verified ? "1" : "0");
    if (verified) {
      toast.success("Identidade confirmada — bem-vindo, senhor.");
    } else {
      toast.info("Acesso autorizado — prosseguindo ao HUD, senhor.");
    }
    window.setTimeout(() => navigate("/"), verified ? 1200 : 400);
  };

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="flex items-center justify-between">
        <Link
          to="/"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
          data-testid="nexus-auth-back-link"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Voltar ao HUD
        </Link>
        <Badge variant="outline" className="font-mono tracking-[0.25em]">
          LOCKSCREEN BIOMÉTRICO
        </Badge>
      </header>

      <section
        className="hud-brackets rounded-lg border border-cyan-500/30 bg-slate-950/75 p-5 font-mono text-sm leading-relaxed text-cyan-100 shadow-[0_0_25px_rgba(0,240,255,0.08)] backdrop-blur-xl"
        data-testid="nexus-boot-console"
        aria-live="polite"
      >
        {BOOT_LINES.slice(0, bootCount).map((line) => (
          <p key={line} className="animate-[nexus-flicker_2s_linear]">
            <span className="text-cyan-400/60">&gt;</span> {line}
          </p>
        ))}
        {bootCount < BOOT_LINES.length && (
          <p className="animate-[nexus-blink_1s_steps(2)_infinite] text-cyan-400">▌</p>
        )}
      </section>

      <FaceScanner onResult={handleResult} />
      <VoiceWakeController onWake={(_phrase) => handleResult(false)} />

      {proceeding && (
        <p
          className="animate-[nexus-flicker_2s_linear] text-center font-mono text-sm uppercase tracking-[0.3em] text-cyan-300"
          data-testid="nexus-auth-proceeding"
        >
          Autorizado — transferindo ao centro de comando…
        </p>
      )}
    </div>
  );
}
