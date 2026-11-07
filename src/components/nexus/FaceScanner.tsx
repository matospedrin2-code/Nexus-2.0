import { useCallback, useEffect, useRef, useState } from "react";
import { CameraOff, ScanFace, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyFace } from "@/lib/nexus";
import { setOrbState } from "@/lib/orbBus";

type ScanState = "idle" | "camera" | "scanning" | "verified" | "rejected" | "unavailable";

interface FaceScannerProps {
  onResult: (verified: boolean) => void;
}

/** Scanner biométrico: getUserMedia → frame JPEG → Gemini Vision → validação */
export default function FaceScanner({ onResult }: FaceScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<ScanState>("idle");
  const [message, setMessage] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = async () => {
    setState("camera");
    setMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setState("unavailable");
      setMessage("Câmera indisponível ou permissão negada. É possível prosseguir em modo manual, senhor.");
    }
  };

  const scan = async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current || !video.videoWidth) return;
    setState("scanning");
    setMessage("Analisando biometria facial com o núcleo visual…");
    setOrbState("thinking", 0.7);

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
      if (result.verified) {
        setState("verified");
        setMessage(result.detail);
        stopCamera();
        onResult(true);
      } else {
        setState("rejected");
        setMessage(result.detail);
      }
    } catch {
      setState("rejected");
      setMessage("Falha na comunicação com o módulo biométrico.");
    } finally {
      setOrbState("idle", 0.25);
    }
  };

  const statusBadge = {
    idle: { label: "BIOMETRIA EM ESPERA", tone: "text-cyan-400" },
    camera: { label: "CÂMERA ATIVA", tone: "text-cyan-300" },
    scanning: { label: "ESCANEANDO…", tone: "text-amber-300 animate-[nexus-blink_1s_ease-in-out_infinite]" },
    verified: { label: "IDENTIDADE CONFIRMADA", tone: "text-emerald-400" },
    rejected: { label: "ROSTO NÃO RECONHECIDO", tone: "text-red-400" },
    unavailable: { label: "CÂMERA INDISPONÍVEL", tone: "text-red-400" },
  }[state];

  return (
    <section
      className="hud-brackets relative rounded-lg border border-cyan-500/30 bg-slate-950/75 p-5 shadow-[0_0_25px_rgba(0,240,255,0.08)] backdrop-blur-xl"
      data-testid="nexus-face-scanner"
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-400/80">
          Verificação Facial
        </h2>
        <span className={`font-mono text-[11px] uppercase tracking-[0.2em] ${statusBadge.tone}`}>
          {statusBadge.label}
        </span>
      </header>

      <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-md border border-cyan-500/40 bg-[#02060f]">
        <video
          ref={videoRef}
          className={`h-full w-full -scale-x-100 object-cover transition-opacity ${
            state === "idle" || state === "unavailable" ? "opacity-0" : "opacity-100"
          }`}
          muted
          playsInline
          aria-label="Pré-visualização da câmera para verificação facial"
        />

        {/* Mira central holográfica */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="relative h-3/5 w-1/2 rounded-[50%] border-2 border-dashed border-cyan-400/60 shadow-[0_0_18px_rgba(0,240,255,0.35)]" />
        </div>

        {/* Linha de varredura */}
        {state === "scanning" && (
          <div
            className="pointer-events-none absolute left-0 h-[8%] w-full animate-[nexus-scan_1.6s_linear_infinite] bg-gradient-to-b from-transparent via-cyan-400/40 to-transparent"
            aria-hidden="true"
          />
        )}

        {(state === "idle" || state === "unavailable") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
            <CameraOff className="size-8 text-cyan-400/60" aria-hidden="true" />
            <p className="font-mono text-xs uppercase tracking-[0.25em]">Sensor óptico desativado</p>
          </div>
        )}

        {state === "verified" && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-950/40">
            <ShieldCheck className="size-14 text-emerald-400 drop-shadow-[0_0_16px_rgba(74,222,128,0.6)]" aria-hidden="true" />
          </div>
        )}

        {state === "rejected" && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-950/40">
            <ShieldAlert className="size-14 text-red-400 drop-shadow-[0_0_16px_rgba(248,113,113,0.6)]" aria-hidden="true" />
          </div>
        )}
      </div>

      <p className="mt-4 min-h-5 text-center text-sm text-slate-400" data-testid="nexus-face-status">
        {message}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        {(state === "idle" || state === "unavailable" || state === "rejected") && (
          <Button onClick={startCamera} data-testid="nexus-scan-face-btn">
            <ScanFace className="size-4" aria-hidden="true" />
            Ativar câmera
          </Button>
        )}
        {state === "camera" && (
          <Button onClick={scan} data-testid="nexus-scan-capture-btn">
            <ScanFace className="size-4" aria-hidden="true" />
            Executar escaneamento
          </Button>
        )}
        <Button variant="outline" onClick={() => onResult(false)} data-testid="nexus-scan-bypass-btn">
          Prosseguir sem verificação
        </Button>
      </div>
    </section>
  );
}
