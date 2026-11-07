import { useEffect, useRef } from "react";
import { orbBus } from "@/lib/orbBus";

interface Particle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  offset: number;
  drift: number;
}

const RING_COUNT = 3;
const BAR_COUNT = 72;

/**
 * Núcleo do NEXUS — canvas em azul neon (#00F0FF).
 * Respiração contínua no repouso, espectro reativo à fala e enxame de partículas
 * que acelera conforme o nível de áudio processado.
 */
export default function ReactiveOrbCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const count = reduced ? 60 : 420;
    const particles: Particle[] = Array.from({ length: count }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: Math.random(),
      speed: (0.12 + Math.random() * 0.75) * (Math.random() > 0.5 ? 1 : -1),
      size: 0.5 + Math.random() * 1.9,
      offset: Math.random() * Math.PI * 2,
      drift: 0.4 + Math.random() * 1.8,
    }));

    // Espectro suavizado: cada barra persegue o nível com inércia própria.
    const bars = new Float32Array(BAR_COUNT);
    const seeds = Array.from({ length: BAR_COUNT }, () => Math.random() * Math.PI * 2);

    let raf = 0;
    let last = performance.now();
    let t = 0;
    let level = 0.2;
    let breath = 0;

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;

      const speaking = orbBus.state === "speaking";
      const thinking = orbBus.state === "thinking";
      const listening = orbBus.state === "listening";

      // Respiração: inspiração/expiração lenta mesmo em repouso.
      breath = (Math.sin(t * 0.55) + 1) / 2; // 0..1
      const idleBase = 0.18 + breath * 0.16;
      const target = speaking || thinking || listening
        ? Math.max(0.1, Math.min(1, orbBus.intensity))
        : idleBase;
      // Ataque rápido, relaxamento lento — sensação orgânica.
      const smoothing = target > level ? dt * 14 : dt * 4.5;
      level += (target - level) * Math.min(1, smoothing);

      const cx = width / 2;
      const cy = height / 2;
      const base = Math.min(width, height) / 2;
      const breathScale = 1 + breath * 0.045;
      const scale = (1 + level * 0.4) * breathScale;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      // ── Halo volumétrico
      const coreR = base * 0.3 * scale;
      const halo = ctx.createRadialGradient(cx, cy, coreR * 0.2, cx, cy, coreR * 2.8);
      halo.addColorStop(0, `rgba(170, 250, 255, ${0.5 + level * 0.4})`);
      halo.addColorStop(0.25, `rgba(0, 240, 255, ${0.28 + level * 0.4})`);
      halo.addColorStop(0.6, `rgba(0, 140, 255, ${0.08 + level * 0.18})`);
      halo.addColorStop(1, "rgba(3, 7, 18, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 2.8, 0, Math.PI * 2);
      ctx.fill();

      // ── Espectro radial (reage palavra a palavra)
      const barInner = base * 0.44;
      for (let i = 0; i < BAR_COUNT; i += 1) {
        const wave = (Math.sin(t * 7 + seeds[i]) + 1) / 2;
        const noise = (Math.sin(t * 13.7 + seeds[i] * 2.3) + 1) / 2;
        const peak = level * (0.45 + wave * 0.75 * (speaking ? 1 : 0.35) + noise * 0.3);
        bars[i] += (peak - bars[i]) * Math.min(1, dt * 11);
        const len = base * 0.08 + bars[i] * base * 0.34;
        const angle = (i / BAR_COUNT) * Math.PI * 2 + t * 0.08;
        const x1 = cx + Math.cos(angle) * barInner;
        const y1 = cy + Math.sin(angle) * barInner;
        const x2 = cx + Math.cos(angle) * (barInner + len);
        const y2 = cy + Math.sin(angle) * (barInner + len);
        ctx.strokeStyle = `rgba(0, 240, 255, ${0.14 + bars[i] * 0.6})`;
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // ── Anéis orbitais inclinados
      for (let r = 0; r < RING_COUNT; r += 1) {
        const ratio = 0.52 + r * 0.13;
        const spin = t * (r % 2 === 0 ? 0.32 : -0.22) + r;
        const radius = base * ratio * (1 + level * 0.16);
        ctx.strokeStyle = `rgba(56, 189, 248, ${(0.42 - r * 0.1) * (0.35 + level * 0.75)})`;
        ctx.lineWidth = 1.5 - r * 0.3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius, radius * (0.42 + r * 0.22), spin, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── Arco de varredura (radar)
      ctx.strokeStyle = `rgba(0, 240, 255, ${0.5 + level * 0.4})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cx, cy, base * 0.86, t * 1.1, t * 1.1 + 0.9);
      ctx.stroke();
      ctx.strokeStyle = `rgba(0, 240, 255, ${0.2 + level * 0.3})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, base * 0.93, -t * 0.7, -t * 0.7 + 0.45);
      ctx.stroke();

      // ── Enxame de partículas
      for (const p of particles) {
        p.angle += p.speed * dt * (0.5 + level * 3.4);
        const pulse = Math.sin(t * p.drift + p.offset);
        const rr = base * (0.34 + p.radius * 0.56) * (1 + level * 0.2) + pulse * (4 + level * 14);
        const x = cx + Math.cos(p.angle) * rr;
        const y = cy + Math.sin(p.angle) * rr * 0.9;
        const alpha = 0.12 + level * 0.6 + (pulse + 1) * 0.08;
        ctx.fillStyle = `rgba(${150 + level * 90}, 245, 255, ${Math.min(0.95, alpha)})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size * (0.7 + level * 0.9), 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Núcleo incandescente
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      core.addColorStop(0, `rgba(255, 255, 255, ${0.85 + level * 0.15})`);
      core.addColorStop(0.35, `rgba(180, 250, 255, ${0.6 + level * 0.3})`);
      core.addColorStop(1, "rgba(0, 190, 255, 0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      data-testid="nexus-reactive-orb"
      aria-hidden="true"
    />
  );
}