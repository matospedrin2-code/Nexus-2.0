import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  BrainCircuit,
  Camera,
  Lock,
  MessageSquare,
  Mic,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import HolographicDataCube from "@/components/nexus/HolographicDataCube";
import LiquidGlassCamera from "@/components/nexus/LiquidGlassCamera";
import MemoryTimelineDrawer from "@/components/nexus/MemoryTimelineDrawer";
import MusicPlayer from "@/components/nexus/MusicPlayer";
import NexusDialogueFeed, { type DialogueEntry } from "@/components/nexus/NexusDialogueFeed";
import ReactiveOrbCanvas from "@/components/nexus/ReactiveOrbCanvas";
import {
  fetchLatestBriefing,
  fetchMemory,
  runBriefing,
  sendChatMessage,
  type BriefingCard,
  type BriefingResponse,
  type MusicTrack,
} from "@/lib/nexus";
import {
  fetchTodayCalendarEvents,
  subscribeToCalendarAuth,
  type GoogleCalendarState,
} from "@/lib/googleCalendar";
import { setOrbState } from "@/lib/orbBus";
import {
  playCubeCollapseSound,
  playCubeExpandSound,
  playPanelAppearSound,
} from "@/lib/bootSound";
import {
  cancelSpeech,
  listenOnce,
  recognitionSupported,
  speak,
  unlockAudio,
  voiceEnabled,
  warmVoices,
} from "@/lib/speech";

export default function Home() {
  const queryClient = useQueryClient();
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
  const [entries, setEntries] = useState<DialogueEntry[]>([]);
  const [live, setLive] = useState<{ id: string; text: string } | null>(null);
  const [cards, setCards] = useState<BriefingCard[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [listening, setListening] = useState(false);
  const [command, setCommand] = useState("");
  const [status, setStatus] = useState("");
  const [track, setTrack] = useState<MusicTrack | null>(null);
  const [voiceOn, setVoiceOn] = useState(voiceEnabled);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cubeCollapsed, setCubeCollapsed] = useState(true);

  // Legenda de fala arquivada por padrão para não poluir nem ocupar a tela principal
  const [showArchivedFeed, setShowArchivedFeed] = useState(
    () => localStorage.getItem("nexus_show_dialogue") === "1"
  );

  const [calState, setCalState] = useState<GoogleCalendarState>({
    connected: false,
    user: null,
    events: [],
    loading: false,
    error: null,
  });

  const revealTimersRef = useRef<number[]>([]);
  const hydratedRef = useRef(false);
  const autoRunRef = useRef(false);

  // Monitora Google Agenda em tempo real
  useEffect(() => {
    const unsub = subscribeToCalendarAuth((state) => {
      setCalState(state);
    });
    return unsub;
  }, []);

  const memoryQuery = useQuery({
    queryKey: ["memory"],
    queryFn: () => fetchMemory(40),
    refetchOnWindowFocus: false,
    retry: false,
  });

  const latestQuery = useQuery({
    queryKey: ["latest-briefing"],
    queryFn: fetchLatestBriefing,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const clearRevealTimers = useCallback(() => {
    revealTimersRef.current.forEach((id) => window.clearTimeout(id));
    revealTimersRef.current = [];
  }, []);

  useEffect(() => {
    warmVoices();
  }, []);

  useEffect(() => () => {
    clearRevealTimers();
    cancelSpeech();
  }, [clearRevealTimers]);

  const handleToggleCube = useCallback(() => {
    setCubeCollapsed((prev) => {
      const next = !prev;
      if (next) {
        playCubeCollapseSound();
      } else {
        setRevealed(cards.length);
        playCubeExpandSound();
      }
      return next;
    });
  }, [cards.length]);

  /** Transmissão do NEXUS: orbe pulsa com a voz JARVIS, cards holográficos surgem em sequência com som característico e se recolhem no Cubo de Dados */
  const transmit = useCallback(
    (id: string, text: string, nextCards: BriefingCard[], staggerMs = 0) => {
      clearRevealTimers();
      setEntries((prev) => [...prev, { id, role: "nexus", text }]);
      setLive({ id, text });
      setCards(nextCards);

      if (staggerMs > 0 && nextCards.length > 0) {
        setRevealed(0);
        setCubeCollapsed(false); // Expande os painéis durante a locução do briefing

        // Revelação sequencial com o som holográfico característico a cada cartão
        nextCards.forEach((_, index) => {
          revealTimersRef.current.push(
            window.setTimeout(() => {
              setRevealed(index + 1);
              playPanelAppearSound(index);
            }, staggerMs + index * 3600)
          );
        });

        // Após apresentar todos os painéis, recolhe suavemente para o Cubo de Dados no canto inferior
        const autoCollapseMs = staggerMs + nextCards.length * 3600 + 4000;
        revealTimersRef.current.push(
          window.setTimeout(() => {
            setCubeCollapsed(true);
            playCubeCollapseSound();
          }, autoCollapseMs)
        );
      } else {
        setRevealed(nextCards.length);
        if (nextCards.length > 0) {
          playPanelAppearSound(0);
        }
      }

      // Propaga as configurações salvas de tom natural (Google Dipper), velocidade e volume
      const rate = Number(localStorage.getItem("nexus_rate") ?? "1.0");
      const pitch = Number(localStorage.getItem("nexus_pitch") ?? "1.0");
      const volume = Number(localStorage.getItem("nexus_volume") ?? "1.0");

      speak(text, {
        rate,
        pitch,
        volume,
        onEnd: () => {
          setLive(null);
          // Se os painéis ainda estiverem abertos ao final da fala, recolhe automaticamente para o Cubo
          if (nextCards.length > 0) {
            window.setTimeout(() => {
              setCubeCollapsed(true);
              playCubeCollapseSound();
            }, 2500);
          }
        },
      });
    },
    [clearRevealTimers]
  );

  const { mutate: mutateBriefing, isPending: briefingPending } = useMutation({
    mutationFn: async (faceVerified: boolean) => {
      let freshEvents = calState.events;
      if (calState.connected) {
        try {
          freshEvents = await fetchTodayCalendarEvents();
        } catch {}
      }
      return runBriefing(faceVerified, {
        connected: calState.connected,
        events: freshEvents.map((e) => ({
          id: e.id,
          summary: e.summary,
          timeText: e.timeText,
        })),
      });
    },
    onSuccess: (data) => {
      setStatus("");
      setBriefing(data);
      queryClient.invalidateQueries({ queryKey: ["memory"] });
      queryClient.invalidateQueries({ queryKey: ["latest-briefing"] });
      transmit(data.id, data.speech, data.cards, 1600);
      toast.success("Briefing matinal transmitido, senhor.");
    },
    onError: () => {
      setStatus("");
      toast.error("Falha na comunicação com o núcleo de inteligência.");
      setEntries((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "nexus",
          text: "Perdoe a falha, senhor. O canal com o núcleo de inteligência está momentaneamente instável. Tentarei novamente em instantes.",
        },
      ]);
    },
  });

  const { mutate: mutateChat, isPending: chatPending } = useMutation({
    mutationFn: ({ message, cameraImage }: { message: string; cameraImage?: string | null }) =>
      sendChatMessage(
        message,
        {
          connected: calState.connected,
          events: calState.events.map((e) => ({
            id: e.id,
            summary: e.summary,
            timeText: e.timeText,
          })),
        },
        cameraImage
      ),
    onSuccess: (data) => {
      setStatus("");
      queryClient.invalidateQueries({ queryKey: ["memory"] });
      if (data.action === "open_camera") setCameraOpen(true);
      if (data.action === "close_camera") setCameraOpen(false);
      if (data.action === "stop_music") setTrack(null);
      if (data.track) setTrack(data.track);
      transmit(data.id, data.reply, data.cards);
    },
    onError: () => {
      setStatus("");
      toast.error("Falha na transmissão da consulta, senhor.");
    },
  });

  // Gatilho automático ao vir do Lockscreen (/auth) OU ao virar o dia / passar 24h
  useEffect(() => {
    if (autoRunRef.current) return;
    autoRunRef.current = true;

    const fromLock = sessionStorage.getItem("nexus_auto_briefing") === "1";
    const verified = sessionStorage.getItem("nexus_face_verified") === "1";
    sessionStorage.removeItem("nexus_auto_briefing");
    sessionStorage.removeItem("nexus_face_verified");

    // Verificação de 24 horas ou virada de dia
    const todayStr = new Date().toDateString();
    const lastDay = localStorage.getItem("nexus_last_briefing_day");
    const lastTime = Number(localStorage.getItem("nexus_last_briefing_time") || "0");
    const hoursElapsed = (Date.now() - lastTime) / (1000 * 60 * 60);

    const isNewDayOr24h = !lastDay || lastDay !== todayStr || hoursElapsed >= 20;

    if (fromLock || isNewDayOr24h) {
      localStorage.setItem("nexus_last_briefing_day", todayStr);
      localStorage.setItem("nexus_last_briefing_time", String(Date.now()));
      setStatus(
        verified
          ? "Identidade confirmada — gerando briefing matinal, senhor…"
          : "Iniciando apresentação executiva do dia, senhor…"
      );
      mutateBriefing(verified);
    }
  }, [mutateBriefing]);

  // Reidratação de memória persistente
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!memoryQuery.isSuccess || !latestQuery.isSuccess) return;
    hydratedRef.current = true;
    const last = latestQuery.data;
    if (last) {
      setBriefing(last);
      setCards(last.cards);
      setRevealed(last.cards.length);
    }
    const events = (memoryQuery.data ?? []).slice(0, 8).reverse();
    if (events.length > 0 && entries.length === 0) {
      setEntries(
        events.map((event) => ({
          id: event.id,
          role: event.kind === "user" ? ("user" as const) : ("nexus" as const),
          text: event.text,
        }))
      );
    }
  }, [memoryQuery.isSuccess, latestQuery.isSuccess, memoryQuery.data, latestQuery.data, entries.length]);

  useEffect(() => {
    if (briefingPending || chatPending) setOrbState("thinking", 0.72);
    else if (listening) setOrbState("listening", 0.55);
  }, [briefingPending, chatPending, listening]);

  const submitMessage = (raw: string) => {
    const text = raw.trim();
    if (!text || chatPending) return;

    unlockAudio();

    // Resposta instantânea a comandos de hardware e mídia
    if (/\b(fechar camera|fechar câmera|desligar camera|desligar câmera|apagar camera|fechar webcam)\b/i.test(text)) {
      setCameraOpen(false);
    } else if (/\b(abrir camera|abrir câmera|ligar camera|ligar câmera|abrir webcam|olhos do nexus)\b/i.test(text)) {
      setCameraOpen(true);
    } else if (/\b(parar musica|parar música|parar som|desligar musica|stop)\b/i.test(text)) {
      setTrack(null);
    }

    // Identifica se a pergunta envolve visão, objetos ou ambiente
    const isVisionQuery = /\b(ve|vê|vendo|veja|olhe|olha|enxerga|enxergando|camera|câmera|frente|mostrando|foto|imagem|que e isso|o que e isso|reconhece|reconhecer|analisa|analise)\b/i.test(text);

    let cameraImage: string | null = null;
    if (typeof (window as any).__nexusCaptureCameraFrame === "function") {
      cameraImage = (window as any).__nexusCaptureCameraFrame();
    }

    // Se perguntou algo sobre visão e a câmera não estava aberta, abre a câmera para os próximos frames
    if (isVisionQuery && !cameraOpen) {
      setCameraOpen(true);
    }

    cancelSpeech();
    setEntries((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", text }]);
    setCommand("");
    setStatus("Processando consulta com o núcleo de inteligência…");
    mutateChat({ message: text, cameraImage });
  };

  const toggleMic = () => {
    unlockAudio();
    if (listening) {
      // Se já estava ouvindo e o usuário clica de novo, finaliza a escuta
      setListening(false);
      setOrbState("idle", 0.25);
      return;
    }

    if (!recognitionSupported()) {
      toast.error("Reconhecimento de voz não suportado neste navegador — digite seu comando, senhor.");
      return;
    }

    cancelSpeech();
    setListening(true);
    setOrbState("listening", 0.55);
    listenOnce({
      onPartial: (text) => setCommand(text),
      onFinal: (text) => {
        if (text && text.trim()) {
          setCommand("");
          submitMessage(text.trim());
        }
      },
      onError: (message) => {
        toast.error(message);
        setListening(false);
        setOrbState("idle", 0.25);
      },
      onEnd: () => {
        setListening(false);
        setOrbState("idle", 0.25);
      },
    });
  };

  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    localStorage.setItem("nexus_voice_on", next ? "1" : "0");
    if (!next) cancelSpeech();
  };

  const toggleArchivedFeed = () => {
    const next = !showArchivedFeed;
    setShowArchivedFeed(next);
    localStorage.setItem("nexus_show_dialogue", next ? "1" : "0");
  };

  const weather = briefing?.context?.weather;
  const usd = briefing?.context?.finance?.usd;
  const eur = briefing?.context?.finance?.eur;
  const btc = briefing?.context?.finance?.btc;
  const memoryCount = memoryQuery.data?.length ?? 0;
  const busy = briefingPending || chatPending;

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      {/* Top Header — Alinhamento e espaçamento rigorosamente responsivos */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-cyan-500/20 bg-slate-950/85 px-3 md:px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 min-w-0">
          <BrainCircuit
            className="size-5 shrink-0 text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.7)]"
            aria-hidden="true"
          />
          <div className="min-w-0 flex items-center gap-2">
            <span className="hud-glow font-heading text-base md:text-lg font-black uppercase tracking-tight text-cyan-300 whitespace-nowrap">
              NEXUS
            </span>
            <span className="rounded border border-cyan-500/40 bg-cyan-950/60 px-1 py-0.5 font-mono text-[9px] font-bold text-cyan-400 leading-none">
              OS
            </span>
            <span className="hidden sm:inline font-mono text-[10px] text-cyan-400/80 whitespace-nowrap">
              Executive JARVIS
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="outline"
            data-testid="nexus-source-badge"
            className="font-mono text-[10px] px-2 py-0.5 tracking-wider hidden md:inline-flex"
          >
            {busy ? "PROCESSANDO" : "NÚCLEO ONLINE"}
          </Badge>

          {/* Botão de Câmera sob Comando (Liquid Glass) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCameraOpen((prev) => !prev)}
            title={cameraOpen ? "Fechar Módulo Óptico" : "Abrir Câmera Liquid Glass (Sob comando)"}
            aria-label="Câmera do NEXUS"
            data-testid="nexus-camera-btn"
            className={
              cameraOpen
                ? "text-cyan-300 bg-cyan-950/60 border border-cyan-500/50 shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                : "text-cyan-400/80 hover:text-cyan-300"
            }
          >
            <Camera className="size-4" aria-hidden="true" />
          </Button>

          {/* Botão de arquivo de legendas */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleArchivedFeed}
            title={showArchivedFeed ? "Ocultar histórico de legendas" : "Exibir histórico arquivado de falas"}
            aria-label="Alternar histórico arquivado"
            data-testid="nexus-toggle-captions-btn"
            className={showArchivedFeed ? "text-cyan-300 bg-cyan-950/40" : "text-cyan-400/60"}
          >
            <MessageSquare className="size-4" aria-hidden="true" />
          </Button>

          <Link
            to="/auth"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            title="Bloquear HUD (Lockscreen Biométrico)"
            aria-label="Bloquear tela e autenticação"
            data-testid="nexus-lock-link"
          >
            <Lock className="size-4 text-cyan-400/80 hover:text-cyan-300" aria-hidden="true" />
          </Link>

          <MemoryTimelineDrawer />

          <Link
            to="/settings"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            title="Configurações (Voz e Google Agenda)"
            aria-label="Configurações"
            data-testid="nexus-settings-link"
          >
            <SettingsIcon className="size-4 text-cyan-400/80 hover:text-cyan-300" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* Janela de Câmera Liquid Glass com Espelhamento (Inicializada DESLIGADA, ativada sob comando) */}
      <LiquidGlassCamera isOpen={cameraOpen} onClose={() => setCameraOpen(false)} />

      {/* Main Área de Trabalho: Adapta dinamicamente em modo Paisagem (ao deitar o celular) */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-4 overflow-y-auto px-4 py-4 md:px-6 landscape:flex-row landscape:items-start landscape:gap-3 landscape:py-1.5 landscape:px-3">
        {/* Painel Esquerdo em Landscape / Central em Retrato: Orbe e Telemetria */}
        <div className="flex flex-col items-center shrink-0 w-full landscape:w-[210px] sm:landscape:w-[240px] landscape:sticky landscape:top-0">
          <div className="relative flex flex-col items-center justify-center shrink-0">
            <ReactiveOrbCanvas className="h-[clamp(240px,36vh,360px)] w-[clamp(240px,36vh,360px)] sm:h-[clamp(280px,40vh,390px)] sm:w-[clamp(280px,40vh,390px)] landscape:h-28 landscape:w-28 sm:landscape:h-32 sm:landscape:w-32 drop-shadow-[0_0_35px_rgba(0,240,255,0.35)]" />

            {/* Legenda INVISÍVEL no layout (zero pixels ocupados na tela, conforme solicitado pelo usuário), mas presente no DOM com aria-live */}
            <div className="sr-only" aria-live="polite" data-testid="nexus-live-caption">
              {live ? `NEXUS: ${live.text}` : ""}
            </div>

            {/* Indicador conciso e elegante de status de operação */}
            <div className="mt-1 text-center">
              <p
                className="font-mono text-[10px] sm:text-[11px] landscape:text-[9px] uppercase tracking-[0.25em] text-cyan-400/80"
                data-testid="nexus-core-status"
              >
                {status ||
                  (listening
                    ? "Ouvindo ordens do senhor com atenção…"
                    : live
                    ? "Transmitindo locução JARVIS…"
                    : "Núcleo executivo a postos")}
              </p>
            </div>
          </div>

          {/* Barra de Telemetria e Indicadores com Alinhamento Preciso */}
          <div
            className="mt-3 landscape:mt-1 flex flex-wrap items-center justify-center gap-1.5 landscape:gap-1 rounded-lg border border-cyan-500/20 bg-slate-950/70 p-2 landscape:p-1 font-mono text-[10px] sm:text-[11px] landscape:text-[9px] text-slate-300 backdrop-blur-xl shadow-[0_0_20px_rgba(0,240,255,0.05)] w-full"
            data-testid="nexus-telemetry"
          >
            <div className="flex items-center gap-1 rounded bg-slate-900/60 px-2 py-0.5 text-emerald-400 border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="whitespace-nowrap font-medium">Ao Vivo</span>
            </div>

            <div
              className="flex items-center gap-1 rounded bg-slate-900/60 px-2 py-0.5 text-cyan-200 border border-cyan-500/15"
              data-testid="nexus-telemetry-weather"
            >
              <span className="text-cyan-400/70 uppercase text-[9px]">Clima:</span>
              <span className="whitespace-nowrap">
                {weather?.temperature != null
                  ? `${weather.temperature}°C`
                  : "Novorizonte"}
              </span>
            </div>

            <div
              className="flex items-center gap-1 rounded bg-slate-900/60 px-2 py-0.5 text-cyan-200 border border-cyan-500/15"
              data-testid="nexus-telemetry-usd"
            >
              <span className="text-cyan-400/70 uppercase text-[9px]">USD:</span>
              <span className="whitespace-nowrap">R$ {usd?.bid?.toFixed(2) ?? "—"}</span>
              {eur?.bid != null && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-cyan-400/70 uppercase text-[9px]">EUR:</span>
                  <span className="whitespace-nowrap">R$ {eur.bid.toFixed(2)}</span>
                </>
              )}
            </div>

            {btc?.bid != null && (
              <div className="flex items-center gap-1 rounded bg-slate-900/60 px-2 py-0.5 text-amber-300 border border-amber-500/20">
                <span className="text-amber-400/70 uppercase text-[9px]">BTC:</span>
                <span className="whitespace-nowrap">R$ {(btc.bid / 1000).toFixed(0)}k</span>
              </div>
            )}

            <div
              className="flex items-center gap-1 rounded bg-slate-900/60 px-2 py-0.5 border border-cyan-500/15"
              data-testid="nexus-telemetry-calendar"
            >
              <span className="text-cyan-400/70 uppercase text-[9px]">Agenda:</span>
              {calState.connected ? (
                <span className="text-emerald-400 whitespace-nowrap">
                  {calState.events.length} evento{calState.events.length === 1 ? "" : "s"} hoje
                </span>
              ) : (
                <Link
                  to="/settings"
                  className="text-amber-400 underline decoration-dotted hover:text-amber-300 whitespace-nowrap"
                >
                  Desconectada
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Painel Direito em Landscape: Mídia, Cards e Conteúdo */}
        <div className="flex flex-1 flex-col items-center gap-4 landscape:gap-2.5 w-full min-w-0 landscape:overflow-y-auto landscape:max-h-[calc(100vh-80px)] landscape:pb-4">
          {/* Player Musical do YouTube / Google com Integração Direta */}
          {track && (
            <div className="w-full max-w-2xl">
              <MusicPlayer track={track} onClose={() => setTrack(null)} />
            </div>
          )}

          {/* Feed de Falas Arquivadas (visível somente se o usuário optar por desarquivar no topo) */}
          {showArchivedFeed && (
            <div className="w-full max-w-3xl rounded-lg border border-cyan-500/25 bg-slate-950/70 p-4 backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between border-b border-cyan-500/15 pb-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-400/80">
                  Histórico Arquivado de Transcrições
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleArchivedFeed}
                  className="h-6 px-2 text-[10px] text-slate-400 hover:text-slate-200"
                >
                  Ocultar
                </Button>
              </div>
              <NexusDialogueFeed
                entries={entries}
                live={live}
                notice={status || (busy ? "Processando resposta executiva…" : null)}
              />
            </div>
          )}

          {/* Cards Sequenciais do Briefing Holográfico com Recolhimento em Cubo de Dados 3D */}
          <div className="w-full max-w-4xl">
            <HolographicDataCube
              cards={cards}
              revealed={revealed}
              isCollapsed={cubeCollapsed}
              onToggleCollapse={handleToggleCube}
              onDismissCard={(idx) => setCards((prev) => prev.filter((_, i) => i !== idx))}
            />
          </div>

          {cards.length === 0 && !briefingPending && !live && !status && (
            <div className="w-full max-w-xl rounded-lg border border-cyan-500/15 bg-slate-950/40 p-3 sm:p-4 text-center backdrop-blur-xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan-400/60">
                Sistemas a postos · Aguardando ordens
              </p>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Toque em <span className="text-cyan-300 font-medium">Briefing</span> ou fale com o NEXUS para iniciar o panorama diário.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer Fixo: Microfone com Animação Ativa Específica, Envio Ágil e Ações Rápidas */}
      <footer className="sticky bottom-0 z-40 shrink-0 border-t border-cyan-500/20 bg-slate-950/95 px-3 py-2.5 landscape:py-1 landscape:px-2 backdrop-blur-xl md:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 landscape:gap-1">
          <div className="flex items-center gap-2 landscape:gap-1.5">
            <Input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submitMessage(command)}
              placeholder="Fale ou digite um comando..."
              aria-label="Comando para o NEXUS"
              data-testid="nexus-command-input"
              className="flex-1 h-9 landscape:h-8 text-xs sm:text-sm placeholder:text-[11px] sm:placeholder:text-xs placeholder:text-cyan-300/40 font-mono"
            />

            <Button
              onClick={() => submitMessage(command)}
              disabled={!command.trim() || chatPending}
              data-testid="nexus-command-submit-btn"
              aria-label="Transmitir comando ao NEXUS"
              title="Transmitir comando"
              className="landscape:h-8 landscape:px-3"
            >
              <Send className="size-4" aria-hidden="true" />
            </Button>

            {/* Microfone com Animação Vibrante e Não Silenciada */}
            <Button
              variant={listening ? "default" : "outline"}
              size="icon"
              onClick={toggleMic}
              data-testid="nexus-wake-mic-btn"
              aria-label={listening ? "Microfone ativo e ouvindo — clique para parar" : "Falar com o NEXUS"}
              title={listening ? "Ouvindo atentamente o Senhor... (clique para parar)" : "Falar com o NEXUS por voz"}
              className={`landscape:size-8 ${
                listening
                  ? "relative border-emerald-400 bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.9)] animate-pulse hover:bg-emerald-500"
                  : "border-cyan-500/30 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-950/40"
              }`}
            >
              {listening && (
                <span className="absolute -top-1 -right-1 flex size-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-80"></span>
                  <span className="relative inline-flex size-3 rounded-full bg-emerald-400"></span>
                </span>
              )}
              <Mic className={`size-4 ${listening ? "text-white animate-bounce" : ""}`} aria-hidden="true" />
            </Button>

            <Button
              variant="secondary"
              onClick={() => {
                cancelSpeech();
                setStatus("Consolidando briefing executivo do dia, senhor…");
                mutateBriefing(briefing?.face_verified ?? false);
              }}
              disabled={briefingPending}
              data-testid="nexus-briefing-btn"
              title="Emitir briefing matinal executivo"
              className="landscape:h-8 landscape:px-3 landscape:text-xs"
            >
              <Sparkles className="size-4 mr-1.5" aria-hidden="true" />
              {briefingPending ? "Emitindo…" : "Briefing"}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleVoice}
              data-testid="nexus-voice-toggle-btn"
              aria-label={voiceOn ? "Silenciar síntese de voz" : "Ativar síntese de voz"}
              title={voiceOn ? "Voz JARVIS ativada" : "Voz silenciada"}
              className="landscape:size-8"
            >
              {voiceOn ? (
                <Volume2 className="size-4 text-cyan-300" aria-hidden="true" />
              ) : (
                <VolumeX className="size-4 text-slate-500" aria-hidden="true" />
              )}
            </Button>
          </div>

          {/* Ações e Consultas Rápidas em barra horizontal sem quebra e sem poluição visual em landscape */}
          <div className="flex flex-wrap landscape:flex-nowrap landscape:overflow-x-auto landscape:justify-start landscape:py-0.5 landscape:w-full items-center justify-center gap-1.5 pt-0.5 no-scrollbar">
            {[
              { label: "Briefing do dia", query: "Briefing do dia" },
              { label: "O que tenho na agenda?", query: "O que tenho na agenda?" },
              { label: "Câmera sob comando", action: () => setCameraOpen(true) },
              ...(track ? [{ label: "Parar música", action: () => setTrack(null) }] : []),
              { label: "Tocar música", query: "NEXUS, tocar música para foco" },
              { label: "Preciso de um conselho", query: "NEXUS, preciso de um conselho e de sua orientação pessoal hoje." },
              { label: "Dólar e Bitcoin", query: "Qual a cotação do dólar e do bitcoin agora?" },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if ("action" in item && item.action) {
                    item.action();
                  } else if ("query" in item && item.query) {
                    submitMessage(item.query);
                  }
                }}
                disabled={busy}
                className="rounded-full border border-cyan-500/20 bg-cyan-950/30 px-2.5 py-0.5 font-mono text-[10px] text-cyan-300/85 transition hover:border-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-100 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                ✦ {item.label}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}