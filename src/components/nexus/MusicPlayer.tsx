import { useEffect, useRef, useState } from "react";
import { ExternalLink, Music, Pause, Play, Square, Volume2, X } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import type { MusicTrack } from "@/lib/nexus";

interface MusicPlayerProps {
  track: MusicTrack;
  onClose: () => void;
}

// Stream de áudio direto da web (Lofi / Chill) caso o YouTube apresente restrições geográficas ou de incorporação
const BACKUP_AUDIO_STREAM = "https://ice1.somafm.com/groovesalad-128-mp3";

export default function MusicPlayer({ track, onClose }: MusicPlayerProps) {
  const [useBackupAudio, setUseBackupAudio] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const query = track.query || track.title;
  const ytMusicUrl = `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
  const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  const toggleBackupAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => {});
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full rounded-xl border border-cyan-500/30 bg-slate-950/85 p-3.5 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
      data-testid="nexus-music-player"
    >
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-cyan-950/80 border border-cyan-400/40 text-cyan-300">
            <Music className="size-3.5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <span className="font-mono text-[9px] uppercase tracking-widest text-cyan-400/80 block">
              Player de Mídia · NEXUS
            </span>
            <h3 className="truncate font-mono text-xs font-semibold text-slate-200" data-testid="nexus-music-title">
              {track.title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fechar player de música"
            data-testid="nexus-music-close-btn"
            className="size-7 rounded-full text-slate-400 hover:text-white"
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>

      {/* Opções de Integração Direta (YouTube Music / YouTube App) */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <a
          href={ytMusicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-950/50 px-2.5 py-1 font-mono text-[10px] font-medium text-red-200 transition hover:bg-red-900/60 hover:text-white"
          title="Abrir no app ou site do YouTube Music"
        >
          <span className="size-2 rounded-full bg-red-500" />
          Abrir no YouTube Music
          <ExternalLink className="size-3 ml-0.5 opacity-70" />
        </a>

        <a
          href={ytSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-slate-900/60 px-2.5 py-1 font-mono text-[10px] text-slate-300 transition hover:bg-white/10 hover:text-white"
          title="Abrir pesquisa direta no YouTube"
        >
          Pesquisar no YouTube
          <ExternalLink className="size-3 ml-0.5 opacity-70" />
        </a>

        <button
          type="button"
          onClick={() => {
            setUseBackupAudio((prev) => !prev);
            if (!useBackupAudio && audioRef.current) {
              audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => {});
            }
          }}
          className="rounded-md border border-cyan-500/30 bg-cyan-950/40 px-2 py-1 font-mono text-[10px] text-cyan-300 hover:bg-cyan-900/40"
        >
          {useBackupAudio ? "Usar Vídeo do YouTube" : "Áudio Direto Sem Anúncios"}
        </button>
      </div>

      {/* Player Embed ou Áudio Web Nativo */}
      {useBackupAudio ? (
        <div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-slate-900/70 p-3 font-mono text-xs text-cyan-200">
          <div className="flex items-center gap-2">
            <Volume2 className="size-4 text-cyan-400 animate-pulse" />
            <span>Transmissão de Foco Contínua (Web Stream)</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleBackupAudio}
            className="h-7 px-3 text-xs border-cyan-500/40 hover:bg-cyan-950"
          >
            {isPlayingAudio ? (
              <>
                <Pause className="size-3.5 mr-1" /> Pausar
              </>
            ) : (
              <>
                <Play className="size-3.5 mr-1" /> Tocar
              </>
            )}
          </Button>
          <audio ref={audioRef} src={BACKUP_AUDIO_STREAM} preload="none" />
        </div>
      ) : (
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-cyan-500/20 bg-black">
          <iframe
            key={track.video_id}
            src={`https://www.youtube-nocookie.com/embed/${track.video_id}?autoplay=1&enablejsapi=1&rel=0`}
            title={track.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            data-testid="nexus-music-frame"
          />
        </div>
      )}
    </motion.section>
  );
}