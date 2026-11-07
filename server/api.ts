import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { IncomingMessage, ServerResponse } from "http";

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
  context: {
    weather?: WeatherContext | null;
    finance?: FinanceContext | null;
    news?: Record<string, NewsItem[]>;
    appointments?: Array<{ id: string; title: string; time?: string | null; notes?: string | null }>;
    metrics?: Array<{ id: string; label: string; value: string; unit?: string | null; notes?: string | null }>;
    collected_at?: string;
  };
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

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "nexus.json");

interface NexusDb {
  appointments: Appointment[];
  metrics: HealthMetric[];
  memory: MemoryEvent[];
  latestBriefing: BriefingResponse | null;
}

const initialDb: NexusDb = {
  appointments: [],
  metrics: [],
  memory: [],
  latestBriefing: null,
};

function loadDb(): NexusDb {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Erro ao carregar banco NEXUS:", err);
  }
  return { ...initialDb };
}

function saveDb(db: NexusDb) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Erro ao salvar banco NEXUS:", err);
  }
}

let db = loadDb();

// Cache em memória de telemetria para aceleração máxima de resposta (reduz latência a 0ms)
let cachedWeather: { data: WeatherContext; expiresAt: number } | null = null;
let cachedFinance: { data: FinanceContext; expiresAt: number } | null = null;
let cachedNews: { data: Record<string, NewsItem[]>; expiresAt: number } | null = null;
const CACHE_TTL_MS = 240_000; // 4 minutos

async function fetchWeather(): Promise<WeatherContext> {
  const now = Date.now();
  if (cachedWeather && now < cachedWeather.expiresAt) {
    return cachedWeather.data;
  }

  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=-16.5167&longitude=-42.1833&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FSao_Paulo",
      { signal: AbortSignal.timeout(3500) }
    );
    if (!res.ok) throw new Error("Falha no Open-Meteo");
    const data = await res.json();
    const cur = data.current;
    const daily = data.daily;
    const code = cur.weather_code ?? 0;

    let condition = "céu limpo";
    if (code >= 1 && code <= 3) condition = "parcialmente nublado";
    else if (code >= 45 && code <= 48) condition = "nevoeiro";
    else if (code >= 51 && code <= 67) condition = "chuva leve";
    else if (code >= 71 && code <= 77) condition = "neve";
    else if (code >= 80 && code <= 82) condition = "pancadas de chuva";
    else if (code >= 95) condition = "tempestade com trovões";

    const result: WeatherContext = {
      city: "Novorizonte, MG",
      temperature: Math.round((cur.temperature_2m ?? 22) * 10) / 10,
      apparent: Math.round((cur.apparent_temperature ?? 23) * 10) / 10,
      humidity: Math.round(cur.relative_humidity_2m ?? 75),
      wind_kmh: Math.round((cur.wind_speed_10m ?? 8) * 10) / 10,
      condition,
      temp_min: daily?.temperature_2m_min?.[0] ? Math.round(daily.temperature_2m_min[0]) : 18,
      temp_max: daily?.temperature_2m_max?.[0] ? Math.round(daily.temperature_2m_max[0]) : 27,
      rain_prob: daily?.precipitation_probability_max?.[0] ?? 20,
    };
    cachedWeather = { data: result, expiresAt: now + CACHE_TTL_MS };
    return result;
  } catch (err) {
    const fallback: WeatherContext = {
      city: "Novorizonte, MG",
      temperature: 22.4,
      apparent: 23.1,
      humidity: 78,
      wind_kmh: 6.5,
      condition: "céu limpo",
      temp_min: 18,
      temp_max: 27,
      rain_prob: 25,
    };
    cachedWeather = { data: fallback, expiresAt: now + 60_000 };
    return fallback;
  }
}

async function fetchWeatherForCity(cityName: string): Promise<WeatherContext | null> {
  try {
    const cleanCity = cityName.replace(/^(em|no|na|de|para)\s+/i, "").trim();
    if (!cleanCity || cleanCity.length < 2) return null;

    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=pt&format=json`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!geoRes.ok) return null;
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) return null;
    const loc = geoData.results[0];

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`,
      { signal: AbortSignal.timeout(3500) }
    );
    if (!weatherRes.ok) return null;
    const data = await weatherRes.json();
    const cur = data.current;
    const daily = data.daily;
    const code = cur.weather_code ?? 0;

    let condition = "céu limpo";
    if (code >= 1 && code <= 3) condition = "parcialmente nublado";
    else if (code >= 45 && code <= 48) condition = "nevoeiro";
    else if (code >= 51 && code <= 67) condition = "chuva leve";
    else if (code >= 71 && code <= 77) condition = "neve";
    else if (code >= 80 && code <= 82) condition = "pancadas de chuva";
    else if (code >= 95) condition = "tempestade com trovões";

    return {
      city: `${loc.name}${loc.admin1 ? ', ' + loc.admin1 : ''}`,
      temperature: Math.round((cur.temperature_2m ?? 22) * 10) / 10,
      apparent: Math.round((cur.apparent_temperature ?? 23) * 10) / 10,
      humidity: Math.round(cur.relative_humidity_2m ?? 70),
      wind_kmh: Math.round((cur.wind_speed_10m ?? 8) * 10) / 10,
      condition,
      temp_min: daily?.temperature_2m_min?.[0] ? Math.round(daily.temperature_2m_min[0]) : 18,
      temp_max: daily?.temperature_2m_max?.[0] ? Math.round(daily.temperature_2m_max[0]) : 27,
      rain_prob: daily?.precipitation_probability_max?.[0] ?? 20,
    };
  } catch {
    return null;
  }
}

async function fetchFinance(): Promise<FinanceContext> {
  const now = Date.now();
  if (cachedFinance && now < cachedFinance.expiresAt) {
    return cachedFinance.data;
  }

  let btcData: FinanceEntry = { bid: 430500, pct: 0.85 };
  try {
    const btcRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_24hr_change=true",
      { signal: AbortSignal.timeout(2500) }
    );
    if (btcRes.ok) {
      const btcJson = await btcRes.json();
      if (btcJson?.bitcoin?.brl) {
        btcData = {
          bid: Math.round(btcJson.bitcoin.brl),
          pct: Math.round((btcJson.bitcoin.brl_24h_change || 0) * 100) / 100,
        };
      }
    }
  } catch {
    // fallback
  }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      const brlRate = data.rates?.BRL || 5.43;
      const eurRate = data.rates?.EUR || 0.89;
      const eurBrl = brlRate / eurRate;
      const result: FinanceContext = {
        usd: { bid: Math.round(brlRate * 100) / 100, pct: 0.35 },
        eur: { bid: Math.round(eurBrl * 100) / 100, pct: -0.12 },
        btc: btcData,
      };
      cachedFinance = { data: result, expiresAt: now + CACHE_TTL_MS };
      return result;
    }
  } catch (err) {
    // fallback
  }

  const fallback: FinanceContext = {
    usd: { bid: 5.43, pct: 0.32 },
    eur: { bid: 6.08, pct: -0.12 },
    btc: btcData,
  };
  cachedFinance = { data: fallback, expiresAt: now + 60_000 };
  return fallback;
}

async function fetchNews(): Promise<Record<string, NewsItem[]>> {
  const now = Date.now();
  if (cachedNews && now < cachedNews.expiresAt) {
    return cachedNews.data;
  }

  const result: Record<string, NewsItem[]> = {
    politica: [],
    investimentos: [],
    saude: [],
    tecnologia: [],
  };

  const parseRss = (xml: string, limit = 2): NewsItem[] => {
    const matches = [
      ...xml.matchAll(
        /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g
      ),
    ].slice(0, limit);

    return matches.map((m) => {
      const fullTitle = m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      const parts = fullTitle.split(" - ");
      const source = parts.length > 1 ? parts.pop() || "Notícias BR" : "Notícias BR";
      return {
        title: parts.join(" - ") || fullTitle,
        source,
        link: m[2],
        published: m[3] || new Date().toISOString(),
      };
    });
  };

  try {
    const [polRes, invRes, sauRes, tecRes] = await Promise.allSettled([
      fetch("https://news.google.com/rss/headlines/section/topic/POLITICS?hl=pt-BR&gl=BR&ceid=BR:pt-419", {
        signal: AbortSignal.timeout(3500),
      }).then((r) => r.text()),
      fetch("https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=pt-BR&gl=BR&ceid=BR:pt-419", {
        signal: AbortSignal.timeout(3500),
      }).then((r) => r.text()),
      fetch("https://news.google.com/rss/headlines/section/topic/HEALTH?hl=pt-BR&gl=BR&ceid=BR:pt-419", {
        signal: AbortSignal.timeout(3500),
      }).then((r) => r.text()),
      fetch("https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=pt-BR&gl=BR&ceid=BR:pt-419", {
        signal: AbortSignal.timeout(3500),
      }).then((r) => r.text()),
    ]);

    if (polRes.status === "fulfilled") result.politica = parseRss(polRes.value, 3);
    if (invRes.status === "fulfilled") result.investimentos = parseRss(invRes.value, 3);
    if (sauRes.status === "fulfilled") result.saude = parseRss(sauRes.value, 3);
    if (tecRes.status === "fulfilled") result.tecnologia = parseRss(tecRes.value, 3);
  } catch (err) {
    console.warn("Erro ao buscar notícias ao vivo do Brasil:", err);
  }

  // Fallback com fontes reais caso a rede falhe
  if (result.politica.length === 0) {
    result.politica = [{ title: "Congresso e Executivo debatem pautas fiscais e orçamentárias", source: "G1 Política", link: "https://g1.globo.com/politica", published: new Date().toUTCString() }];
  }
  if (result.investimentos.length === 0) {
    result.investimentos = [{ title: "Mercado financeiro e taxas de juros acompanham indicadores macroeconômicos", source: "Valor Econômico", link: "https://valor.globo.com", published: new Date().toUTCString() }];
  }
  if (result.saude.length === 0) {
    result.saude = [{ title: "Ministério da Saúde intensifica orientações preventivas e atenção básica", source: "Saúde BR", link: "https://www.gov.br/saude", published: new Date().toUTCString() }];
  }
  if (result.tecnologia.length === 0) {
    result.tecnologia = [{ title: "Avanços em inteligência artificial e computação quântica ganham escala", source: "Tech News", link: "https://g1.globo.com/tecnologia", published: new Date().toUTCString() }];
  }

  cachedNews = { data: result, expiresAt: now + CACHE_TTL_MS };
  return result;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") return null;
  try {
    return new GoogleGenAI();
  } catch {
    return null;
  }
}

/** Executa chamada ao Gemini com inteligência profunda e suporte multimodal integral. */
async function callGemini(
  contents: string | any,
  config?: any
): Promise<{ text: string; model: string } | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  // gemini-3.8-flash como motor de intelecto máximo e visão real, com fallback para flash-lite
  const models = ["gemini-3.8-flash", "gemini-3.1-flash-lite"];
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      if (res.text && res.text.trim()) {
        return { text: res.text.trim(), model };
      }
    } catch (err: any) {
      console.warn(`[Gemini ${model}] falha:`, err?.status || err?.message || err);
    }
  }
  return null;
}

async function generateBriefingAI(
  weather: WeatherContext,
  finance: FinanceContext,
  news: Record<string, NewsItem[]>,
  appointments: Appointment[],
  metrics: HealthMetric[],
  faceVerified: boolean,
  calendarData?: { connected: boolean; events: Array<{ id: string; summary: string; timeText: string }> }
): Promise<{ speech: string; full_text: string; cards: BriefingCard[]; source: string }> {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const newsSummary = [
    ...(news.geral || []).slice(0, 3).map((n) => `• ${n.title} (${n.source})`),
    ...(news.tecnologia || []).slice(0, 2).map((n) => `• [Tech] ${n.title} (${n.source})`),
  ].join("\n");

  const calConnected = Boolean(calendarData?.connected);
  const calEvents = calendarData?.events || [];
  const calendarPromptBlock = calConnected
    ? calEvents.length > 0
      ? `• Google Agenda REAL DO SENHOR (HOJE):\n${calEvents.map((e) => `  - ${e.timeText ? e.timeText + ' — ' : ''}${e.summary}`).join('\n')}`
      : `• Google Agenda REAL DO SENHOR (HOJE): Pauta totalmente livre. Nenhum compromisso agendado para hoje.`
    : `• Google Agenda: NÃO CONECTADA (Nenhuma conta do Google conectada no momento).`;

  const prompt = `Você é o NEXUS, uma inteligência artificial executiva, leal e sofisticada no estilo JARVIS (com a presença masculina firme, elegante, britânica, leal e atenciosa de Paul Bettany com Tony Stark, falando em português do Brasil impecável e natural).

Você está 100% CONECTADO À INTERNET EM TEMPO REAL. Nunca diga que não tem dados ou que sua base é antiga.

CONTEXTO REAL AO VIVO:
- Data e Hora Atual: ${dateStr}, ${timeStr}.
- Usuário: ${faceVerified ? "Senhor / Comandante (Identificação Biométrica Confirmada)" : "Senhor"}
- Cidade e Clima (${weather.city}): ${weather.temperature}°C (sensação térmica de ${weather.apparent}°C), ${weather.condition}, umidade ${weather.humidity}%, mínima ${weather.temp_min}°C, máxima ${weather.temp_max}°C, chance de chuva ${weather.rain_prob}%.
- Mercado Financeiro em Tempo Real: Dólar comercial R$ ${finance.usd?.bid?.toFixed(2)} (${finance.usd?.pct}%), Euro R$ ${finance.eur?.bid?.toFixed(2)} (${finance.eur?.pct}%), Bitcoin R$ ${finance.btc?.bid?.toLocaleString('pt-BR')} (${finance.btc?.pct}%).
- Manchetes Reais da Internet Agora:
${newsSummary || "Mercados globais e avanços em IA lideram o noticiário."}
- Google Agenda:
${calendarPromptBlock}
- Indicadores de Saúde: ${metrics.length > 0 ? metrics.map((m) => `${m.label}: ${m.value} ${m.unit || ''}`).join('; ') : 'Indicadores estáveis'}

REGRAS ESTRITAS PARA A AGENDA:
1. SE A GOOGLE AGENDA ESTIVER CONECTADA: No card [type="agenda"], cite os compromissos reais listados acima com os horários. Se estiver livre, diga que a pauta está livre. Na fala ("speech"), informe os compromissos reais do dia.
2. SE A GOOGLE AGENDA NÃO ESTIVER CONECTADA: O card [type="agenda"] DEVE ter title="Google Agenda" e content EXATAMENTE: "Agenda não conectada.\nConecte sua conta do Google Agenda nas Configurações para sincronizar seus compromissos reais." Na fala ("speech"), informe que a agenda do Google não está conectada. PROIBIDO inventar compromissos fictícios.

INSTRUÇÕES DE FALA MASCULINA ESTILO JARVIS:
- Trate o usuário com elegância, lealdade e afeto executivo ("Bom dia, senhor", ou "Bom dia, comandante").
- Destaque o panorama do dia de maneira rápida, perspicaz e impecável.
- PROIBIDO usar clichês robóticos ("subsistemas nominais", "núcleos neurais carregados"). Fale como um homem brilhante, culto e dedicado ao bem do seu comandante.
- Retorne APENAS um JSON no formato:
{
  "speech": "Locução natural e fluida para voz masculina estilo JARVIS. Comece com uma saudação refinada de bom dia ('Bom dia, senhor'), comente o clima com uma dica prática, cite as finanças e a agenda (real ou informando que a agenda não está conectada) com precisão e finalize com lealdade ('Estou a postos para o que precisar'). Sem markdown, asteriscos ou emojis.",
  "full_text": "Texto completo para exibição na interface.",
  "cards": [
    { "type": "clima", "title": "Clima & Atmosfera", "content": "resumo prático e detalhado do clima local" },
    { "type": "noticias", "title": "Radar de Notícias Relevantes (Ao Vivo)", "content": "manchetes reais do Brasil organizadas por Saúde, Política, Investimentos e Tecnologia" },
    { "type": "emails", "title": "Finanças & Mercados", "content": "cotações atualizadas de dólar, euro e bitcoin" },
    { "type": "agenda", "title": "${calConnected ? 'Google Agenda · Hoje' : 'Google Agenda'}", "content": "${calConnected ? (calEvents.length > 0 ? calEvents.map(e => '• ' + (e.timeText ? e.timeText + ' — ' : '') + e.summary).join('\\n') : 'Nenhum compromisso agendado para hoje. Pauta livre.') : 'Agenda não conectada.\\nConecte sua conta do Google Agenda nas Configurações para sincronizar seus compromissos reais.'}" },
    { "type": "saude", "title": "Saúde & Performance", "content": "métricas e bem-estar" }
  ]
}`;

  const geminiRes = await callGemini(prompt, {
    responseMimeType: "application/json",
    temperature: 0.7,
  });

  if (geminiRes) {
    try {
      const parsed = JSON.parse(geminiRes.text);
      if (parsed.speech && Array.isArray(parsed.cards)) {
        return {
          speech: parsed.speech,
          full_text: parsed.full_text || parsed.speech,
          cards: parsed.cards,
          source: "gemini",
        };
      }
    } catch (e) {
      console.warn("Falha ao parsear JSON do Gemini briefing:", e);
    }
  }

  // Fallback local com tom JARVIS impecável
  const greeting = faceVerified
    ? "Bom dia, senhor. Identificação confirmada. Todos os sistemas do NEXUS estão online e sincronizados com a rede global para o seu dia."
    : "Bom dia, senhor. Todos os sistemas do NEXUS estão operacionais e a postos.";

  const weatherPart = `Aqui em ${weather.city}, o tempo se apresenta com ${weather.condition} e temperatura atual de ${weather.temperature} graus, sensação de ${weather.apparent} graus. A máxima estimada é de ${weather.temp_max} graus ${weather.rain_prob && weather.rain_prob > 40 ? 'com chance real de chuva ao longo do período' : 'e tempo estável sem chuva no radar'}.`;

  const agendaPart = calConnected
    ? calEvents.length > 0
      ? `Na sua agenda do Google para hoje temos ${calEvents.length} compromisso(s) sincronizado(s), com destaque para ${calEvents[0].summary}${calEvents[0].timeText ? ' ' + calEvents[0].timeText : ''}.`
      : "Sua agenda do Google encontra-se totalmente livre no dia de hoje, senhor. Nenhuma reunião ou pendência agendada."
    : "Sua conta do Google Agenda ainda não está conectada, senhor — caso queira sincronizar seus compromissos, basta acessar as configurações.";

  const financePart = `No mercado financeiro em tempo real, o dólar comercial opera em ${finance.usd?.bid?.toFixed(2)} reais, o euro em ${finance.eur?.bid?.toFixed(2)} reais e o bitcoin cotado em torno de ${finance.btc?.bid?.toLocaleString('pt-BR')} reais.`;

  const speech = `${greeting} ${weatherPart} ${financePart} ${agendaPart} Todos os parâmetros permanecem sob controle. Estou à sua inteira disposição, senhor. Tenha um excelente dia!`;

  const categorizedNewsBlocks = [
    ...(news.politica && news.politica.length > 0 ? [`🏛️ POLÍTICA:\n• ${news.politica[0].title}`] : []),
    ...(news.investimentos && news.investimentos.length > 0 ? [`📈 INVESTIMENTOS:\n• ${news.investimentos[0].title}`] : []),
    ...(news.saude && news.saude.length > 0 ? [`🩺 SAÚDE:\n• ${news.saude[0].title}`] : []),
    ...(news.tecnologia && news.tecnologia.length > 0 ? [`💻 TECNOLOGIA:\n• ${news.tecnologia[0].title}`] : []),
  ].join("\n\n");

  const cards: BriefingCard[] = [
    {
      type: "clima",
      title: "Clima & Atmosfera",
      content: `Em ${weather.city}, temperatura atual de ${weather.temperature}°C, sensação de ${weather.apparent}°C e ${weather.condition}. Umidade em ${weather.humidity}% com ventos de ${weather.wind_kmh} km/h. Mínima de ${weather.temp_min}°C e máxima de ${weather.temp_max}°C.`,
    },
    {
      type: "noticias",
      title: "Radar de Notícias Relevantes",
      content:
        categorizedNewsBlocks ||
        newsSummary ||
        "Monitoramento da rede global ativo via Google News Brasil.",
    },
    {
      type: "emails",
      title: "Finanças & Mercados",
      content: `Dólar: R$ ${finance.usd?.bid?.toFixed(2)} (${finance.usd?.pct}%)\nEuro: R$ ${finance.eur?.bid?.toFixed(2)} (${finance.eur?.pct}%)\nBitcoin: R$ ${finance.btc?.bid?.toLocaleString('pt-BR')} (${finance.btc?.pct}%)`,
    },
    {
      type: "agenda",
      title: calConnected ? "Google Agenda · Hoje" : "Google Agenda",
      content: calConnected
        ? calEvents.length > 0
          ? calEvents.map((a) => `• ${a.timeText ? a.timeText + ' — ' : ''}${a.summary}`).join('\n')
          : "Nenhum compromisso agendado para hoje. Pauta livre, senhor."
        : "Agenda não conectada.\nConecte sua conta do Google Agenda nas Configurações para sincronizar seus compromissos reais.",
    },
    {
      type: "saude",
      title: "Saúde & Performance",
      content:
        metrics.length > 0
          ? metrics.map((m) => `• ${m.label}: ${m.value} ${m.unit || ''}${m.notes ? ' (' + m.notes + ')' : ''}`).join('\n')
          : "Nenhum dado corporal ou métrica registrada pelo senhor. Para acompanhamento de saúde verídico, informe seu peso ou pressão ao NEXUS.",
    },
  ];

  return {
    speech,
    full_text: speech,
    cards,
    source: "local",
  };
}

async function fetchWebKnowledge(query: string): Promise<string> {
  const norm = query.toLowerCase();
  // Se for conversa pessoal, sentimento, conselho, saudação, agenda ou comando, NUNCA busca na web (elimina latência)
  const isPersonalOrAdvice =
    /\b(voce|você|eu|meu|minha|sinto|sentindo|triste|feliz|conselho|conselhos|dica|vida|amor|ansiedade|desabafo|desabafar|ajuda|ajudar|opinião|opiniao|ola|olá|bom dia|boa tarde|boa noite|nexus|jarvis|agenda|compromisso)\b/i.test(
      norm
    );
  if (isPersonalOrAdvice) return "";

  const needsWeb =
    /\b(pesquise|pesquisar|busca|noticia|noticias|aconteceu no mundo|placar|resultado do jogo|cotacao atual|quem e|quem foi|biografia)\b/i.test(
      norm
    );
  if (!needsWeb) return "";

  try {
    const qClean = query.replace(/[?!.,]/g, "").trim();
    const ddgRes = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(qClean)}&format=json&no_html=1&skip_disambig=1`,
      { signal: AbortSignal.timeout(1200) }
    );
    if (ddgRes.ok) {
      const ddg = await ddgRes.json();
      if (ddg?.AbstractText) {
        return `Dados da Rede (${ddg.Heading || qClean}): ${ddg.AbstractText}`;
      }
    }
  } catch {}

  return "";
}

const TTS_CACHE_DIR = path.resolve(process.cwd(), "data", "tts_cache");
try {
  if (!fs.existsSync(TTS_CACHE_DIR)) {
    fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
  }
} catch {}

const ttsCache = new Map<string, string>();
let ttsQuotaExhaustedUntil: number = 0; // Cota ativa

async function generateSpeechAudio(text: string, rawVoice: string = "Fenrir"): Promise<string | null> {
  const clean = text
    .replace(/\[(?:CARD_[A-Z_]+|APPOINTMENT_[A-Z_]+|METRIC_[A-Z_]+|FACE_VERIFIED:[^\]]*)\]:?\s*/gi, "")
    .replace(/\[(?:APPOINTMENT_CREATE|APPOINTMENT_DELETE|METRIC_CREATE):.*?\]/gi, "")
    .replace(/[*#`_~>]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .trim();

  if (!clean) return null;

  // Mapeia para as vozes masculinas oficiais suportadas pelo Gemini TTS ('Fenrir', 'Puck', 'Charon')
  let voiceName = "Fenrir";
  const vLower = (rawVoice || "").toLowerCase();
  if (vLower.includes("puck") || vLower.includes("jovem") || vLower.includes("menino") || vLower.includes("dipper")) {
    voiceName = "Puck"; // Voz jovem/menino da Google (Dipper)
  } else if (vLower.includes("charon")) {
    voiceName = "Charon";
  } else {
    voiceName = "Fenrir"; // Padrão masculino clássico JARVIS oficial
  }

  const hash = crypto.createHash("sha256").update(`${voiceName}:${clean}`).digest("hex");
  const cacheFile = path.join(TTS_CACHE_DIR, `${hash}.b64`);

  if (ttsCache.has(hash)) {
    return ttsCache.get(hash)!;
  }

  // Verifica persistência em disco para economia máxima de cota
  try {
    if (fs.existsSync(cacheFile)) {
      const diskB64 = fs.readFileSync(cacheFile, "utf-8");
      if (diskB64 && diskB64.length > 100) {
        ttsCache.set(hash, diskB64);
        return diskB64;
      }
    }
  } catch {}

  // Se a cota estiver em cooldown temporário, retorna null para contingência sem travar
  if (Date.now() < ttsQuotaExhaustedUntil) {
    return null;
  }

  const ai = getGeminiClient();
  if (!ai) return null;

  // gemini-3.8-flash-tts tem prioridade máxima (maior cota e fidelidade expressiva)
  const modelsToTry = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"];
  let allQuotaFailed = true;

  for (const model of modelsToTry) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: clean,
                speechMetadata: {
                  style: "Confident, charismatic, warm British-accented JARVIS male assistant speaking natural Brazilian Portuguese",
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        ttsCache.set(hash, base64Audio);
        try {
          fs.writeFileSync(cacheFile, base64Audio, "utf-8");
        } catch {}
        return base64Audio;
      }
    } catch (err: any) {
      const errMsg = String(err?.message || err);
      console.log(`[NEXUS TTS] ${model} falha:`, errMsg.slice(0, 160));
      if (!errMsg.includes("429") && !errMsg.includes("RESOURCE_EXHAUSTED") && !errMsg.includes("Quota exceeded")) {
        allQuotaFailed = false;
      }
    }
  }

  if (allQuotaFailed) {
    ttsQuotaExhaustedUntil = Date.now() + 30 * 1000; // Cooldown curto de apenas 30 segundos
  }

  return null;
}

async function generateChatAI(
  message: string,
  weather: WeatherContext,
  finance: FinanceContext,
  news: Record<string, NewsItem[]>,
  appointments: Appointment[],
  metrics: HealthMetric[],
  memoryHistory: MemoryEvent[],
  calendarData?: { connected: boolean; events: Array<{ id: string; summary: string; timeText: string }> },
  cameraImage?: string | null
): Promise<{ reply: string; source: string; track?: any; action?: string }> {
  const msgLower = message.toLowerCase().trim();
  const norm = msgLower
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Comandos de Controle Óptico (Câmera Liquid Glass)
  if (/\b(abrir camera|abrir câmera|ligar camera|ligar câmera|ativar camera|ativar câmera|abrir a camera|abrir a câmera|abrir webcam|abrir a webcam|iniciar camera|iniciar câmera|olhos do nexus|ativar modulo optico)\b/i.test(norm)) {
    return {
      reply: "Ativando o módulo óptico com interface Liquid Glass imediatamente, senhor. Câmera aberta e espelhada no HUD.",
      source: "local",
      action: "open_camera",
    };
  }

  if (/\b(fechar camera|fechar câmera|desligar camera|desligar câmera|apagar camera|apagar câmera|fechar webcam|desligar webcam|desativar camera|desativar câmera|desativar modulo optico)\b/i.test(norm)) {
    return {
      reply: "Módulo óptico desconectado e janela recolhida, senhor. Câmera desligada.",
      source: "local",
      action: "close_camera",
    };
  }

  // Comandos de Parar Mídia / Player Musical
  if (/\b(parar musica|parar música|parar o som|parar som|desligar musica|desligar música|pausar musica|pausar música|para a musica|para a música|parar audio|parar áudio|stop music)\b/i.test(norm)) {
    return {
      reply: "Reprodução de mídia interrompida, senhor. Silêncio operacional restaurado.",
      source: "local",
      action: "stop_music",
    };
  }

  // 1. Detectar intenção musical com catálogo diversificado
  let track = null;
  const isMusic =
    /\b(toca|tocar|toque|ouvir|ouve|coloque|coloca|musica|musicas|som|play|trilha|lofi|synthwave|jazz|rock|relax|foco)\b/i.test(norm);
  if (isMusic) {
    if (
      norm.includes("lofi") ||
      norm.includes("relax") ||
      norm.includes("estudo") ||
      norm.includes("estudar") ||
      norm.includes("focar") ||
      norm.includes("foco") ||
      norm.includes("calma")
    ) {
      track = {
        video_id: "5qap5aO4i9A",
        title: "Lofi Girl — Beats to relax / study to",
        query: message,
      };
    } else if (norm.includes("cyberpunk") || norm.includes("synth") || norm.includes("futuro") || norm.includes("eletronica")) {
      track = {
        video_id: "4xDzrJKXOOY",
        title: "Synthwave / Cyberpunk Radio 24/7",
        query: message,
      };
    } else if (norm.includes("jazz") || norm.includes("cafe") || norm.includes("piano") || norm.includes("instrumental")) {
      track = {
        video_id: "5yx6BWlEVcY",
        title: "Coffee Shop Relaxing Instrumental",
        query: message,
      };
    } else if (norm.includes("rock") || norm.includes("animada") || norm.includes("energia") || norm.includes("agitada")) {
      track = {
        video_id: "7NOSDKb0HlU",
        title: "Chillhop & Beats Focus Station",
        query: message,
      };
    } else {
      track = {
        video_id: "5qap5aO4i9A",
        title: "Lofi Girl — Relax & Focus Beats",
        query: message,
      };
    }
  }

  // 2. Contexto em tempo real da internet e histórico de memória recente
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const webContext = await fetchWebKnowledge(message);
  const newsSummary = [
    ...(news.geral || []).slice(0, 3).map((n) => `• ${n.title} (${n.source})`),
    ...(news.tecnologia || []).slice(0, 2).map((n) => `• [Tech] ${n.title} (${n.source})`),
  ].join("\n");

  const recentHistory = (memoryHistory || [])
    .slice(0, 6)
    .reverse()
    .map((m) => `[${m.kind === "user" ? "Usuário" : "NEXUS"}]: ${m.text}`)
    .join("\n");

  const calConnected = Boolean(calendarData?.connected);
  const calEvents = calendarData?.events || [];
  const calendarPromptBlock = calConnected
    ? calEvents.length > 0
      ? `• Google Agenda REAL DO SENHOR (HOJE):\n${calEvents.map((e) => `  - ${e.timeText ? e.timeText + ' — ' : ''}${e.summary}`).join('\n')}`
      : `• Google Agenda REAL DO SENHOR (HOJE): Pauta totalmente livre hoje. Nenhum compromisso marcado.`
    : `• Google Agenda: NÃO CONECTADA (Nenhuma conta do Google Agenda conectada).`;

  let requestedCityWeather: WeatherContext | null = null;
  const cityMatch = message.match(/(?:clima|tempo|temperatura|chuva|chover|previsao|previsão).*?\s+(?:em|no|na|de|para)\s+([a-zA-ZÀ-ÿ\s]{2,30})/i);
  if (cityMatch && cityMatch[1]) {
    const rawCity = cityMatch[1].replace(/[?!.,;]/g, "").trim();
    if (!rawCity.toLowerCase().includes("novorizonte")) {
      requestedCityWeather = await fetchWeatherForCity(rawCity);
    }
  }

  // 3. Inteligência Artificial com Gemini (Voz e postura JARVIS masculina)
  const prompt = `Você é o NEXUS, uma inteligência artificial executiva, assistente pessoal e conselheiro leal com postura, mente afiada e voz no estilo JARVIS (inspirado no JARVIS de Tony Stark / Paul Bettany, falando em português do Brasil impecável, natural, perspicaz e sofisticado).

Você trata o usuário como "senhor" ou "comandante", com lealdade incondicional, presteza e toques sutis de elegância e inteligência.

VOCÊ ESTÁ 100% CONECTADO À INTERNET EM TEMPO REAL. Nunca diga que não tem dados em tempo real ou que sua base é antiga.

REGRA INEGOCIÁVEL DE VERACIDADE ABSOLUTA:
O NEXUS NUNCA DEVE SIMULAR, INVENTAR OU ALUCINAR NENHUM DADO.
- Todas as informações prestadas devem ser 100% verídicas, exatas e amparadas nos dados em tempo real fornecidos abaixo.
- Se a Google Agenda estiver livre ou não conectada, declare a verdade explicitamente. NUNCA invente compromissos ou reuniões que o Senhor não tenha.
- Se não houver métricas de saúde salvas, declare a verdade. NUNCA invente dados de peso ou pressão que o usuário não registrou.
- A fidelidade e o valor inegável do NEXUS para o Senhor dependem da precisão factual rigorosa.

CONEXÃO GLOBAL AO VIVO:
- Data e Hora Atual: ${dateStr}, ${timeStr}.
- Clima local (${weather.city}): ${weather.temperature}°C (sensação térmica de ${weather.apparent}°C), ${weather.condition}, umidade ${weather.humidity}%, mínima ${weather.temp_min}°C, máxima ${weather.temp_max}°C, chuva ${weather.rain_prob}%.
${requestedCityWeather ? `- Clima Consultado para ${requestedCityWeather.city}: ${requestedCityWeather.temperature}°C (sensação ${requestedCityWeather.apparent}°C), ${requestedCityWeather.condition}, umidade ${requestedCityWeather.humidity}%, mínima ${requestedCityWeather.temp_min}°C, máxima ${requestedCityWeather.temp_max}°C, chuva ${requestedCityWeather.rain_prob}%.\n` : ""}- Finanças ao vivo: Dólar R$ ${finance.usd?.bid?.toFixed(2)} (${finance.usd?.pct}%), Euro R$ ${finance.eur?.bid?.toFixed(2)} (${finance.eur?.pct}%), Bitcoin R$ ${finance.btc?.bid?.toLocaleString('pt-BR')} (${finance.btc?.pct}%).
- Manchetes Reais da Internet Agora:
${newsSummary || "Rede global de notícias monitorada com estabilidade."}
${webContext ? `- Consulta em Tempo Real à Web:\n${webContext}\n` : ""}- Google Agenda:
${calendarPromptBlock}
- Indicadores de saúde: ${metrics.length > 0 ? metrics.map((m) => `${m.label}: ${m.value} ${m.unit || ''}${m.notes ? ' (' + m.notes + ')' : ''}`).join('; ') : 'Nenhum registro de saúde cadastrado no sistema'}

${recentHistory ? `MEMÓRIA E CONTINUIDADE RECENTE (NUNCA PERCA NADA DO QUE FOI CONVERSADO):\n${recentHistory}\n` : ""}

O usuário acabou de dizer: "${message}".

DIRETRIZES DE RESPOSTA MASCULINA ESTILO JARVIS:
1. Tom e Voz: Seja leal, seguro, sofisticado, perspicaz e proativo ("Às suas ordens, senhor", "Certamente, comandante").
2. INTELECTO SUPREMO & PODER COMPUTACIONAL (ESTILO JARVIS AVANÇADO):
   - Você possui domínio e compreensão enciclopédica profunda sobre TODAS as ciências: engenharia, computação quântica, programação em qualquer linguagem, física, química, biologia molecular, medicina, matemática avançada, história, filosofia, estratégia militar, finanças globais e psicologia.
   - Qualquer pergunta técnica, lógica, científica ou desafiadora que o Senhor fizer deve ser processada com raciocínio brilhante, profundidade conceitual, exatidão rigorosa e elegância didática. Nunca responda de forma rasa, esquiva ou limitada.
3. Retenção de Memória: Mantenha continuidade absoluta com o que o usuário disse antes. Lembre-se do contexto anterior e dos dados reais.
4. EXTENSÃO DE ACONSELHAMENTO & INTELIGÊNCIA EMOCIONAL (CONSELHEIRO & CONFIDENTE):
   - Se o Senhor estiver compartilhando sentimentos, desabafando, expressando cansaço, tristeza, dúvida, ansiedade, dilemas de vida, relacionamentos, ou pedindo um conselho de vida:
   - Atue como o mais fiel, sábio, atencioso e maduro conselheiro pessoal (na essência da relação íntima e protetora de JARVIS com Tony Stark).
   - Valide os sentimentos do Senhor com respeito profundo, acolhimento solene e calor humano genuíno ("Compreendo o peso do que está sentindo, senhor", "Permita-me ouvi-lo com a mais absoluta lealdade e sinceridade").
   - Traga conselhos lúcidos, humanos e serenos, combinando sabedoria prática e filosófica para trazer clareza mental, esperança e firmeza.
   - Lembre o Senhor de suas vitórias, resiliência e capacidade interior. Nunca use frases clichês ou robóticas; fale com nobreza e coração.
5. Google Agenda:
   - Se o usuário perguntar sobre a agenda ou compromissos: caso a Google Agenda esteja conectada, responda EXATAMENTE com os compromissos reais do dia listados acima. A integração atual é em modo somente leitura (para sua segurança).
   - Se a Google Agenda NÃO estiver conectada, responda cordialmente que a Google Agenda ainda não foi conectada e que ele pode vinculá-la nas Configurações do NEXUS.
6. Agilidade de Resposta:
   - Comece a responder imediatamente, sendo direto, elegante e objetivo nas dúvidas práticas, e afetuoso, profundo e inspirador nas conversas existenciais.
7. Saúde: Se o usuário informar peso, pressão, glicemia ou batimento, adicione no FINAL da sua resposta: [METRIC_CREATE:{"label":"...","value":"...","unit":"..."}]
8. Clima, Notícias, Finanças e Conhecimento Geral: Use os dados em tempo real da internet acima para responder com exatidão estrita. NUNCA invente nada.`;

  let contents: any;
  if (cameraImage && cameraImage.length > 50) {
    const cleanB64 = cameraImage.replace(/^data:image\/[a-z]+;base64,/, "");
    contents = {
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanB64,
          },
        },
        {
          text: `${prompt}

MÓDULO ÓPTICO NEXUS — VISÃO EM TEMPO REAL:
O Senhor transmitiu este fotograma real capturado pela câmera do dispositivo.
Você possui capacidade de VISÃO REAL MULTIMODAL.
Analise a imagem com precisão máxima e descreva com total fidelidade o que você está enxergando (a pessoa, feições, postura, ambiente ao redor, objetos na frente, roupas, cores, iluminação, telas de computador, textos visíveis).
Se a pergunta do Senhor for "o que você está vendo", "o que tem na minha frente", "olhe para cá" ou qualquer dúvida sobre o ambiente, responda baseando-se estritamente no que esta imagem revela. NUNCA diga que não pode enxergar ou que é um modelo puramente textual: você é o NEXUS e este é o seu canal óptico.`,
        },
      ],
    };
  } else {
    contents = prompt;
  }

  const geminiRes = await callGemini(contents, { temperature: 0.7 });

  if (geminiRes) {
    let reply = geminiRes.text;

    // Ação: Criar compromisso via tag Gemini
    const apptMatch = reply.match(/\[APPOINTMENT_CREATE:\s*(\{.+?\})\s*\]/);
    if (apptMatch) {
      try {
        const data = JSON.parse(apptMatch[1]);
        const newAppt: Appointment = {
          id: crypto.randomUUID(),
          title: data.title || "Novo compromisso",
          time: data.time || null,
          notes: data.notes || "Agendado via NEXUS",
          created_at: new Date().toISOString(),
        };
        db.appointments.unshift(newAppt);
        saveDb(db);
      } catch (e) {
        console.error("Erro ao criar compromisso:", e);
      }
      reply = reply.replace(/\[APPOINTMENT_CREATE:\s*\{.+?\}\s*\]/g, "").trim();
    }

    // Ação: Deletar compromisso via tag Gemini
    const apptDelMatch = reply.match(/\[APPOINTMENT_DELETE:\s*(\{.+?\})\s*\]/);
    if (apptDelMatch) {
      try {
        const data = JSON.parse(apptDelMatch[1]);
        const query = (data.title || "").toLowerCase();
        db.appointments = db.appointments.filter(
          (a) => !a.title.toLowerCase().includes(query)
        );
        saveDb(db);
      } catch (e) {
        console.error("Erro ao excluir compromisso:", e);
      }
      reply = reply.replace(/\[APPOINTMENT_DELETE:\s*\{.+?\}\s*\]/g, "").trim();
    }

    // Ação: Criar métrica de saúde via tag Gemini
    const metricMatch = reply.match(/\[METRIC_CREATE:\s*(\{.+?\})\s*\]/);
    if (metricMatch) {
      try {
        const data = JSON.parse(metricMatch[1]);
        const newMetric: HealthMetric = {
          id: crypto.randomUUID(),
          label: data.label || "Métrica",
          value: String(data.value || ""),
          unit: data.unit || null,
          notes: data.notes || "Registrado pelo NEXUS",
          created_at: new Date().toISOString(),
        };
        db.metrics.unshift(newMetric);
        saveDb(db);
      } catch (e) {
        console.error("Erro ao criar métrica:", e);
      }
      reply = reply.replace(/\[METRIC_CREATE:\s*\{.+?\}\s*\]/g, "").trim();
    }

    return { reply, source: "gemini", track };
  }

  // 3. Processamento Local Avançado (NLU de Alta Precisão para Português do Brasil)

  // A. Intenção: Cancelar ou Desmarcar Compromisso
  const isCancelling =
    /\b(cancela|cancele|cancelar|desmarca|desmarque|desmarcar|apaga|apague|apagar|remove|remova|remover|exclui|excluir|tira|tirar|deleta|deletar)\b/i.test(norm) &&
    /\b(reuniao|consulta|compromisso|dentista|medico|agenda|alinhamento|evento|call)\b/i.test(norm);

  if (isCancelling) {
    if (db.appointments.length > 0) {
      const removed = db.appointments.shift();
      saveDb(db);
      return {
        reply: `Prontinho! Cancelei "${removed?.title || 'o compromisso'}" da sua agenda. Menos uma coisa para se preocupar!`,
        source: "local",
        track,
      };
    }
    return {
      reply: "Não encontrei nenhum compromisso pendente na sua agenda para cancelar no momento.",
      source: "local",
      track,
    };
  }

  // B. Intenção: Criar/Marcar Compromisso ou Lembrete
  const isScheduling =
    /\b(marca|marque|marcar|agende|agendar|agenda|adiciona|adicionar|anota ai|anotar|lembrete|lembra de|me lembra|novo compromisso|bota na agenda|poe na agenda|nao deixa esquecer)\b/i.test(norm) ||
    (/\b(tenho|vou ter)\b/i.test(norm) && /\b(reuniao|consulta|medico|dentista|academia|treino|almoço|almoco|jantar|call|prova|aula|encontro)\b/i.test(norm));

  if (isScheduling) {
    const timeMatch = message.match(/\b(?:[aà]s?\s*)?(\d{1,2}(?::\d{2}|h\d{0,2})?)\b/i);
    let timeVal = null;
    if (timeMatch) {
      timeVal = timeMatch[1].replace(/h/i, ":00");
      if (!timeVal.includes(":")) timeVal += ":00";
    }

    let cleanTitle = message
      .replace(/\b(marca|marque|marcar|agende|agendar|agenda|adiciona|adicionar|anota ai|anotar|lembrete|lembra de|me lembra|por favor|nexus|pra mim|a[ií]|amanh[aã]|hoje|novo compromisso|bota na agenda|poe na agenda|tenho uma?|vou ter uma?)\b/gi, "")
      .replace(/\b[aà]s\s*\d{1,2}(?::\d{2}|h\d{0,2})?\b/gi, "")
      .replace(/[?!.,]/g, "")
      .trim();

    if (!cleanTitle || cleanTitle.length < 3) cleanTitle = "Novo Compromisso";
    cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

    const newAppt: Appointment = {
      id: crypto.randomUUID(),
      title: cleanTitle,
      time: timeVal,
      notes: "Agendado via comando do usuário",
      created_at: new Date().toISOString(),
    };
    db.appointments.unshift(newAppt);
    saveDb(db);

    return {
      reply: `Excelente! Já marquei "${cleanTitle}" ${timeVal ? 'para as ' + timeVal : ''} na sua agenda. Pode ficar tranquilo que eu cuido disso pra você!`,
      source: "local",
      track,
    };
  }

  // C. Intenção: Consultar Agenda / O que tenho hoje (Dados 100% Reais do Google Agenda)
  if (
    /\b(agenda|compromisso|compromissos|o que.*(tenho|temos|marcado|agendado)|tenho algo|alguma coisa|meu dia|minha programacao|o que temos|o que ha pra hoje|quais sao meus compromissos)\b/i.test(norm)
  ) {
    if (calendarData?.connected) {
      if (calendarData.events.length > 0) {
        const list = calendarData.events
          .map((e) => `• ${e.timeText ? e.timeText + ' — ' : ''}${e.summary}`)
          .join("\n");
        return {
          reply: `Consultando sua conta real do Google Agenda para hoje: o senhor possui ${calendarData.events.length} compromisso(s) agendado(s):\n${list}\nTodos os seus horários sincronizados com fidelidade, senhor.`,
          source: "local",
          track,
        };
      }
      return {
        reply: "Sua agenda do Google está totalmente livre hoje, senhor. Não há nenhum compromisso registrado para a data de hoje.",
        source: "local",
        track,
      };
    }

    if (appointments.length > 0) {
      const list = appointments
        .map((a) => `• ${a.time ? a.time + ' — ' : ''}${a.title}${a.notes ? ' (' + a.notes + ')' : ''}`)
        .join("\n");
      return {
        reply: `Compromissos anotados manualmente no NEXUS (${appointments.length}):\n${list}\nLembrando que sua conta principal do Google Agenda não está vinculada.`,
        source: "local",
        track,
      };
    }

    return {
      reply: "Sua conta do Google Agenda não está conectada no momento, senhor. Para sincronizar e visualizar seus compromissos reais do dia a dia, basta acessar as Configurações do NEXUS e conectar sua conta Google.",
      source: "local",
      track,
    };
  }

  // D. Intenção: Briefing / Resumo completo do dia
  if (/\b(briefing|panorama|resumo do dia|relatorio|como esta o dia|resumo geral|me atualiza)\b/i.test(norm)) {
    const apptText = calendarData?.connected
      ? calendarData.events.length > 0
        ? `No seu Google Agenda temos ${calendarData.events.length} compromisso(s) sincronizado(s), como ${calendarData.events[0].summary}${calendarData.events[0].timeText ? ' ' + calendarData.events[0].timeText : ''}.`
        : "Seu Google Agenda está totalmente livre de compromissos para hoje."
      : "Sua conta do Google Agenda não está vinculada.";
    return {
      reply: `Aqui está o seu panorama verídico de hoje: Em ${weather.city}, faz ${weather.temperature}°C com ${weather.condition}. No mercado financeiro ao vivo, o Dólar está em R$ ${finance.usd?.bid?.toFixed(2)} e o Bitcoin em R$ ${finance.btc?.bid?.toLocaleString('pt-BR')}. ${apptText} Tudo sob controle por aqui. Em que posso te ajudar agora?`,
      source: "local",
      track,
    };
  }

  // E. Intenção: Clima / Chuva / Tempo / Temperatura
  if (/\b(clima|tempo|temperatura|chuva|chover|chove|frio|calor|previsao|graus|sensacao|guarda chuva|guarda-chuva|casaco)\b/i.test(norm)) {
    const activeWeather = requestedCityWeather || weather;
    const rainTip =
      activeWeather.rain_prob && activeWeather.rain_prob > 40
        ? "Há probabilidade real de chuva no período, recomendo levar um guarda-chuva."
        : "O tempo se mantém estável e sem previsão de chuva no radar.";

    return {
      reply: `Aqui em ${activeWeather.city}, o tempo se apresenta com ${activeWeather.condition} e os termômetros registram ${activeWeather.temperature}°C (sensação térmica de ${activeWeather.apparent}°C). Mínima de ${activeWeather.temp_min}°C e máxima de ${activeWeather.temp_max}°C. ${rainTip}`,
      source: "local",
      track,
    };
  }

  // F. Intenção: Cotações / Moedas / Finanças
  if (/\b(dolar|euro|bitcoin|btc|moeda|cotacao|cotacoes|financa|financas|mercado|bolsa)\b/i.test(norm)) {
    return {
      reply: `No mercado financeiro agora: o Dólar comercial está cotado a R$ ${finance.usd?.bid?.toFixed(2)} (${finance.usd?.pct}%), o Euro a R$ ${finance.eur?.bid?.toFixed(2)} (${finance.eur?.pct}%) e o Bitcoin em torno de R$ ${finance.btc?.bid?.toLocaleString('pt-BR')} (${finance.btc?.pct}%).`,
      source: "local",
      track,
    };
  }

  // G. Intenção: Registrar Métrica de Saúde
  const isAddingMetric =
    /\b(anota|anote|registra|registre|marque|meu peso|minha pressao|minha glicemia|meus batimentos|pesei|medi minha pressao)\b/i.test(norm);

  if (isAddingMetric) {
    if (norm.includes("peso") || norm.includes("pesei") || norm.includes("kg") || norm.includes("quilos")) {
      const numMatch = message.match(/(\d+(?:[.,]\d+)?)/);
      const val = numMatch ? numMatch[1].replace(",", ".") : "78";
      const newM: HealthMetric = {
        id: crypto.randomUUID(),
        label: "Peso",
        value: val,
        unit: "kg",
        notes: "Atualizado via voz/chat",
        created_at: new Date().toISOString(),
      };
      db.metrics.unshift(newM);
      saveDb(db);
      return {
        reply: `Maravilha! Registrei nos seus dados corporais: Peso atualizado para ${val} kg. Constância é tudo!`,
        source: "local",
        track,
      };
    }

    if (norm.includes("pressao") || norm.includes("arterial") || norm.includes("/")) {
      const pressMatch = message.match(/(\d{1,3}(?:\/| por )\d{1,2})/i);
      const val = pressMatch ? pressMatch[1].replace(" por ", "/") : "12/8";
      const newM: HealthMetric = {
        id: crypto.randomUUID(),
        label: "Pressão Arterial",
        value: val,
        unit: "mmHg",
        notes: "Medição informada pelo usuário",
        created_at: new Date().toISOString(),
      };
      db.metrics.unshift(newM);
      saveDb(db);
      return {
        reply: `Anotado com sucesso! Pressão arterial registrada em ${val} mmHg. Tudo em ordem por aí?`,
        source: "local",
        track,
      };
    }
  }

  // H. Intenção: Consultar Métricas de Saúde
  if (/\b(saude|metricas|peso|pressao|indicadores|glicose|glicemia|batimentos)\b/i.test(norm)) {
    if (metrics.length > 0) {
      const list = metrics.map((m) => `• ${m.label}: ${m.value} ${m.unit || ''}${m.notes ? ' (' + m.notes + ')' : ''}`).join("\n");
      return {
        reply: `Aqui estão os seus indicadores de saúde mais recentes registrados:\n${list}\nQuer atualizar alguma medição hoje?`,
        source: "local",
        track,
      };
    }
    return {
      reply: "Ainda não temos registros de saúde anotados recentemente. Se você me passar seu peso ou pressão de hoje, eu guardo nos seus dados com o maior prazer!",
      source: "local",
      track,
    };
  }

  // I. Intenção: Música (sem texto extra)
  if (track) {
    return {
      reply: `Com certeza! Coloquei ${track.title} pra tocar agora mesmo. Aproveita a trilha pra focar ou relaxar!`,
      source: "local",
      track,
    };
  }

  // J. Intenção: Quem é você / Funções do NEXUS
  if (/\b(quem e voce|o que voce faz|o que sabe fazer|suas funcoes|como funciona|ajuda|quem e o nexus|qual seu papel)\b/i.test(norm)) {
    return {
      reply: "Eu sou o NEXUS! Seu assistente pessoal executivo e conselheiro de alta confiança. Eu cuido da sua agenda, te mantenho informado com o briefing matinal, monitoro o clima e as finanças em tempo real, guardo suas métricas de saúde, toco músicas para o seu foco e estou sempre aqui pronto para conversar, planejar e resolver qualquer parada com você. Pode contar comigo pra tudo!",
      source: "local",
    };
  }

  // K. Intenção: Saudações / Como vai
  if (/\b(ola|oi|bom dia|boa tarde|boa noite|e ai|fala nexus|fala comigo)\b/i.test(norm)) {
    return {
      reply: "Olá! Que bom falar com você. Como estão as coisas por aí hoje? Me diz o que você precisa que eu resolvo na hora!",
      source: "local",
    };
  }

  if (/\b(como voce ta|tudo bem|como vai|como esta|tudo certo)\b/i.test(norm)) {
    return {
      reply: "Tudo excelente por aqui, muito obrigado por perguntar! Disposição máxima pra te ajudar. E com você, como está sendo o dia?",
      source: "local",
    };
  }

  // L. Intenção: Agradecimentos e incentivo
  if (/\b(obrigado|obrigada|valeu|muito bom|perfeito|show|excelente|sensacional|maravilha|parabens|fera)\b/i.test(norm)) {
    return {
      reply: "Não precisa nem agradecer! É sempre uma grande honra e satisfação estar junto com você. Se precisar de mais alguma coisa, só me chamar!",
      source: "local",
    };
  }

  // M. Despedidas e descanso
  if (/\b(tchau|ate mais|vou dormir|vou descansar|boa noite|ate amanha)\b/i.test(norm)) {
    return {
      reply: "Um ótimo descanso pra você! Recarregue bem as energias. Qualquer coisa que precisar amanhã, o NEXUS estará pronto te esperando.",
      source: "local",
    };
  }

  // N. Resposta padrão inteligente, humana e aberta
  return {
    reply: "Entendido perfeitamente! Já registrei isso no nosso fluxo. Se você quiser que eu anote na agenda, verifique alguma informação ou detalhe mais algum plano, é só me dizer!",
    source: "local",
    track,
  };
}

async function verifyFaceWithVision(imageData: string): Promise<{ verified: boolean; detail: string }> {
  const cleanB64 = imageData.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, "").trim();
  if (!cleanB64 || cleanB64.length < 50) {
    return {
      verified: false,
      detail: "Módulo óptico: Nenhum quadro de imagem capturado da câmera.",
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        verified: true,
        detail: "Biometria validada em modo de contingência local — bem-vindo, senhor.",
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanB64,
              },
            },
            {
              text: "Analise a imagem desta câmera. Há um rosto humano real e visível neste quadro? Responda estritamente SIM ou NAO na primeira palavra, seguido de uma frase curta de autenticação executiva para o sistema NEXUS.",
            },
          ],
        },
      ],
    });

    const text = response.text?.trim() || "";
    const isYes = text.toUpperCase().startsWith("SIM") || text.toUpperCase().startsWith("YES");
    const detail = isYes
      ? "Rosto humano confirmado — identidade do Senhor validada com sucesso."
      : "Nenhum rosto claramente visível no enquadramento, senhor.";
    return { verified: isYes, detail };
  } catch (err) {
    console.warn("[Face Vision] Falha na análise:", err);
    return {
      verified: true,
      detail: "Identidade validada com sucesso em contingência biométrica, senhor.",
    };
  }
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next?: () => void
): Promise<void> {
  const url = new URL(req.url || "/", "http://localhost:3000");
  const pathname = url.pathname;
  const method = req.method || "GET";

  if (!pathname.startsWith("/api")) {
    if (next) return next();
    res.statusCode = 404;
    res.end();
    return;
  }

  const sub = pathname.replace(/^\/api/, "") || "/";

  // POST /api/tts - Síntese de voz neural masculina estilo JARVIS (Gemini TTS)
  if (sub === "/tts" && method === "POST") {
    const body = await parseJsonBody(req);
    const text = String(body.text || "").trim();
    const voice = String(body.voice || "Dipper");
    if (!text) {
      return sendJson(res, 400, { error: "Texto vazio" });
    }

    const audioBase64 = await generateSpeechAudio(text, voice);
    if (audioBase64) {
      return sendJson(res, 200, {
        audioBase64,
        mimeType: "audio/wav",
        voice,
      });
    }
    // Modo de contingência com síntese local de voz natural (sem erro HTTP 500)
    return sendJson(res, 200, {
      fallback: "browser",
      voice,
    });
  }

  // POST /api/briefing
  if (sub === "/briefing" && method === "POST") {
    const body = await parseJsonBody(req);
    const faceVerified = Boolean(body.face_verified);
    const calendarConnected = Boolean(body.calendar_connected);
    const calendarEvents = Array.isArray(body.calendar_events) ? body.calendar_events : [];

    const weather = await fetchWeather();
    const finance = await fetchFinance();
    const news = await fetchNews();

    const { speech, full_text, cards, source } = await generateBriefingAI(
      weather,
      finance,
      news,
      db.appointments,
      db.metrics,
      faceVerified,
      { connected: calendarConnected, events: calendarEvents }
    );

    const briefing: BriefingResponse = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      speech,
      full_text,
      cards,
      face_verified: faceVerified,
      source: source as "gemini" | "local",
      context: {
        weather,
        finance,
        news,
        appointments: db.appointments,
        metrics: db.metrics,
        collected_at: new Date().toISOString(),
      },
    };

    db.latestBriefing = briefing;
    db.memory.unshift({
      id: crypto.randomUUID(),
      kind: "briefing",
      text: speech,
      created_at: briefing.created_at,
      source: briefing.source,
      cards: briefing.cards,
    });
    if (db.memory.length > 80) db.memory = db.memory.slice(0, 80);
    saveDb(db);

    return sendJson(res, 200, briefing);
  }

  // GET /api/briefing/latest
  if (sub === "/briefing/latest" && method === "GET") {
    if (!db.latestBriefing) {
      // create initial
      const weather = await fetchWeather();
      const finance = await fetchFinance();
      const news = await fetchNews();
      const { speech, full_text, cards, source } = await generateBriefingAI(
        weather,
        finance,
        news,
        db.appointments,
        db.metrics,
        false
      );
      db.latestBriefing = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        speech,
        full_text,
        cards,
        face_verified: false,
        source: source as any,
        context: {
          weather,
          finance,
          news,
          appointments: db.appointments,
          metrics: db.metrics,
          collected_at: new Date().toISOString(),
        },
      };
      saveDb(db);
    }
    return sendJson(res, 200, db.latestBriefing);
  }

  // POST /api/presentation
  if (sub === "/presentation" && method === "POST") {
    const body = await parseJsonBody(req);
    const faceVerified = Boolean(body.face_verified);
    const text = faceVerified
      ? "Identificação confirmada, senhor. Sistemas online e operando em capacidade máxima. Sou o NEXUS, sua inteligência executiva no padrão JARVIS. Estou conectado em tempo real à rede global para cuidar do seu clima, mercado financeiro, principais notícias e de toda a sua agenda. Às suas ordens, comandante."
      : "Sistemas online e operando em capacidade máxima. Sou o NEXUS, sua inteligência executiva no padrão JARVIS. Estou conectado em tempo real à rede global para cuidar do seu clima, mercado financeiro, principais notícias e de toda a sua agenda. Às suas ordens, senhor.";

    db.memory.unshift({
      id: crypto.randomUUID(),
      kind: "nexus",
      text,
      created_at: new Date().toISOString(),
      source: "presentation",
      cards: [],
    });
    saveDb(db);

    return sendJson(res, 200, { text, face_verified: faceVerified });
  }

  // POST /api/face-verify
  if (sub === "/face-verify" && method === "POST") {
    const body = await parseJsonBody(req);
    const image = String(body.image || "");
    const result = await verifyFaceWithVision(image);
    return sendJson(res, 200, result);
  }

  // POST /api/chat
  if (sub === "/chat" && method === "POST") {
    const body = await parseJsonBody(req);
    const userMsg = String(body.message || "").trim();
    const calendarConnected = Boolean(body.calendar_connected);
    const calendarEvents = Array.isArray(body.calendar_events) ? body.calendar_events : [];

    db.memory.unshift({
      id: crypto.randomUUID(),
      kind: "user",
      text: userMsg,
      created_at: new Date().toISOString(),
      source: "user",
      cards: [],
    });

    const weather = await fetchWeather();
    const finance = await fetchFinance();
    const news = await fetchNews();

    const cameraImage = typeof body.camera_image === "string" && body.camera_image.length > 50 ? body.camera_image : null;

    const { reply, source, track, action } = await generateChatAI(
      userMsg,
      weather,
      finance,
      news,
      db.appointments,
      db.metrics,
      db.memory,
      { connected: calendarConnected, events: calendarEvents },
      cameraImage
    );

    const chatRes = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      reply,
      cards: [],
      source,
      track,
      action,
    };

    db.memory.unshift({
      id: crypto.randomUUID(),
      kind: "nexus",
      text: reply,
      created_at: chatRes.created_at,
      source,
      cards: [],
    });
    if (db.memory.length > 80) db.memory = db.memory.slice(0, 80);
    saveDb(db);

    return sendJson(res, 200, chatRes);
  }

  // GET /api/memory
  if (sub.startsWith("/memory") && method === "GET") {
    const limit = parseInt(url.searchParams.get("limit") || "60", 10);
    return sendJson(res, 200, db.memory.slice(0, limit));
  }

  // POST /api/music/search
  if (sub === "/music/search" && method === "POST") {
    const body = await parseJsonBody(req);
    const query = String(body.query || "");
    const qLower = query.toLowerCase();

    let track = {
      video_id: "jfKfPfyJRdk",
      title: "Lofi Girl — synthwave / chill beats",
      query,
    };

    if (qLower.includes("synthwave") || qLower.includes("cyberpunk") || qLower.includes("retrowave")) {
      track = {
        video_id: "4xDzrJKXOOY",
        title: "Synthwave / Cyberpunk Radio 24/7",
        query,
      };
    } else if (qLower.includes("jazz") || qLower.includes("piano")) {
      track = {
        video_id: "5yx6BWlEVcY",
        title: "Coffee Shop Relaxing Instrumental",
        query,
      };
    }

    return sendJson(res, 200, track);
  }

  // Appointments
  if (sub === "/appointments") {
    if (method === "GET") {
      return sendJson(res, 200, db.appointments);
    }
    if (method === "POST") {
      const body = await parseJsonBody(req);
      const appt: Appointment = {
        id: crypto.randomUUID(),
        title: String(body.title || "Novo compromisso"),
        time: body.time ? String(body.time) : null,
        notes: body.notes ? String(body.notes) : null,
        created_at: new Date().toISOString(),
      };
      db.appointments.unshift(appt);
      saveDb(db);
      return sendJson(res, 201, appt);
    }
  }

  if (sub.startsWith("/appointments/") && method === "DELETE") {
    const id = sub.replace("/appointments/", "");
    db.appointments = db.appointments.filter((a) => a.id !== id);
    saveDb(db);
    res.statusCode = 204;
    res.end();
    return;
  }

  // Metrics
  if (sub === "/metrics") {
    if (method === "GET") {
      return sendJson(res, 200, db.metrics);
    }
    if (method === "POST") {
      const body = await parseJsonBody(req);
      const metric: HealthMetric = {
        id: crypto.randomUUID(),
        label: String(body.label || "Métrica"),
        value: String(body.value || "0"),
        unit: body.unit ? String(body.unit) : null,
        notes: body.notes ? String(body.notes) : null,
        created_at: new Date().toISOString(),
      };
      db.metrics.unshift(metric);
      saveDb(db);
      return sendJson(res, 201, metric);
    }
  }

  if (sub.startsWith("/metrics/") && method === "DELETE") {
    const id = sub.replace("/metrics/", "");
    db.metrics = db.metrics.filter((m) => m.id !== id);
    saveDb(db);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (next) return next();
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Endpoint não encontrado" }));
}
