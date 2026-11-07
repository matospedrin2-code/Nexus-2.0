import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Inicializa Firebase client
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/calendar.readonly");
provider.addScope("https://www.googleapis.com/auth/calendar.events.readonly");
// Permite seleção de conta caso o usuário queira alternar
provider.setCustomParameters({
  prompt: "select_account",
});

export interface GoogleCalendarItem {
  id: string;
  summary: string;
  timeText: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  isAllDay: boolean;
}

export interface GoogleCalendarState {
  connected: boolean;
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  } | null;
  events: GoogleCalendarItem[];
  loading: boolean;
  error?: string | null;
}

// Token de acesso em memória (conforme exigido pelas diretrizes de segurança)
let cachedAccessToken: string | null = null;
let currentEventsCache: GoogleCalendarItem[] = [];

export const getCachedAccessToken = (): string | null => cachedAccessToken;
export const getCachedEvents = (): GoogleCalendarItem[] => currentEventsCache;

type AuthCallback = (state: GoogleCalendarState) => void;
const listeners = new Set<AuthCallback>();

function notifyListeners(state: GoogleCalendarState) {
  listeners.forEach((cb) => {
    try {
      cb(state);
    } catch (e) {
      console.error("[GoogleCalendar] Erro no listener:", e);
    }
  });
}

/** Formata data/hora para exibição executiva no HUD do NEXUS */
function formatEventTime(start?: { dateTime?: string; date?: string }, end?: { dateTime?: string; date?: string }): { timeText: string; isAllDay: boolean } {
  if (!start) return { timeText: "Horário não definido", isAllDay: false };
  if (start.date && !start.dateTime) {
    return { timeText: "Dia inteiro", isAllDay: true };
  }
  if (start.dateTime) {
    const sDate = new Date(start.dateTime);
    const startStr = sDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (end?.dateTime) {
      const eDate = new Date(end.dateTime);
      const endStr = eDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return { timeText: `${startStr} às ${endStr}`, isAllDay: false };
    }
    return { timeText: `Às ${startStr}`, isAllDay: false };
  }
  return { timeText: "Hoje", isAllDay: false };
}

/** Busca os compromissos reais do dia atual diretamente na API oficial do Google Agenda */
export async function fetchTodayCalendarEvents(tokenOverride?: string): Promise<GoogleCalendarItem[]> {
  const token = tokenOverride || cachedAccessToken;
  if (!token) {
    currentEventsCache = [];
    return [];
  }

  try {
    const now = new Date();
    // Início do dia atual (00:00:00)
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    // Fim do dia atual (23:59:59)
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("timeMin", startOfDay);
    url.searchParams.set("timeMax", endOfDay);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (res.status === 401) {
      console.warn("[GoogleCalendar] Token expirado ou não autorizado.");
      cachedAccessToken = null;
      currentEventsCache = [];
      return [];
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("[GoogleCalendar] Erro ao buscar eventos:", res.status, errText);
      return [];
    }

    const data = await res.json();
    const items: any[] = data.items || [];

    const formattedEvents: GoogleCalendarItem[] = items.map((item) => {
      const { timeText, isAllDay } = formatEventTime(item.start, item.end);
      return {
        id: item.id || crypto.randomUUID(),
        summary: item.summary || "Sem título",
        timeText,
        startTime: item.start?.dateTime || item.start?.date,
        endTime: item.end?.dateTime || item.end?.date,
        location: item.location,
        description: item.description,
        isAllDay,
      };
    });

    currentEventsCache = formattedEvents;
    return formattedEvents;
  } catch (error) {
    console.error("[GoogleCalendar] Falha na requisição:", error);
    return [];
  }
}

/** Inicializa o monitoramento de autenticação do Google Calendar */
export function subscribeToCalendarAuth(callback: AuthCallback): () => void {
  listeners.add(callback);

  // Envia estado inicial
  const currentUser = auth.currentUser;
  callback({
    connected: Boolean(currentUser && cachedAccessToken),
    user: currentUser
      ? {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
        }
      : null,
    events: currentEventsCache,
    loading: false,
    error: null,
  });

  return () => {
    listeners.delete(callback);
  };
}

// Listener nativo do Firebase Auth
onAuthStateChanged(auth, async (user: User | null) => {
  if (user && cachedAccessToken) {
    const events = await fetchTodayCalendarEvents();
    notifyListeners({
      connected: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      },
      events,
      loading: false,
      error: null,
    });
  } else {
    cachedAccessToken = null;
    currentEventsCache = [];
    notifyListeners({
      connected: false,
      user: null,
      events: [],
      loading: false,
      error: null,
    });
  }
});

/** Conecta com a conta do Google e obtém token para leitura da Agenda */
export async function connectGoogleCalendar(): Promise<{
  user: User;
  events: GoogleCalendarItem[];
}> {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Não foi possível obter a credencial de acesso do Google.");
    }

    cachedAccessToken = credential.accessToken;
    const events = await fetchTodayCalendarEvents(cachedAccessToken);

    notifyListeners({
      connected: true,
      user: {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      },
      events,
      loading: false,
      error: null,
    });

    return { user: result.user, events };
  } catch (error: any) {
    console.error("[GoogleCalendar] Falha no login Google:", error);
    notifyListeners({
      connected: false,
      user: null,
      events: [],
      loading: false,
      error: error?.message || "Falha ao conectar conta Google.",
    });
    throw error;
  }
}

/** Desconecta o Google Agenda e limpa credenciais em memória */
export async function disconnectGoogleCalendar(): Promise<void> {
  cachedAccessToken = null;
  currentEventsCache = [];
  await signOut(auth);
  notifyListeners({
    connected: false,
    user: null,
    events: [],
    loading: false,
    error: null,
  });
}
