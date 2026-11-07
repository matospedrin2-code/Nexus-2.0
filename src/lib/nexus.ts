// Espelho manual dos modelos Pydantic (backend/models/nexus.py) — mantenha em sincronia.
// Nada infere entre Python e TypeScript: este par é disciplina manual.
import { apiDelete, apiGet, apiPost } from "@/lib/api";

export interface WeatherContext {
  city?: string;
  temperature?: number;
  apparent?: number;
  humidity?: number;
  wind_kmh?: number;
  condition?: string;
  temp_min?: number;
  temp_max?: number;
  rain_prob?: number;
}

export interface FinanceEntry {
  bid?: number;
  pct?: number;
}

export interface FinanceContext {
  usd?: FinanceEntry;
  eur?: FinanceEntry;
  btc?: FinanceEntry;
}

export interface NewsItem {
  title: string;
  source: string;
  link: string;
  published: string;
}

export interface BriefingContext {
  weather?: WeatherContext | null;
  finance?: FinanceContext | null;
  news?: Record<string, NewsItem[]>;
  appointments?: Array<{ id: string; title: string; time?: string | null; notes?: string | null }>;
  metrics?: Array<{ id: string; label: string; value: string; unit?: string | null; notes?: string | null }>;
  collected_at?: string;
}

export interface BriefingCard {
  type: "clima" | "agenda" | "emails" | "noticias" | "saude" | string;
  title: string;
  content: string;
}

export interface BriefingResponse {
  id: string;
  created_at: string;
  speech: string;
  full_text: string;
  cards: BriefingCard[];
  face_verified: boolean;
  source: "gemini" | "local" | string;
  context: BriefingContext;
}

export interface FaceVerifyResponse {
  verified: boolean;
  detail: string;
}

export interface PresentationResponse {
  text: string;
  face_verified: boolean;
}

export interface MusicTrack {
  video_id: string;
  title: string;
  query: string;
}

export interface ChatResponse {
  id: string;
  created_at: string;
  reply: string;
  cards: BriefingCard[];
  source: "gemini" | "local" | string;
  track?: MusicTrack | null;
  action?: "open_camera" | "close_camera" | "play_music" | "stop_music" | string | null;
}

export interface MemoryEvent {
  id: string;
  kind: "briefing" | "user" | "nexus" | string;
  text: string;
  created_at: string;
  source?: string | null;
  cards: BriefingCard[];
}

export interface Appointment {
  id: string;
  title: string;
  time?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface HealthMetric {
  id: string;
  label: string;
  value: string;
  unit?: string | null;
  notes?: string | null;
  created_at: string;
}

/* ── Chamadas tipadas pela camada /api ─────────────────────────────── */

export interface CalendarPayloadItem {
  id: string;
  summary: string;
  timeText: string;
}

export const runBriefing = (
  faceVerified: boolean,
  calendarData?: { connected: boolean; events: CalendarPayloadItem[] }
) =>
  apiPost<BriefingResponse>("/briefing", {
    face_verified: faceVerified,
    calendar_connected: calendarData?.connected ?? false,
    calendar_events: calendarData?.events ?? [],
  });

export const fetchLatestBriefing = () => apiGet<BriefingResponse | null>("/briefing/latest");

export const requestPresentation = (faceVerified: boolean) =>
  apiPost<PresentationResponse>("/presentation", { face_verified: faceVerified });

export const verifyFace = (image: string) => apiPost<FaceVerifyResponse>("/face-verify", { image });

export const sendChatMessage = (
  message: string,
  calendarData?: { connected: boolean; events: CalendarPayloadItem[] },
  cameraImage?: string | null
) =>
  apiPost<ChatResponse>("/chat", {
    message,
    calendar_connected: calendarData?.connected ?? false,
    calendar_events: calendarData?.events ?? [],
    camera_image: cameraImage ?? null,
  });

export const fetchMemory = (limit = 60) => apiGet<MemoryEvent[]>(`/memory?limit=${limit}`);

export const searchMusic = (query: string) => apiPost<MusicTrack>("/music/search", { query });

export const fetchAppointments = () => apiGet<Appointment[]>("/appointments");

export const createAppointment = (body: { title: string; time?: string; notes?: string }) =>
  apiPost<Appointment>("/appointments", body);

export const deleteAppointment = (id: string) => apiDelete<void>(`/appointments/${id}`);

export const fetchMetrics = () => apiGet<HealthMetric[]>("/metrics");

export const createMetric = (body: { label: string; value: string; unit?: string; notes?: string }) =>
  apiPost<HealthMetric>("/metrics", body);

export const deleteMetric = (id: string) => apiDelete<void>(`/metrics/${id}`);