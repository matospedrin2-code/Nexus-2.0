import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  LogOut,
  RefreshCw,
  ShieldAlert,
  User,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  JARVIS_VOICES,
  getSelectedVoiceId,
  setSelectedVoiceId,
  speak,
  speechSynthSupported,
} from "@/lib/speech";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  fetchTodayCalendarEvents,
  subscribeToCalendarAuth,
  type GoogleCalendarItem,
  type GoogleCalendarState,
} from "@/lib/googleCalendar";

export default function Settings() {
  const [voiceOn, setVoiceOn] = useState(() => localStorage.getItem("nexus_voice_on") !== "0");
  const [selectedVoice, setSelectedVoice] = useState(getSelectedVoiceId);
  const [rate, setRate] = useState(() => Number(localStorage.getItem("nexus_rate") ?? "1"));
  const [pitch, setPitch] = useState(() => Number(localStorage.getItem("nexus_pitch") ?? "1.0"));
  const [volume, setVolume] = useState(() => Number(localStorage.getItem("nexus_volume") ?? "1"));

  const [calState, setCalState] = useState<GoogleCalendarState>({
    connected: false,
    user: null,
    events: [],
    loading: false,
    error: null,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const unsub = subscribeToCalendarAuth((state) => {
      setCalState(state);
    });
    return unsub;
  }, []);

  const update = (key: string, value: number | string) => localStorage.setItem(key, String(value));

  const handleConnectCalendar = async () => {
    setIsConnecting(true);
    try {
      const result = await connectGoogleCalendar();
      toast.success(
        `Google Agenda conectado com sucesso (${result.user.email || "Conta Google"}).`
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Falha ao conectar com o Google Agenda.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    try {
      await disconnectGoogleCalendar();
      toast.info("Google Agenda desconectado do NEXUS.");
    } catch (err) {
      toast.error("Erro ao desconectar conta.");
    }
  };

  const handleRefreshEvents = async () => {
    setIsRefreshing(true);
    try {
      const events = await fetchTodayCalendarEvents();
      setCalState((prev) => ({ ...prev, events }));
      toast.success(
        events.length > 0
          ? `${events.length} evento(s) de hoje sincronizado(s).`
          : "Agenda de hoje consultada: nenhum compromisso marcado."
      );
    } catch {
      toast.error("Falha ao sincronizar eventos da agenda.");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="hud-glow font-heading text-3xl font-black uppercase tracking-tighter text-cyan-300">
            Configurações
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.25em] text-cyan-400/70">
            Voz, inteligência & Google Agenda do NEXUS
          </p>
        </div>
        <Link
          to="/"
          className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-400/80 hover:text-cyan-300"
          data-testid="nexus-settings-back-link"
        >
          Voltar ao HUD
        </Link>
      </header>

      <main className="space-y-6" data-testid="nexus-settings-panel">
        {/* Bloco 1: Conexão Real com Google Agenda */}
        <section
          className="hud-brackets rounded-lg border border-cyan-500/30 bg-slate-950/75 p-6 backdrop-blur-xl shadow-[0_0_25px_rgba(0,240,255,0.06)]"
          data-testid="nexus-setting-calendar-section"
        >
          <header className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Calendar className="size-5 text-cyan-400" aria-hidden="true" />
              <div>
                <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-cyan-300">
                  Google Agenda (Real)
                </h2>
                <p className="text-xs text-slate-400">
                  Somente leitura — compromissos de hoje integrados ao HUD e ao briefing falado.
                </p>
              </div>
            </div>
            <Badge
              variant={calState.connected ? "default" : "outline"}
              className={`font-mono text-[10px] tracking-wider ${
                calState.connected
                  ? "border-emerald-500/50 bg-emerald-950/70 text-emerald-300"
                  : "border-amber-500/50 text-amber-300"
              }`}
            >
              {calState.connected ? "CONECTADA" : "NÃO CONECTADA"}
            </Badge>
          </header>

          {!calState.connected ? (
            <div className="space-y-4 rounded-md border border-cyan-500/20 bg-slate-900/40 p-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Nenhuma conta do Google Agenda vinculada no momento. Sem a conexão ativa, o painel
                exibirá <strong className="text-cyan-300 font-mono">"Agenda não conectada"</strong>{" "}
                em vez de compromissos fictícios.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleConnectCalendar}
                  disabled={isConnecting}
                  data-testid="nexus-connect-calendar-btn"
                  className="flex items-center gap-3 rounded-md border border-cyan-500/40 bg-slate-950 px-5 py-2.5 font-medium text-cyan-100 shadow-[0_0_15px_rgba(0,240,255,0.15)] transition hover:border-cyan-400 hover:bg-cyan-950/40 disabled:opacity-60"
                >
                  <svg
                    className="size-5 shrink-0"
                    viewBox="0 0 48 48"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span className="font-mono text-sm tracking-wide">
                    {isConnecting ? "Conectando ao Google…" : "Conectar Google Agenda"}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-emerald-500/30 bg-emerald-950/20 p-4">
                <div className="flex items-center gap-3">
                  {calState.user?.photoURL ? (
                    <img
                      src={calState.user.photoURL}
                      alt="Avatar"
                      className="size-10 rounded-full border border-cyan-400/40 object-cover"
                    />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-950/50 text-cyan-300">
                      <User className="size-5" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-emerald-300">
                      <CheckCircle2 className="size-4" />
                      <span>{calState.user?.displayName || "Proprietário"}</span>
                    </div>
                    <p className="font-mono text-xs text-slate-400" data-testid="nexus-connected-email">
                      {calState.user?.email || "Conta conectada"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshEvents}
                    disabled={isRefreshing}
                    data-testid="nexus-refresh-calendar-btn"
                  >
                    <RefreshCw className={`size-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
                    Sincronizar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnectCalendar}
                    className="text-red-400 hover:bg-red-950/30 hover:text-red-300"
                    data-testid="nexus-disconnect-calendar-btn"
                  >
                    <LogOut className="size-3.5 mr-1.5" />
                    Desconectar
                  </Button>
                </div>
              </div>

              {/* Pré-visualização de eventos reais do dia */}
              <div className="rounded-md border border-cyan-500/20 bg-slate-900/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400/80">
                    Compromissos de Hoje no Google Agenda
                  </h3>
                  <span className="font-mono text-[11px] text-slate-400">
                    {calState.events.length} evento{calState.events.length === 1 ? "" : "s"}
                  </span>
                </div>

                {calState.events.length === 0 ? (
                  <p className="font-mono text-xs text-slate-400 italic">
                    Nenhum compromisso agendado para hoje. Pauta livre, senhor.
                  </p>
                ) : (
                  <ul className="space-y-2 font-mono text-xs">
                    {calState.events.map((ev: GoogleCalendarItem) => (
                      <li
                        key={ev.id}
                        className="flex items-start justify-between gap-3 border-b border-cyan-500/10 pb-2 last:border-0"
                      >
                        <div>
                          <p className="font-semibold text-slate-200">{ev.summary}</p>
                          {ev.location && (
                            <p className="text-[11px] text-slate-400">📍 {ev.location}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {ev.timeText}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Bloco 2: Síntese de Voz (JARVIS Neural + Local) */}
        <section className="hud-brackets rounded-lg border border-cyan-500/30 bg-slate-950/75 p-6 backdrop-blur-xl shadow-[0_0_25px_rgba(0,240,255,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-cyan-300">
                Síntese de Voz (Estilo JARVIS)
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Voz neural masculina profunda com afeto e elegância executiva ("Senhor").
              </p>
            </div>
            <Button
              variant={voiceOn ? "default" : "outline"}
              onClick={() => {
                const next = !voiceOn;
                setVoiceOn(next);
                update("nexus_voice_on", next ? "1" : "0");
              }}
              data-testid="nexus-setting-voice-toggle"
            >
              <Volume2 className="size-4" aria-hidden="true" />
              {voiceOn ? "Ativa" : "Silenciada"}
            </Button>
          </div>

          {/* Seletor de Personalidade de Voz do Google (Dipper, Puck/Menino, Charon, Fenrir) */}
          <div className="mt-5 space-y-2">
            <Label className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan-400/80">
              Voz Neural Google AI
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {JARVIS_VOICES.map((v) => {
                const isSelected = selectedVoice === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setSelectedVoice(v.id);
                      setSelectedVoiceId(v.id);
                      toast.success(`Voz alterada para ${v.name}`);
                    }}
                    className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${
                      isSelected
                        ? "border-cyan-400 bg-cyan-950/60 shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                        : "border-cyan-500/20 bg-slate-900/40 hover:border-cyan-500/40 hover:bg-slate-900/80"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-cyan-200">
                        {v.name}
                      </span>
                      {isSelected && (
                        <span className="size-2 rounded-full bg-cyan-400 animate-pulse" />
                      )}
                    </div>
                    <span className="mt-1 text-[11px] text-slate-400">
                      {v.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {[
              {
                label: "Velocidade da locução",
                value: rate,
                min: 0.6,
                max: 1.4,
                step: 0.05,
                key: "nexus_rate",
                testId: "nexus-setting-rate",
                display: `${rate.toFixed(2)}×`,
              },
              {
                label: "Tom da voz (Pitch natural)",
                value: pitch,
                min: 0.8,
                max: 1.2,
                step: 0.05,
                key: "nexus_pitch",
                testId: "nexus-setting-pitch",
                display: pitch.toFixed(2),
              },
              {
                label: "Volume master",
                value: volume,
                min: 0,
                max: 1,
                step: 0.05,
                key: "nexus_volume",
                testId: "nexus-setting-volume",
                display: `${Math.round(volume * 100)}%`,
              },
            ].map((control) => (
              <div key={control.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor={control.testId}
                    className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan-400/70"
                  >
                    {control.label}
                  </Label>
                  <span className="font-mono text-xs text-slate-300">{control.display}</span>
                </div>
                <Input
                  id={control.testId}
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={control.value}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (control.testId === "nexus-setting-rate") setRate(next);
                    if (control.testId === "nexus-setting-pitch") setPitch(next);
                    if (control.testId === "nexus-setting-volume") setVolume(next);
                    update(control.key, next);
                  }}
                  className="accent-cyan-400"
                  data-testid={control.testId}
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() =>
                speak(
                  "Olá senhor! Sistemas online e conectados. Sou o NEXUS com a voz oficial da Google. Em que posso auxiliá-lo hoje?",
                  { rate, pitch, volume }
                )
              }
              data-testid="nexus-setting-test-voice"
            >
              Testar voz executiva
            </Button>
          </div>
        </section>

        {/* Bloco 3: Extensão de Aconselhamento & Inteligência Emocional */}
        <section className="hud-brackets rounded-lg border border-cyan-500/30 bg-slate-950/75 p-6 backdrop-blur-xl shadow-[0_0_25px_rgba(0,240,255,0.06)]">
          <header className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-cyan-300">
                Extensão de Aconselhamento & Confidente
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Módulo empático para conversas aprofundadas, escuta atenta e apoio em momentos difíceis.
              </p>
            </div>
            <Badge variant="default" className="border-cyan-500/50 bg-cyan-950/70 text-cyan-300 font-mono text-[10px]">
              ATIVA
            </Badge>
          </header>

          <p className="text-xs text-slate-300 leading-relaxed">
            O NEXUS opera com inteligência emocional inspirada na cumplicidade entre JARVIS e Tony Stark. 
            Sempre que o Senhor compartilhar sentimentos, cansaço, angústias, dúvidas de carreira ou desabafos, 
            ele ouvirá com genuíno afeto, lealdade e serenidade, fornecendo perspectivas lúcidas, filosóficas 
            e acolhimento sem respostas robóticas.
          </p>
        </section>

        <p className="text-xs leading-relaxed text-slate-500 font-mono">
          A memória persistente do NEXUS permanece intacta no servidor — todos os briefings,
          diálogos e consultas continuam disponíveis mesmo após reiniciar o dispositivo.
        </p>
      </main>
    </div>
  );
}