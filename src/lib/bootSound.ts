// Som de inicialização estilo JARVIS, sintetizado na Web Audio API.
// Nenhum arquivo externo, nenhum direito autoral: sweep grave + chime + hum.

let ctx: AudioContext | null = null;
let humGain: GainNode | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Sequência de boot: sweep ascendente grave + dois chimes + hum ambiente. */
export function playBootSound(): void {
  const audio = context();
  if (!audio) return;
  const now = audio.currentTime;
  const master = audio.createGain();
  master.gain.value = 0.3;
  master.connect(audio.destination);

  // 1. Sweep grave ascendente (energização do núcleo)
  const sweep = audio.createOscillator();
  const sweepGain = audio.createGain();
  sweep.type = "sawtooth";
  sweep.frequency.setValueAtTime(42, now);
  sweep.frequency.exponentialRampToValueAtTime(320, now + 1.5);
  const sweepFilter = audio.createBiquadFilter();
  sweepFilter.type = "lowpass";
  sweepFilter.frequency.setValueAtTime(220, now);
  sweepFilter.frequency.exponentialRampToValueAtTime(2400, now + 1.5);
  sweepGain.gain.setValueAtTime(0.0001, now);
  sweepGain.gain.exponentialRampToValueAtTime(0.55, now + 0.5);
  sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);
  sweep.connect(sweepFilter).connect(sweepGain).connect(master);
  sweep.start(now);
  sweep.stop(now + 2);

  // 2. Chimes cristalinos (confirmação de sistemas)
  [
    { freq: 880, at: 1.35 },
    { freq: 1320, at: 1.58 },
  ].forEach(({ freq, at }) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(0.32, now + at + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 1.1);
    osc.connect(gain).connect(master);
    osc.start(now + at);
    osc.stop(now + at + 1.2);
  });

  // 3. Subgrave de impacto
  const sub = audio.createOscillator();
  const subGain = audio.createGain();
  sub.type = "sine";
  sub.frequency.setValueAtTime(110, now + 1.3);
  sub.frequency.exponentialRampToValueAtTime(38, now + 2.1);
  subGain.gain.setValueAtTime(0.0001, now + 1.3);
  subGain.gain.exponentialRampToValueAtTime(0.5, now + 1.4);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
  sub.connect(subGain).connect(master);
  sub.start(now + 1.3);
  sub.stop(now + 2.5);

  startHum();
}

/** Hum ambiente contínuo e discreto — a sala de máquinas do NEXUS. */
export function startHum(): void {
  const audio = context();
  if (!audio || humGain) return;
  const osc = audio.createOscillator();
  const lfo = audio.createOscillator();
  const lfoGain = audio.createGain();
  humGain = audio.createGain();

  osc.type = "sine";
  osc.frequency.value = 58;
  lfo.type = "sine";
  lfo.frequency.value = 0.18; // respiração lenta
  lfoGain.gain.value = 0.012;
  humGain.gain.value = 0.022;

  lfo.connect(lfoGain).connect(humGain.gain);
  osc.connect(humGain).connect(audio.destination);
  osc.start();
  lfo.start();
}

export function stopHum(): void {
  if (!humGain || !ctx) return;
  humGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
  humGain = null;
}

/** Bipe curto de confirmação (ex.: rosto reconhecido). */
export function playConfirm(ok = true): void {
  const audio = context();
  if (!audio) return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(ok ? 660 : 300, now);
  osc.frequency.exponentialRampToValueAtTime(ok ? 1180 : 170, now + 0.18);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.5);
}

/**
 * Efeito sonoro holográfico futurista (estilo JARVIS) disparado quando cada painel se materializa.
 * Varia o pitch de acordo com a sequência de cartões (Clima, Agenda, Mercado, Notícias, Saúde).
 */
export function playPanelAppearSound(index = 0): void {
  const audio = context();
  if (!audio) return;
  const now = audio.currentTime;

  const master = audio.createGain();
  master.gain.value = 0.28;
  master.connect(audio.destination);

  // 1. Chirp holográfico laser (alta frequência rápida)
  const baseFreq = 720 + index * 110;
  const chirp = audio.createOscillator();
  const chirpGain = audio.createGain();
  chirp.type = "sine";
  chirp.frequency.setValueAtTime(baseFreq * 0.75, now);
  chirp.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, now + 0.14);
  chirpGain.gain.setValueAtTime(0.001, now);
  chirpGain.gain.exponentialRampToValueAtTime(0.4, now + 0.02);
  chirpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  chirp.connect(chirpGain).connect(master);
  chirp.start(now);
  chirp.stop(now + 0.2);

  // 2. Chime cristalino holográfico de fixação do painel
  const chime = audio.createOscillator();
  const chimeGain = audio.createGain();
  chime.type = "triangle";
  chime.frequency.setValueAtTime(baseFreq, now + 0.06);
  chimeGain.gain.setValueAtTime(0.001, now + 0.06);
  chimeGain.gain.exponentialRampToValueAtTime(0.3, now + 0.09);
  chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
  chime.connect(chimeGain).connect(master);
  chime.start(now + 0.06);
  chime.stop(now + 0.4);
}

/**
 * Som de recolhimento dos painéis para dentro do Cubo Holográfico (compressão de dados HUD).
 */
export function playCubeCollapseSound(): void {
  const audio = context();
  if (!audio) return;
  const now = audio.currentTime;

  const master = audio.createGain();
  master.gain.value = 0.35;
  master.connect(audio.destination);

  // Sweep descendente que compacta no cubo
  const sweep = audio.createOscillator();
  const sweepGain = audio.createGain();
  sweep.type = "sine";
  sweep.frequency.setValueAtTime(1400, now);
  sweep.frequency.exponentialRampToValueAtTime(260, now + 0.35);

  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1600, now);
  filter.frequency.exponentialRampToValueAtTime(320, now + 0.35);

  sweepGain.gain.setValueAtTime(0.001, now);
  sweepGain.gain.exponentialRampToValueAtTime(0.45, now + 0.04);
  sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

  sweep.connect(filter).connect(sweepGain).connect(master);
  sweep.start(now);
  sweep.stop(now + 0.4);

  // Clique magnético final (trava do cubo)
  const click = audio.createOscillator();
  const clickGain = audio.createGain();
  click.type = "triangle";
  click.frequency.setValueAtTime(480, now + 0.32);
  click.frequency.exponentialRampToValueAtTime(120, now + 0.38);
  clickGain.gain.setValueAtTime(0.001, now + 0.32);
  clickGain.gain.exponentialRampToValueAtTime(0.5, now + 0.33);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  click.connect(clickGain).connect(master);
  click.start(now + 0.32);
  click.stop(now + 0.46);
}

/**
 * Som de expansão do Cubo Holográfico (abertura e desdobramento dos painéis).
 */
export function playCubeExpandSound(): void {
  const audio = context();
  if (!audio) return;
  const now = audio.currentTime;

  const master = audio.createGain();
  master.gain.value = 0.35;
  master.connect(audio.destination);

  // Sweep ascendente expansivo
  const sweep = audio.createOscillator();
  const sweepGain = audio.createGain();
  sweep.type = "sine";
  sweep.frequency.setValueAtTime(280, now);
  sweep.frequency.exponentialRampToValueAtTime(1580, now + 0.28);

  sweepGain.gain.setValueAtTime(0.001, now);
  sweepGain.gain.exponentialRampToValueAtTime(0.5, now + 0.05);
  sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

  sweep.connect(sweepGain).connect(master);
  sweep.start(now);
  sweep.stop(now + 0.36);

  // Chime holográfico de desdobramento
  const chord = [880, 1320, 1760];
  chord.forEach((freq, idx) => {
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, now + 0.18 + idx * 0.04);
    g.gain.exponentialRampToValueAtTime(0.25, now + 0.21 + idx * 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc.connect(g).connect(master);
    osc.start(now + 0.18 + idx * 0.04);
    osc.stop(now + 0.58);
  });
}