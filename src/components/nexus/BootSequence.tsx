import { useCallback, useEffect, useRef, useState } from "react";
import { ScanFace, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playBootSound, playConfirm, startHum } from "@/lib/bootSound";
import { verifyFace } from "@/lib/nexus";
import { setOrbState } from "@/lib/orbBus";
import { warmVoices } from "@/lib/speech";

type Phase = "gate" | "booting" | "camera" | "scanning" | "verified" | "rejected" | "done";

const BOOT_LINES = [
  "NEXUS OS — energizando núcleo…",
  "Módulos [CLIMA] [MERCADO] [RSS] [BIOMETRIA] — operacionais",
  "Canal de inteligência Gemini 2.5 Flash — pronto",
  "Sensor óptico — iniciando varredura facial",
];

interface BootSequenceProps {
  /** Dispara quando a identificação termina (verificada ou não). */
  onComplete: (faceVerified: boolean) => void;
}

/**
 * Boot automático do NEXUS: um toque libera áudio e câmera (exigência do
 * navegador), então som de inicialização, console, varredura facial e handoff.
 */
export default function BootSequence({ onComplete }: BootSequenceProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const completedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("gate");
  const [lines, setLines] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const finish = useCallback(
    (verified: boolean, detail: string) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setMessage(detail);
      setPhase(verified ? "verified" : "rejected");
      playConfirm(verified);
      stopCamera();
      window.setTimeout(() => {
        setPhase("done");
        onComplete(verified);
      }, 1500);
    },
    [onComplete, stopCamera],
  );

  const scan = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      finish(false, "Sem imagem utilizável do sensor óptico.");
      return;
    }
    setPhase("scanning");
    setMessage("Analisando biometria facial…");
    setOrbState("thinking", 0.75);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 360;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas indisponível");
      const side = Math.min(video.videoWidth, video.videoHeight);
      ctx.drawImage(
        video,
        (video.videoWidth - side) / 2,
        (video.videoHeight - side) / 2,
        side,
        side,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const result = await verifyFace(canvas.toDataURL("image/jpeg", 0.85));
      finish(result.verified, result.detail);
    } catch {
      finish(false, "Módulo biométrico indisponível — prosseguindo sem verificação.");
    } finally {
      setOrbState("idle", 0.25);
    }
  }, [finish]);

  /** Único gesto do Senhor: libera áudio (autoplay) e permissão de câmera. */
  const startBoot = async () => {
    setPhase("booting");
    warmVoices();
    playBootSound();
    startHum();

    // Console progressivo
    BOOT_LINES.forEach((line, index) => {
      window.setTimeout(() => setLines((prev) => [...prev, line]), 420 + index * 460);
    });

    // Câmera em paralelo ao console
    window.setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        });
        streamRef.current = stream;
        setPhase("camera");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setMessage("Alinhe o rosto ao retículo, senhor.");
        window.setTimeout(() => void scan(), 2600); // varredura automática
      } catch {
        finish(false, "Câmera indisponível ou permissão negada — operando sem verificação biométrica.");
      }
    }, 900);
  };

  if (phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[#030712]/97 px-4 backdrop-blur-sm"
      data-testid="nexus-boot-overlay"
    >
      {phase === "gate" ? (
        <div className="flex max-w-md flex-col items-center gap-6 text-center">
          <h1 className="hud-glow font-heading text-5xl font-black uppercase tracking-tighter text-cyan-300">
            NEXUS
          </h1>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-400/70">
            Neural Executive System for Universal Support
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs justify-center">
            <Button size="lg" onClick={startBoot} data-testid="nexus-boot-start-btn">
              <ScanFace className="size-5" aria-hidden="true" />
              Iniciar sistema
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                warmVoices();
                playBootSound();
                finish(false, "Iniciado diretamente pelo Senhor.");
              }}
              data-testid="nexus-boot-direct-btn"
            >
              Iniciar direto
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            Um toque libera áudio e câmera — exigência do navegador. Em seguida o NEXUS
            inicializa e transmite o briefing automaticamente.
          </p>
        </div>
      ) : (
        <div className="flex w-full max-w-lg flex-col items-center gap-6">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-cyan-500/40 bg-[#02060f]">
            <video
              ref={videoRef}
              className={`h-full w-full -scale-x-100 object-cover transition-opacity duration-500 ${phase === "booting" ? "opacity-0" : "opacity-100"}`}
              muted
              playsInline
              aria-label="Varredura facial do NEXUS"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <div className="h-3/5 w-1/2 rounded-[50%] border-2 border-dashed border-cyan-400/60 shadow-[0_0_22px_rgba(0,240,255,0.4)]" />
            </div>
            {(phase === "scanning" || phase === "camera") && (
              <div
                className="pointer-events-none absolute left-0 h-[9%] w-full animate-[nexus-scan_1.5s_linear_infinite] bg-gradient-to-b from-transparent via-cyan-400/45 to-transparent"
                aria-hidden="true"
              />
            )}
            {phase === "verified" && (
              <div className="absolute inset-0 flex items-center justify-center bg-emerald-950/45">
                <ShieldCheck className="size-16 text-emerald-400 drop-shadow-[0_0_18px_rgba(74,222,128,0.7)]" aria-hidden="true" />
              </div>
            )}
            {phase === "rejected" && (
              <div className="absolute inset-0 flex items-center justify-center bg-amber-950/40">
                <ShieldAlert className="size-16 text-amber-400 drop-shadow-[0_0_18px_rgba(251,191,36,0.6)]" aria-hidden="true" />
              </div>
            )}
          </div>

          <div
            className="w-full font-mono text-xs leading-relaxed text-cyan-200"
            data-testid="nexus-boot-console"
            aria-live="polite"
          >
            {lines.map((line) => (
              <p key={line}>
                <span className="text-cyan-400/60">&gt;</span> {line}
              </p>
            ))}
            {message && <p className="mt-1 text-cyan-300">&gt; {message}</p>}
          </div>

          {phase === "camera" && (
            <Button variant="outline" size="sm" onClick={() => void scan()} data-testid="nexus-boot-scan-now-btn">
              Escanear agora
            </Button>
          )}
          {(phase === "booting" || phase === "camera" || phase === "scanning") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => finish(false, "Verificação dispensada pelo Senhor.")}
              data-testid="nexus-boot-skip-btn"
            >
              Pular verificação
            </Button>
          )}
        </div>
      )}
    </div>
  );
}