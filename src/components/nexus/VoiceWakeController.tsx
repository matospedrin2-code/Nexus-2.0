import { useEffect, useRef, useState } from "react";
import { Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listenOnce, recognitionSupported } from "@/lib/speech";

interface VoiceWakeControllerProps {
  onWake: (phrase: string, via: "voz" | "manual") => void;
}

/** Frase de ativação "NEXUS, bom dia" — reconhecimento por voz com fallback manual. */
export default function VoiceWakeController({ onWake }: VoiceWakeControllerProps) {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cancelRef.current?.(), []);

  const normalized = (text: string) =>
    text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const startListening = () => {
    setError("");
    setHeard("");
    if (!recognitionSupported()) {
      setError("Reconhecimento de voz não suportado neste navegador — registre a frase manualmente, senhor.");
      return;
    }
    setListening(true);
    cancelRef.current = listenOnce({
      onPartial: setHeard,
      onFinal: (text) => {
        setHeard(text);
        const flat = normalized(text);
        if (flat.includes("nexus") || flat.includes("nexo") || flat.includes("next") || flat.includes("bom dia")) {
          onWake(text, "voz");
        } else {
          setError('Frase de ativação não reconhecida. Tente dizer: "NEXUS, bom dia".');
        }
      },
      onError: setError,
      onEnd: () => setListening(false),
    });
  };

  const submitManual = () => {
    const phrase = manual.trim();
    if (!phrase) return;
    onWake(phrase, "manual");
  };

  return (
    <section
      className="hud-brackets relative rounded-lg border border-cyan-500/30 bg-slate-950/75 p-5 shadow-[0_0_25px_rgba(0,240,255,0.08)] backdrop-blur-xl"
      data-testid="nexus-voice-wake"
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-400/80">
          Frase de Ativação
        </h2>
        <span
          className={`font-mono text-[11px] uppercase tracking-[0.2em] ${
            listening ? "animate-[nexus-blink_1s_ease-in-out_infinite] text-amber-300" : "text-cyan-400/70"
          }`}
        >
          {listening ? "OUVINDO…" : "EM ESPERA"}
        </span>
      </header>

      <div className="flex flex-col items-center gap-4">
        <Button
          size="lg"
          variant={listening ? "secondary" : "default"}
          onClick={startListening}
          data-testid="nexus-wake-mic-btn"
          aria-label="Ativar microfone e emitir a frase de ativação"
        >
          <Mic className="size-5" aria-hidden="true" />
          {listening ? "Ouvindo…" : 'Dizer "NEXUS, bom dia"'}
        </Button>

        {heard && (
          <p className="font-mono text-sm text-cyan-200" data-testid="nexus-wake-heard">
            » {heard}
          </p>
        )}

        {error && (
          <p className="text-sm text-red-400" data-testid="nexus-wake-error">
            {error}
          </p>
        )}

        <div className="flex w-full max-w-md items-center gap-2">
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitManual()}
            placeholder='Ou registre a frase manualmente: "NEXUS, bom dia"'
            aria-label="Registro manual da frase de ativação"
            data-testid="nexus-wake-input"
          />
          <Button variant="outline" onClick={submitManual} data-testid="nexus-wake-fallback-btn">
            <Send className="size-4" aria-hidden="true" />
            Transmitir
          </Button>
        </div>
      </div>
    </section>
  );
}
