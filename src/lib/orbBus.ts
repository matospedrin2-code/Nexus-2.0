// Barramento compartilhado entre o áudio (Web Speech) e o canvas do orbe.
// Valores mutáveis lidos a cada frame — nada de re-render do React por frame.
export type OrbState = "offline" | "idle" | "listening" | "thinking" | "speaking";

export const orbBus = {
  state: "idle" as OrbState,
  intensity: 0.25,
};

export function setOrbState(state: OrbState, intensity?: number): void {
  orbBus.state = state;
  if (intensity !== undefined) orbBus.intensity = intensity;
}