import { useEffect, useRef, useState } from "react";
import { Camera, X, Eye, Maximize2, Minimize2, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiquidGlassCameraProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Módulo Óptico NEXUS — Câmera Compacta em Estilo Picture-in-Picture (PiP)
 * Design holográfico ultra-compacto e elegante: ocupa o mínimo de espaço na tela,
 * inicializada DESLIGADA e ativada exclusivamente sob comando ("abrir câmera").
 */
export default function LiquidGlassCamera({ isOpen, onClose }: LiquidGlassCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [fps, setFps] = useState(30);

  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setActive(false);
      setError(null);
      return;
    }

    let isMounted = true;

    async function startCamera() {
      try {
        setError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setActive(true);
      } catch (err: any) {
        if (!isMounted) return;
        setError(
          err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
            ? "Permissão negada"
            : "Vídeo indisponível"
        );
        setActive(false);
      }
    }

    startCamera();

    const interval = setInterval(() => {
      setFps(29 + Math.floor(Math.random() * 3));
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  // Expõe a função de captura para a inteligência visual do NEXUS
  useEffect(() => {
    if (active && videoRef.current) {
      (window as any).__nexusCaptureCameraFrame = (): string | null => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return null;
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext("2d");
          if (!ctx) return null;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL("image/jpeg", 0.8);
        } catch (e) {
          console.warn("Falha ao capturar frame do módulo óptico:", e);
          return null;
        }
      };
    } else {
      delete (window as any).__nexusCaptureCameraFrame;
    }

    return () => {
      delete (window as any).__nexusCaptureCameraFrame;
    };
  }, [active]);

  if (!isOpen) return null;

  return (
    <aside
      className={`fixed z-50 transition-all duration-300 ease-out ${
        expanded
          ? "right-3 top-16 w-[clamp(260px,78vw,360px)]"
          : "right-3 bottom-24 sm:bottom-28 landscape:top-14 landscape:bottom-auto landscape:right-2 w-44 sm:w-52 landscape:w-40"
      }`}
      aria-label="Câmera do NEXUS"
      style={{
        backgroundColor: "rgba(15, 23, 42, 0.88)",
        border: "1px solid rgba(0, 240, 255, 0.4)",
        borderRadius: "16px",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 240, 255, 0.2)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
      data-testid="nexus-liquid-glass-camera"
    >
      {/* Header Compacto do HUD Óptico */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Eye className="size-3 text-cyan-400 animate-pulse shrink-0" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300 truncate">
            Óptico {active ? `${fps}fps` : "..."}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded((prev) => !prev)}
            className="size-6 text-slate-300 hover:text-cyan-200"
            title={expanded ? "Diminuir" : "Expandir"}
            aria-label={expanded ? "Diminuir câmera" : "Expandir câmera"}
          >
            {expanded ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-6 text-slate-400 hover:text-red-300 hover:bg-red-950/40"
            title="Fechar câmera"
            aria-label="Desligar e fechar câmera"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Visor de Vídeo Compacto (Espelhado) */}
      <div className="p-1.5">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black/80 border border-cyan-500/30">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center p-2 text-center">
              <VideoOff className="size-5 text-amber-400 mb-1" />
              <p className="font-mono text-[10px] text-amber-300">{error}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover -scale-x-100"
              />

              {/* Retículos Holográficos discretos */}
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-1.5">
                <div className="flex justify-between">
                  <span className="border-t-2 border-l-2 border-cyan-400 size-2" />
                  <span className="border-t-2 border-r-2 border-cyan-400 size-2" />
                </div>
                <div className="flex justify-between">
                  <span className="border-b-2 border-l-2 border-cyan-400 size-2" />
                  <span className="border-b-2 border-r-2 border-cyan-400 size-2" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
