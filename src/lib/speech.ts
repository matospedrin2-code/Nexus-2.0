// Síntese de voz pt-BR com perfil MASCULINO ENCORPADO E HUMANO (estilo JARVIS) e fala ultra fluida:
// o texto é normalizado para leitura natural, dividido em frases com respiração orgânica e enfileirado,
// garantindo tom humano, expressivo e empático sem robotização.
import { setOrbState } from "@/lib/orbBus";

export function speechSynthSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/* ── Seleção e catálogo de vozes masculinas estilo JARVIS ─────────────── */

export interface JarvisVoiceOption {
  id: string;
  name: string;
  description: string;
  isAi: boolean;
  voiceName: string;
}

export const JARVIS_VOICES: JarvisVoiceOption[] = [
  {
    id: "jarvis-fenrir",
    name: "Google Fenrir (JARVIS Oficial)",
    description: "Voz masculina clássica, profunda e imponente estilo JARVIS",
    isAi: true,
    voiceName: "Fenrir",
  },
  {
    id: "jarvis-dipper",
    name: "Google Dipper (Voz Menino / Jovem)",
    description: "Voz masculina jovem, ágil e expressiva estilo Dipper da Google",
    isAi: true,
    voiceName: "Puck",
  },
  {
    id: "jarvis-puck",
    name: "Google Puck (Voz Menino)",
    description: "Voz masculina jovem, dinâmica e amigável da Google",
    isAi: true,
    voiceName: "Puck",
  },
  {
    id: "jarvis-charon",
    name: "Google Charon",
    description: "Voz masculina serena, elegante e sofisticada",
    isAi: true,
    voiceName: "Charon",
  },
];

export function getSelectedVoiceId(): string {
  const saved = localStorage.getItem("nexus_voice_id");
  if (!saved) return "jarvis-fenrir";
  return saved;
}

export function setSelectedVoiceId(id: string): void {
  localStorage.setItem("nexus_voice_id", id);
}

// Nomes e indicadores masculinos conhecidos em navegadores e sistemas (Windows, Edge, Chrome, macOS, iOS, Android, Linux).
const MALE_HINTS = [
  "daniel", "antonio", "antônio", "felipe", "rodrigo", "ricardo", "jorge", "thiago", "tiago",
  "lucas", "joaquim", "heitor", "fabio", "fábio", "yuri", "julio", "júlio", "duarte", "diogo",
  "bernardo", "miguel", "rafael", "gabriel", "paulo", "cristiano", "manoel", "manuel",
  "henrique", "bruno", "carlos", "gustavo", "leandro", "marcelo", "renato", "sergio", "sérgio",
  "vinicius", "vinícius", "vitor", "vítor", "edivaldo", "valter", "waldir", "alexandre", "marcos",
  "male", "masculin", "homem", "guy", "david", "alex", "fred", "tom", "george",
  "brazil-male", "pt-br-x-afs#male", "male_1", "male_2", "male_3", "#male",
];

// Nomes femininos para exclusão (apenas quando comprovadamente feminina no nome/id)
const FEMALE_HINTS = [
  "female", "feminin", "mulher", "#female",
  "francisca", "luciana", "maria", "fernanda",
  "helo", "heloisa", "heloísa", "vitoria", "vitória", "leticia", "letícia",
  "raquel", "joana", "catarina", "camila", "paula", "yara", "brenda", "thalita", "talita",
  "ines", "inês", "carolina", "beatriz", "juliana", "alessandra", "amanda", "claudia", "cláudia",
  "debora", "débora", "elisabete", "giovanna", "isabela", "larissa", "mariana", "natalia", "natália",
  "patricia", "patrícia", "renata", "sofia", "vanessa",
];

export function isExplicitlyMale(name: string): boolean {
  const n = name.toLowerCase();
  return MALE_HINTS.some((hint) => n.includes(hint));
}

export function isExplicitlyFemale(name: string): boolean {
  const n = name.toLowerCase();
  return FEMALE_HINTS.some((hint) => n.includes(hint));
}

function score(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase().replace(/_/g, "-");
  let points = 0;

  if (lang.startsWith("pt-br")) points += 300;
  else if (lang.startsWith("pt")) points += 100;

  // Vozes neurais / naturais modernas (Android Google TTS, Edge Natural, etc.)
  if (name.includes("natural")) points += 150;
  if (name.includes("neural")) points += 150;
  if (name.includes("google")) points += 120;
  if (name.includes("online")) points += 60;
  if (name.includes("enhanced")) points += 80;

  // Priorização para perfil masculino
  if (isExplicitlyMale(name)) points += 500;
  if (isExplicitlyFemale(name)) points -= 800;

  if (voice.localService) points += 10;
  return points;
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (!speechSynthSupported()) return [];
  const all = window.speechSynthesis.getVoices();
  const ptVoices = all.filter((voice) => voice.lang.toLowerCase().startsWith("pt"));
  const pool = ptVoices.length > 0 ? ptVoices : all;
  return pool.slice().sort((a, b) => score(b) - score(a));
}

/** Retorna a melhor voz disponível no dispositivo com preferência masculina natural. */
export function pickVoice(): SpeechSynthesisVoice | null {
  if (!speechSynthSupported()) return null;
  const all = window.speechSynthesis.getVoices();
  if (all.length === 0) return null;

  // 1. Voz pt-BR comprovadamente masculina (ex: Antonio Natural, Daniel, Felipe, pt-br-x-afs#male)
  const ptBrMale = all.filter(
    (v) =>
      v.lang.toLowerCase().replace(/_/g, "-").startsWith("pt-br") &&
      isExplicitlyMale(v.name) &&
      !isExplicitlyFemale(v.name)
  );
  if (ptBrMale.length > 0) {
    const chosen = ptBrMale.sort((a, b) => score(b) - score(a))[0];
    localStorage.setItem("nexus_voice_uri", chosen.voiceURI);
    return chosen;
  }

  // 2. Qualquer voz em português comprovadamente masculina
  const ptMale = all.filter(
    (v) =>
      v.lang.toLowerCase().startsWith("pt") &&
      isExplicitlyMale(v.name) &&
      !isExplicitlyFemale(v.name)
  );
  if (ptMale.length > 0) {
    const chosen = ptMale.sort((a, b) => score(b) - score(a))[0];
    localStorage.setItem("nexus_voice_uri", chosen.voiceURI);
    return chosen;
  }

  // 3. Voz oficial do Google no Android/Chrome ("Google português do brasil" ou neural)
  const ptGoogle = all.filter(
    (v) =>
      v.lang.toLowerCase().replace(/_/g, "-").startsWith("pt-br") &&
      !isExplicitlyFemale(v.name)
  );
  if (ptGoogle.length > 0) {
    const chosen = ptGoogle.sort((a, b) => score(b) - score(a))[0];
    localStorage.setItem("nexus_voice_uri", chosen.voiceURI);
    return chosen;
  }

  // 4. Qualquer voz pt brasileira
  const ptAny = all.filter((v) => v.lang.toLowerCase().startsWith("pt"));
  if (ptAny.length > 0) {
    return ptAny.sort((a, b) => score(b) - score(a))[0];
  }

  return all[0] ?? null;
}

/** Aquece a lista de vozes (Chrome a carrega de forma assíncrona). */
export function warmVoices(): void {
  if (!speechSynthSupported()) return;
  window.speechSynthesis.getVoices();
}

/* ── Normalização avançada do texto para locução humana ─────────────── */

const ABBREVIATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  // Moedas faladas por extenso
  [/\bR\$\s?(\d+),(\d{2})\b/g, "$1 reais e $2 centavos"],
  [/\bR\$\s?([\d.,]+)/g, "$1 reais"],
  [/\bUS\$\s?(\d+),(\d{2})\b/g, "$1 dólares e $2 centavos"],
  [/\bUS\$\s?([\d.,]+)/g, "$1 dólares"],
  // Unidades e medidas
  [/([\d,.]+)\s?%/g, "$1 por cento"],
  [/([\d,.]+)\s?°C\b/gi, "$1 graus celsius"],
  [/\b(\d+)\s*km\/h\b/gi, "$1 quilômetros por hora"],
  [/\b(\d+)\s*km\b/gi, "$1 quilômetros"],
  [/\b(\d+)\s*kg\b/gi, "$1 quilos"],
  [/\b(\d+)\s*bpm\b/gi, "$1 batimentos por minuto"],
  // Pressão arterial falada naturalmente ("12/8" -> "doze por oito")
  [/\b(\d{1,3})\/(\d{1,2})\s*(?:mmHg)?\b/g, "$1 por $2"],
  // Horários falados naturalmente
  [/\b(\d{1,2}):00\b/g, "$1 horas"],
  [/\b(\d{1,2}):(\d{2})\b/g, "$1 e $2"],
  [/\b(\d{1,2})h(\d{2})\b/gi, "$1 e $2"],
  [/\b(\d{1,2})h\b/gi, "$1 horas"],
  // Siglas e termos
  [/\bLGBTQIA\+?/gi, "L G B T Q I A mais"],
  [/\bIA\b/g, "inteligência artificial"],
  [/\bUSD\b/g, "dólar"],
  [/\bEUR\b/g, "euro"],
  [/\bBTC\b/g, "bitcoin"],
  [/\bEUA\b/g, "Estados Unidos"],
  [/\bPF\b/g, "Polícia Federal"],
  [/\bDr\.\s*/gi, "Doutor "],
  [/\bDra\.\s*/gi, "Doutora "],
  [/\bSr\.\s*/gi, "Senhor "],
  [/\bSra\.\s*/gi, "Senhora "],
  [/\bvs\.?\b/gi, "versus"],
  [/\bex\.:?\b/gi, "por exemplo"],
  [/\betc\.?\b/gi, "e assim por diante"],
];

export function normalizeForSpeech(text: string): string {
  let out = text
    // Remove tags de sistema e formatações estruturais
    .replace(/\[(?:CARD_[A-Z_]+|APPOINTMENT_[A-Z_]+|METRIC_[A-Z_]+|FACE_VERIFIED:[^\]]*)\]:?\s*/gi, "")
    .replace(/\[(?:APPOINTMENT_CREATE|APPOINTMENT_DELETE|METRIC_CREATE):.*?\]/gi, "")
    .replace(/[*#`_~>]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[•–—]/g, ", ")
    .replace(/\s*\n\s*/g, ". ");

  for (const [pattern, replacement] of ABBREVIATIONS) {
    out = out.replace(pattern, replacement);
  }

  // Decimais com ponto lidos de forma natural em português ("19.0" → "19", "5.22" → "5,22")
  out = out.replace(/(\d+)\.(\d+)/g, (_m, a: string, b: string) => (Number(b) === 0 ? a : `${a},${b}`));

  // Limpeza de pontuação e pausas
  return out
    .replace(/\.{2,}/g, ".")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/** Divide apenas em frases completas nos pontos finais, preservando a fluidez natural da fala sem pausas artificiais em vírgulas. */
export function splitForSpeech(text: string): string[] {
  // Separa por sentenças reais completas (. ! ? …), mantendo a integridade de cada frase
  const rawSentences = text.split(/(?<=[.!?…])\s+/);
  const chunks: string[] = [];

  for (const raw of rawSentences) {
    const s = raw.trim();
    if (!s) continue;
    // Se a frase for razoável (menos de 280 caracteres), mantém 100% íntegra para prosódia fluida
    if (s.length <= 280) {
      chunks.push(s);
    } else {
      // Frases gigantes: divide apenas no ponto e vírgula ou hífen de quebra maior
      const parts = s.split(/;\s+/);
      for (const p of parts) {
        const trimmed = p.trim();
        if (trimmed) chunks.push(trimmed);
      }
    }
  }

  return chunks.length > 0 ? chunks : [text];
}

/* ── Fala e entonação humana ─────────────────────────────────────────── */

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
}

let generation = 0;
const activeUtterances: SpeechSynthesisUtterance[] = [];
let currentAudio: HTMLAudioElement | null = null;
let audioPulseTimer: number | null = null;
let audioUnlocked = false;

/** Desbloqueia a reprodução de áudio em navegadores mobile (Chrome Android / iOS Safari). */
export function unlockAudio(): void {
  if (typeof window === "undefined" || audioUnlocked) return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      audioUnlocked = true;
    }
  } catch {}
}

if (typeof window !== "undefined") {
  const unlockEvents = ["touchstart", "touchend", "click", "keydown"];
  const handleUserGesture = () => {
    unlockAudio();
    unlockEvents.forEach((ev) => window.removeEventListener(ev, handleUserGesture));
  };
  unlockEvents.forEach((ev) => window.addEventListener(ev, handleUserGesture, { passive: true }));
}

function startSpeakingPulse(): void {
  stopSpeakingPulse();
  setOrbState("speaking", 0.9);
  audioPulseTimer = window.setInterval(() => {
    const level = 0.45 + Math.random() * 0.55;
    setOrbState("speaking", level);
  }, 85);
}

function stopSpeakingPulse(): void {
  if (audioPulseTimer !== null) {
    window.clearInterval(audioPulseTimer);
    audioPulseTimer = null;
  }
}

function stopAudio(): void {
  stopSpeakingPulse();
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.src = "";
    } catch {}
    currentAudio = null;
  }
}

function voiceSettings(opts: SpeakOptions) {
  let pitch = opts.pitch ?? Number(localStorage.getItem("nexus_pitch") ?? "1.0");
  if (isNaN(pitch) || pitch < 0.95 || pitch > 1.05) {
    pitch = 1.0;
  }
  const rate = opts.rate ?? Number(localStorage.getItem("nexus_rate") ?? "1.02");
  const volume = opts.volume ?? Number(localStorage.getItem("nexus_volume") ?? "1.0");

  return { rate, pitch, volume };
}

export function voiceEnabled(): boolean {
  return localStorage.getItem("nexus_voice_on") !== "0";
}

export function cancelSpeech(): void {
  generation += 1;
  activeUtterances.length = 0;
  stopAudio();
  if (speechSynthSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
  setOrbState("idle", 0.25);
}

function speakBrowser(
  spoken: string,
  opts: SpeakOptions,
  mine: number,
  finish: () => void
): void {
  if (!speechSynthSupported()) {
    finish();
    return;
  }

  const voice = pickVoice();
  const { rate, pitch, volume } = voiceSettings(opts);
  const chunks = splitForSpeech(spoken);

  let currentIndex = 0;

  const playNextSentence = () => {
    if (mine !== generation) return;
    if (currentIndex >= chunks.length) {
      finish();
      return;
    }

    const chunk = chunks[currentIndex++];
    const utterance = new SpeechSynthesisUtterance(chunk);
    activeUtterances.push(utterance);
    utterance.lang = voice?.lang ?? "pt-BR";
    if (voice) utterance.voice = voice;
    utterance.rate = rate;

    // Se a voz não for comprovadamente masculina (ex: voz padrão do Android),
    // reduz o pitch para 0.70 (barítono elegante), eliminando qualquer tom feminino indesejado
    const isMale = voice ? isExplicitlyMale(voice.name) : false;
    utterance.pitch = isMale ? pitch : 0.70;
    utterance.volume = volume;

    utterance.onstart = () => {
      if (mine !== generation) return;
      opts.onStart?.();
      startSpeakingPulse();
    };

    utterance.onboundary = () => {
      if (mine !== generation) return;
      setOrbState("speaking", 0.95);
    };

    utterance.onend = () => {
      if (mine === generation) {
        playNextSentence();
      }
    };

    utterance.onerror = (e) => {
      console.warn("[Speech] Erro na síntese local:", e);
      if (mine === generation) {
        playNextSentence();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  playNextSentence();
}

/** Busca áudio sintetizado em WAV da API com timeout curto para latência zero. */
async function fetchTtsChunk(text: string, voiceName: string, timeoutMs: number = 4000): Promise<string | null> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: voiceName }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.audioBase64 || null;
  } catch {
    return null;
  }
}

/** Fala o texto com a voz neural masculina oficial da Google com latência zero e sincronia perfeita do orbe. */
export function speak(text: string, opts: SpeakOptions = {}): void {
  cancelSpeech();
  const mine = ++generation;
  const spoken = normalizeForSpeech(text);
  if (!spoken) {
    opts.onEnd?.();
    return;
  }

  unlockAudio();

  let finished = false;
  const finish = () => {
    if (finished || mine !== generation) return;
    finished = true;
    activeUtterances.length = 0;
    stopAudio();
    setOrbState("idle", 0.25);
    opts.onEnd?.();
  };

  // Se a voz estiver silenciada nas opções:
  if (!voiceEnabled()) {
    let level = 0.5;
    audioPulseTimer = window.setInterval(() => {
      level = 0.45 + Math.random() * 0.5;
      setOrbState("speaking", level);
    }, 130);
    window.setTimeout(finish, Math.min(40000, 1800 + spoken.length * 48));
    return;
  }

  // Sincronia de estado do Orbe:
  // Enquanto o áudio está sendo gerado/carregado na rede, o orbe fica em estado 'thinking',
  // e NUNCA em 'speaking' até que o primeiro som comece a tocar!
  setOrbState("thinking", 0.72);

  const voiceId = getSelectedVoiceId();
  const jarvisOption = JARVIS_VOICES.find((v) => v.id === voiceId) || JARVIS_VOICES[0];
  const volume = opts.volume ?? Number(localStorage.getItem("nexus_volume") ?? "1.0");

  const chunks = splitForSpeech(spoken);
  if (chunks.length === 0) {
    finish();
    return;
  }

  // 1. Caminho ultra-rápido: Síntese Neural Google AI em Sentenças Fluídas (Latência < 300ms)
  let currentIndex = 0;
  const audioCache = new Map<number, string>();
  let hasStartedPlaying = false;

  const prefetchChunk = (index: number) => {
    if (index >= chunks.length || audioCache.has(index)) return;
    fetchTtsChunk(chunks[index], jarvisOption.voiceName, 8000).then((b64) => {
      if (b64 && mine === generation) {
        audioCache.set(index, b64);
      }
    });
  };

  const playChunkIndex = async (index: number) => {
    if (mine !== generation) return;
    if (index >= chunks.length) {
      finish();
      return;
    }

    let b64 = audioCache.get(index);
    if (!b64) {
      // Para o primeiro chunk, timeout ágil de 3.5s para garantir início imediato
      const timeoutMs = index === 0 ? 3500 : 7000;
      b64 = (await fetchTtsChunk(chunks[index], jarvisOption.voiceName, timeoutMs)) || undefined;
    }

    if (mine !== generation) return;

    if (!b64) {
      // Se a rede ou cota falhar no primeiro chunk e nada tiver tocado ainda, faz fallback limpo
      if (!hasStartedPlaying) {
        speakBrowser(spoken, opts, mine, finish);
        return;
      } else {
        // Se já estava falando os anteriores, pula para o próximo ou fala localmente
        playChunkIndex(index + 1);
        return;
      }
    }

    // Prefetch do próximo chunk em segundo plano durante a fala deste
    if (index + 1 < chunks.length) {
      prefetchChunk(index + 1);
    }

    const audio = new Audio("data:audio/wav;base64," + b64);
    audio.volume = Math.max(0, Math.min(1, volume));
    currentAudio = audio;

    audio.onplay = () => {
      if (mine !== generation) return;
      hasStartedPlaying = true;
      opts.onStart?.();
      startSpeakingPulse();
    };

    audio.onended = () => {
      if (mine === generation) {
        playChunkIndex(index + 1);
      }
    };

    audio.onerror = () => {
      if (mine === generation) {
        if (!hasStartedPlaying) {
          speakBrowser(spoken, opts, mine, finish);
        } else {
          playChunkIndex(index + 1);
        }
      }
    };

    try {
      await audio.play();
    } catch (err) {
      console.warn("[Speech] Bloqueio ou falha de autoplay:", err);
      if (mine === generation) {
        if (!hasStartedPlaying) {
          speakBrowser(spoken, opts, mine, finish);
        } else {
          playChunkIndex(index + 1);
        }
      }
    }
  };

  // Inicia a reprodução do primeiro chunk imediatamente
  playChunkIndex(0);

  // Timeout de segurança preventiva para encerrar caso tudo seja abandonado
  window.setTimeout(finish, Math.min(180000, 10000 + spoken.length * 120));
}

/* ── Reconhecimento de voz em tempo real otimizado para português ───── */

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
  length: number;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    [index: number]: SpeechRecognitionResultLike;
    length: number;
  };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

export function recognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

function createRecognition(lang = "pt-BR"): SpeechRecognitionLike | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 3;
  return rec;
}

export interface ListenHandlers {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd?: () => void;
}

/** Escuta a fala com alta sensibilidade e transcrição precisa para o português do Brasil. */
export function listenOnce(handlers: ListenHandlers): () => void {
  const rec = createRecognition();
  if (!rec) {
    handlers.onError("Reconhecimento de voz não suportado neste navegador.");
    return () => undefined;
  }

  let finalTranscript = "";
  let interimTranscript = "";

  rec.onresult = (event) => {
    interimTranscript = "";
    for (let i = 0; i < event.results.length; i++) {
      const res = event.results[i];
      if (res && res[0]) {
        if (res.isFinal) {
          finalTranscript += res[0].transcript + " ";
        } else {
          interimTranscript += res[0].transcript;
        }
      }
    }
    const current = (finalTranscript + interimTranscript).trim();
    if (current) {
      handlers.onPartial?.(current);
    }
  };

  rec.onerror = (event) => {
    if (event.error === "no-speech") return;
    handlers.onError(
      event.error === "not-allowed"
        ? "Acesso ao microfone negado no navegador."
        : "Não consegui entender a fala. Tente novamente."
    );
  };

  rec.onend = () => {
    const full = (finalTranscript + interimTranscript).trim();
    if (full) {
      handlers.onFinal(full);
    }
    handlers.onEnd?.();
  };

  try {
    rec.start();
  } catch {
    handlers.onError("Não foi possível iniciar o microfone.");
  }

  return () => {
    try {
      rec.abort();
    } catch {
      // ignore
    }
  };
}