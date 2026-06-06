import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Heart,
  Shuffle,
  Repeat,
  Maximize2,
  Minimize2,
  ArrowLeft,
  LogOut,
  Volume2,
  VolumeX,
  Search,
  X,
} from "lucide-react";
import { TRACKS, type Track } from "@/lib/tracks";
import polaroidRain from "@/assets/polaroid-rain.jpg";
import {
  beginSpotifyLogin,
  createSpotifyPlayback,
  getFallbackTracks,
  getProfile,
  getTopTracks,
  isSpotifyConnected,
  lookupTrackPreview,
  logoutSpotify,
  playTrackOnDevice,
  searchTracks,
  transferPlayback,
  type SpotifyProfile,
  type SpotifyPlayerState,
  type SpotifyTrack,
  type SpotifyWebPlaybackPlayer,
} from "@/lib/spotify";
import { fetchLyrics, type LyricLine } from "@/lib/lyrics";
import { extractAccent } from "@/lib/color";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your Room — echo.room" },
      { name: "description", content: "Your listening room. Vinyl spinning, lyrics floating, lights breathing with the music." },
    ],
  }),
  component: Dashboard,
});

const MOODS = [
  { id: "shinjuku", name: "Shinjuku Neon", weather: "Light rain on asphalt", temp: "14°C", city: "Tokyo" },
  { id: "cafe", name: "Rainy Café", weather: "Steam on the window", temp: "11°C", city: "Kyoto" },
  { id: "attic", name: "Vinyl Attic", weather: "Dust drifting in lamplight", temp: "18°C", city: "Berlin" },
];

const ACCENTS = [
  "oklch(0.78 0.18 10)",   // coral
  "oklch(0.82 0.17 35)",   // amber
  "oklch(0.8 0.18 55)",    // gold
  "oklch(0.78 0.17 95)",   // chartreuse
  "oklch(0.76 0.16 150)",  // mint
  "oklch(0.74 0.16 190)",  // teal
  "oklch(0.7 0.18 235)",   // azure
  "oklch(0.72 0.18 280)",  // violet
  "oklch(0.74 0.18 330)",  // magenta
  "oklch(0.78 0.18 355)",  // rose
];

const NO_LYRICS: LyricLine[] = [{ time: null, text: "We don't have lyrics for this song." }];
const LOADING_LYRICS: LyricLine[] = [{ time: null, text: "Loading lyrics…" }];

function spotifyToTrack(t: SpotifyTrack, i: number): Track {
  return {
    id: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    album: t.album.name,
    art: t.album.images[0]?.url ?? "",
    duration: Math.round(t.duration_ms / 1000),
    uri: t.uri,
    externalUrl: t.external_urls?.spotify,
    accent: ACCENTS[i % ACCENTS.length],
    lyrics: NO_LYRICS,
    previewUrl: t.preview_url,
  };
}

function Dashboard() {
  const [tracks, setTracks] = useState<Track[]>(TRACKS);
  const [trackIdx, setTrackIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lyrics, setLyrics] = useState<LyricLine[]>(NO_LYRICS);
  const [lyricsSynced, setLyricsSynced] = useState(false);
  const [lyricIdx, setLyricIdx] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "all" | "one">("off");
  const [clock, setClock] = useState("22:45");
  const [liked, setLiked] = useState(false);
  const [focus, setFocus] = useState(false);
  const [mood, setMood] = useState("shinjuku");
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [connected, setConnected] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<SpotifyPlayerState | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [liveAccent, setLiveAccent] = useState<string | null>(null);
  const [forcePreviewByTrackId, setForcePreviewByTrackId] = useState<Record<string, true>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const spotifyPlayerRef = useRef<SpotifyWebPlaybackPlayer | null>(null);
  const spotifyDeviceIdRef = useRef<string | null>(null);
  const pendingSpotifyTrackRef = useRef<string | null>(null);
  const previewLookupRef = useRef<Map<string, string | null>>(new Map());
  const track: Track = tracks[trackIdx] ?? TRACKS[0];
  const activeTrackRef = useRef(track);
  const activeMood = useMemo(() => MOODS.find((m) => m.id === mood)!, [mood]);
  const hasSpotifySession = connected && profile?.product === "premium";
  const forcePreviewForCurrentTrack = Boolean(forcePreviewByTrackId[track.id]);

  const enablePreviewFallback = (target: Track, message?: string) => {
    setForcePreviewByTrackId((prev) => (prev[target.id] ? prev : { ...prev, [target.id]: true }));
    setPlayerError(message ?? (target.previewUrl
      ? "Spotify playback unavailable — playing preview instead."
      : "Spotify playback unavailable for this song."));
  };

  useEffect(() => {
    activeTrackRef.current = track;
  }, [track]);

  // Spotify boot
  useEffect(() => {
    if (!isSpotifyConnected()) return;
    setConnected(true);
    (async () => {
      try {
        const [p, top] = await Promise.all([getProfile(), getTopTracks(12)]);
        setProfile(p);
        if (top.items.length) {
          setTracks(top.items.map(spotifyToTrack));
          setTrackIdx(0);
          setProgress(0);
        }
      } catch (e) {
        console.error("Spotify load failed", e);
        logoutSpotify();
        setConnected(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (connected) return;
    let cancelled = false;

    getFallbackTracks(12)
      .then((items) => {
        if (cancelled || !items.length) return;
        setTracks(items.map(spotifyToTrack));
        setTrackIdx(0);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [connected]);

  useEffect(() => {
    if (!hasSpotifySession) return;
    let cancelled = false;

    (async () => {
      try {
        const player = await createSpotifyPlayback((state) => {
          if (cancelled) return;
          const activeTrack = activeTrackRef.current;
          const resolvedDeviceId = state.deviceId ?? spotifyDeviceIdRef.current ?? null;
          spotifyDeviceIdRef.current = resolvedDeviceId;
          if (state.currentTrackUri) {
            pendingSpotifyTrackRef.current = state.currentTrackUri;
          }
          const nextPositionMs = typeof state.position === "number" ? state.position : 0;
          const nextDurationMs = state.duration > 0
            ? state.duration
            : Math.max(activeTrack.duration * 1000, 1);
          const isMatchingTrack = state.currentTrackUri === activeTrack.uri;

          setPlayerState({
            ...state,
            deviceId: resolvedDeviceId,
            position: nextPositionMs,
            duration: nextDurationMs,
          });
          setPlayerReady(state.isReady || Boolean(resolvedDeviceId));
          if (state.error) setPlayerError(state.error);
          else setPlayerError(null);
          if (isMatchingTrack && typeof state.paused === "boolean") {
            setPlaying(!state.paused);
          }
          if (isMatchingTrack) {
            setProgress(Math.max(0, Math.floor(nextPositionMs / 1000)));
          }
        }, volume);

        await player.activateElement?.();

        spotifyPlayerRef.current = player;
      } catch (error) {
        if (cancelled) return;
        setPlayerError(error instanceof Error ? error.message : "Could not start Spotify playback.");
      }
    })();

    return () => {
      cancelled = true;
      pendingSpotifyTrackRef.current = null;
      spotifyPlayerRef.current?.disconnect();
      spotifyPlayerRef.current = null;
    };
  }, [hasSpotifySession, volume]);

  // Real lyrics fetch on track change
  useEffect(() => {
    let cancelled = false;
    setLyricIdx(0);
    setLyrics(LOADING_LYRICS);
    setLyricsSynced(false);
    fetchLyrics(track.artist, track.title).then((l) => {
      if (cancelled) return;
      if (l && l.lines.length) {
        setLyrics(l.lines);
        setLyricsSynced(l.synced);
      } else {
        setLyrics(NO_LYRICS);
        setLyricsSynced(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [track.id, track.artist, track.title]);

  useEffect(() => {
    if (track.previewUrl) return;
    const key = `${track.artist}::${track.title}`.toLowerCase();
    if (previewLookupRef.current.has(key)) return;

    previewLookupRef.current.set(key, null);
    lookupTrackPreview(track.artist, track.title).then((match) => {
      if (!match?.previewUrl) return;

      previewLookupRef.current.set(key, match.previewUrl);
      setTracks((prev) => prev.map((item) => {
        if (item.id !== track.id) return item;
        return {
          ...item,
          previewUrl: item.previewUrl ?? match.previewUrl,
          art: item.art || match.art || item.art,
          album: item.album || match.album || item.album,
          duration: match.durationMs ? Math.max(1, Math.round(match.durationMs / 1000)) : item.duration,
          externalUrl: item.externalUrl ?? match.externalUrl,
        };
      }));
    });
  }, [track.album, track.artist, track.id, track.previewUrl, track.title, track.uri]);

  // Extract dominant color from album art so the room glows with the song
  useEffect(() => {
    let cancelled = false;
    setLiveAccent(null);
    if (!track.art) return;
    extractAccent(track.art).then((c) => {
      if (!cancelled && c) setLiveAccent(c);
    });
    return () => {
      cancelled = true;
    };
  }, [track.art]);

  const canUseSpotifyPlayback = hasSpotifySession && Boolean(track.uri) && !forcePreviewForCurrentTrack;
  const canUsePreview = Boolean(track.previewUrl) && (!hasSpotifySession || forcePreviewForCurrentTrack || !track.uri);

  // Audio element: load new src on track change
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    setProgress(0);
    if (canUsePreview && track.previewUrl) {
      a.src = track.previewUrl;
      a.load();
    } else {
      a.removeAttribute("src");
      a.load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id, track.previewUrl, canUsePreview]);

  // Play/pause sync
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (canUsePreview && playing && track.previewUrl) a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [playing, track.previewUrl, canUsePreview]);

  // Volume sync
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    if (!hasSpotifySession) return;
    spotifyPlayerRef.current?.setVolume(muted ? 0 : volume).catch(() => undefined);
  }, [hasSpotifySession, muted, volume]);

  // Clock
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Audio time → progress
  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a) return;
    setProgress(Math.floor(a.currentTime));
  };
  const onLoadedMetadata = () => {
    const a = audioRef.current;
    if (!a) return;
    setProgress(Math.floor(a.currentTime || 0));
  };
  const onAudioPlay = () => {
    setPlayerError(null);
    setPlaying(true);
  };
  const onAudioPause = () => {
    const a = audioRef.current;
    if (!a || a.ended) return;
    setPlaying(false);
  };
  const onAudioError = () => {
    setPlaying(false);
    setPlayerError("This preview could not be loaded.");
  };
  const pickNext = (dir: 1 | -1 = 1) => {
    if (shuffle && tracks.length > 1) {
      let n = trackIdx;
      while (n === trackIdx) n = Math.floor(Math.random() * tracks.length);
      return n;
    }
    return (trackIdx + dir + tracks.length) % tracks.length;
  };
  const onEnded = () => {
    if (repeat === "one") {
      const a = audioRef.current;
      if (a) { a.currentTime = 0; a.play().catch(() => undefined); }
      setProgress(0);
      return;
    }
    const next = pickNext(1);
    if (!shuffle && repeat === "off" && next === 0 && trackIdx === tracks.length - 1) {
      setPlaying(false);
      return;
    }
    setTrackIdx(next);
  };
  // Search
  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQ.trim();
    if (!q) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchError(null);
    const id = setTimeout(async () => {
      try {
        const r = await searchTracks(q, 12, profile?.country);
        setSearchResults(r.tracks.items.map(spotifyToTrack));
      } catch (e) {
        console.error("Search failed", e);
        setSearchResults([]);
        const message = e instanceof Error ? e.message : "";
        if (/Not authenticated|Spotify 401/i.test(message)) {
          setSearchError("Your Spotify session expired. Please connect Spotify again.");
        } else {
          setSearchError("Search is temporarily unavailable. Try again in a moment.");
        }
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [searchQ, connected, profile?.country, searchOpen]);

  const playSearchResult = (t: Track) => {
    if (t.previewUrl) {
      setForcePreviewByTrackId((prev) => ({ ...prev, [t.id]: true }));
      setPlayerError(null);
    }
    // Insert/replace at current index so the collection still flows
    setTracks((prev) => {
      const exists = prev.findIndex((x) => x.id === t.id);
      if (exists >= 0) {
        if (exists === trackIdx) {
          setProgress(0);
          if (canUseSpotifyPlayback) {
            spotifyPlayerRef.current?.seek(0).catch(() => undefined);
          } else if (audioRef.current) {
            audioRef.current.currentTime = 0;
          }
        }
        setTrackIdx(exists);
        return prev;
      }
      const next = [t, ...prev];
      setTrackIdx(0);
      return next;
    });
    setPlaying(true);
    setProgress(0);
    setSearchOpen(false);
    setSearchQ("");
  };

  useEffect(() => {
    if (!canUseSpotifyPlayback || !playing || !track.uri) return;
    const trackUri = track.uri;
    const deviceId = playerState?.deviceId;
    if (!deviceId) return;

    const currentUri = playerState?.currentTrackUri ?? pendingSpotifyTrackRef.current;
    const isSameTrack = currentUri === trackUri;
    
    // If it is the same track and already active, let togglePlayback or SDK handle play/pause
    if (isSameTrack && playerState?.isActive) return;

    pendingSpotifyTrackRef.current = trackUri;
    // Only transfer if not active
    const transferPromise = playerState?.isActive 
      ? Promise.resolve() 
      : transferPlayback(deviceId, false);

    transferPromise
      .then(() => playTrackOnDevice(deviceId, trackUri))
      .catch((error) => {
        pendingSpotifyTrackRef.current = null;
        const message = error instanceof Error ? error.message : "Could not start Spotify playback.";
        if (activeTrackRef.current.id === track.id && track.previewUrl) {
          enablePreviewFallback(track, message);
          setPlaying(true);
        } else {
          setPlayerError(message);
          setPlaying(false);
        }
      });
  }, [canUseSpotifyPlayback, playing, track.uri, playerState?.deviceId, playerState?.currentTrackUri, playerState?.isActive]);

  const togglePlayback = async () => {
    if (canUseSpotifyPlayback) {
      const player = spotifyPlayerRef.current;
      const deviceId = playerState?.deviceId;
      if (!player || !deviceId || !track.uri) {
        setPlayerError("Spotify player is still connecting.");
        return;
      }

      try {
        setPlayerError(null);
        await player.activateElement?.();
        const currentState = await player.getCurrentState();
        const currentUri = currentState?.track_window?.current_track?.uri ?? playerState?.currentTrackUri;
        const isPaused = currentState?.paused ?? playerState?.paused ?? true;
        const isSameTrack = currentUri === track.uri;

        pendingSpotifyTrackRef.current = track.uri;
        
        if (!playerState?.isActive) {
          await transferPlayback(deviceId, false);
        }

        if (!isSameTrack) {
          await playTrackOnDevice(deviceId, track.uri);
          setPlaying(true);
          setProgress(0);
          return;
        }

        if (isPaused) {
          await player.resume();
          setPlaying(true);
        } else {
          await player.pause();
          setPlaying(false);
        }
      } catch (error) {
        pendingSpotifyTrackRef.current = null;
        const message = error instanceof Error ? error.message : "Could not control Spotify playback.";
        if (track.previewUrl) {
          enablePreviewFallback(track, message);
          setPlaying(true);
        } else {
          setPlayerError(message);
        }
      }
      return;
    }

    if (!track.previewUrl) return;
    setPlaying((p) => !p);
  };

  const roomStyle = useMemo(() => {
    const accent = liveAccent ?? track.accent;
    return {
      ["--accent" as string]: accent,
      ["--glow" as string]: `color-mix(in oklab, ${accent} 55%, transparent)`,
      ["--room-tint" as string]: `color-mix(in oklab, ${accent} 18%, transparent)`,
    } as React.CSSProperties;
  }, [track.accent, liveAccent]);

  const duration = canUseSpotifyPlayback
    ? Math.max(1, Math.round((playerState?.duration ?? track.duration * 1000) / 1000))
    : track.previewUrl
      ? 30
      : track.duration;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const pct = Math.min(100, (progress / Math.max(1, duration)) * 100);

  useEffect(() => {
    if (!playing || !canUseSpotifyPlayback) return;
    const id = window.setInterval(() => {
      setProgress((p) => (p < duration ? p + 1 : p));
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, canUseSpotifyPlayback, duration]);

  useEffect(() => {
    if (lyrics.length <= 1) {
      setLyricIdx(0);
      return;
    }

    if (lyricsSynced) {
      // Synced lyrics: find the latest line whose timestamp <= progress
      let idx = 0;
      for (let i = 0; i < lyrics.length; i++) {
        const t = lyrics[i].time;
        if (t === null) continue;
        if (t <= progress) idx = i;
        else break;
      }
      setLyricIdx(idx);
      return;
    }

    const safeProgress = Math.max(0, Math.min(progress, duration));
    const nextIndex = Math.min(
      lyrics.length - 1,
      Math.floor((safeProgress / Math.max(1, duration)) * lyrics.length),
    );
    setLyricIdx(nextIndex);
  }, [duration, lyrics, lyricsSynced, progress]);

  const onScrub = (s: number) => {
    setProgress(s);
    const a = audioRef.current;
    if (canUseSpotifyPlayback) {
      spotifyPlayerRef.current?.seek(s * 1000).catch(() => undefined);
      return;
    }
    if (a && track.previewUrl) a.currentTime = s;
  };

  const controlsProps = {
    playing,
    progress,
    duration,
    pct,
    fmt,
    volume,
    muted,
    hasAudio: canUseSpotifyPlayback ? Boolean(track.uri && (playerReady || playerState?.deviceId)) : Boolean(track.previewUrl),
    onToggle: togglePlayback,
    onPrev: () => setTrackIdx(pickNext(-1)),
    onNext: () => setTrackIdx(pickNext(1)),
    onScrub,
    onVolume: (v: number) => {
      setVolume(v);
      if (v > 0) setMuted(false);
    },
    onMute: () => setMuted((m) => !m),
    shuffle,
    onShuffle: () => setShuffle((s) => !s),
    repeat,
    onRepeat: () => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off")),
  };

  useEffect(() => {
    pendingSpotifyTrackRef.current = track.uri ?? null;
    setProgress(0);
  }, [track.id, track.uri]);

  useEffect(() => {
    if (!focus) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocus(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focus]);

  if (focus) {
    return (
      <>
        <audio
          ref={audioRef}
          onLoadedMetadata={onLoadedMetadata}
          onPlay={onAudioPlay}
          onPause={onAudioPause}
          onError={onAudioError}
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
          preload="auto"
        />
        <FocusMode
          track={track}
          lyrics={lyrics}
          lyricIdx={lyricIdx}
          roomStyle={roomStyle}
          onExit={() => setFocus(false)}
          controlsProps={controlsProps}
        />
      </>
    );
  }

  return (
    <div className="relative min-h-screen room-bg text-foreground overflow-hidden" style={roomStyle}>
      <audio
        ref={audioRef}
        onLoadedMetadata={onLoadedMetadata}
        onPlay={onAudioPlay}
        onPause={onAudioPause}
        onError={onAudioError}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        preload="auto"
      />
      <div className="grain-overlay fixed inset-0 z-50" />

      <main className="relative z-10 mx-auto max-w-7xl px-6 lg:px-10 py-8 lg:py-12 grid grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left rail */}
        <aside className="col-span-12 lg:col-span-2 space-y-10">
          <div className="flex items-start justify-between">
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-3" />
                Lobby
              </Link>
              <h1 className="font-serif text-xl mt-2">
                echo<span className="text-accent">.</span>room
              </h1>
            </div>
          </div>

          {connected ? (
            <div className="flex items-center gap-3 p-2 pr-3 rounded-full bg-card/60 ring-1 ring-border">
              {profile?.images?.[0]?.url ? (
                <img
                  src={profile.images[0].url}
                  alt={profile.display_name}
                  className="size-7 rounded-full object-cover"
                />
              ) : (
                <span className="size-7 rounded-full bg-accent/30 grid place-items-center text-[10px]">
                  {(profile?.display_name ?? "?").slice(0, 1)}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] truncate text-foreground">
                  {profile?.display_name ?? "Connected"}
                </p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                  {profile?.product === "premium" ? "Premium" : "Spotify"}
                </p>
              </div>
              <button
                onClick={() => {
                  logoutSpotify();
                  window.location.reload();
                }}
                aria-label="Log out"
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => beginSpotifyLogin()}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-[0_8px_30px_-10px_var(--glow)] hover:scale-[1.02] transition-transform"
            >
              Connect Spotify
            </button>
          )}

          {/* Search button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-card/60 ring-1 ring-border text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Search className="size-3.5" />
            Search any song…
          </button>

          <div className="space-y-3">
            <h3 className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Mood Rooms
            </h3>
            <nav className="flex flex-col gap-1.5">
              {MOODS.map((m) => {
                const active = m.id === mood;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMood(m.id)}
                    className={[
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                      active
                        ? "bg-card ring-1 ring-border text-foreground"
                        : "text-muted-foreground hover:bg-card/60",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "size-1.5 rounded-full",
                        active ? "bg-accent shadow-[0_0_8px_var(--glow)]" : "bg-muted",
                      ].join(" ")}
                    />
                    {m.name}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-4 rounded-xl bg-card/40 ring-1 ring-border space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Atmosphere</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{clock}</span>
            </div>
            <div className="text-xs leading-relaxed text-foreground/85">
              {activeMood.city} — {activeMood.temp}
              <br />
              {activeMood.weather}.
            </div>
          </div>
        </aside>

        {/* Center */}
        <section className="col-span-12 lg:col-span-6 flex flex-col items-center text-center">
          <div className="relative">
            <div
              className={[
                "relative size-72 md:size-96 rounded-full bg-neutral-950 shadow-2xl ring-1 ring-white/10 overflow-hidden",
                playing ? "animate-vinyl-spin" : "",
              ].join(" ")}
            >
              <div className="absolute inset-0 vinyl-glare" />
              <div className="absolute inset-0 border-[16px] border-black/40 rounded-full" />
              <div className="absolute inset-4 border border-white/5 rounded-full" />
              <div className="absolute inset-10 border border-white/5 rounded-full" />
              <div className="absolute inset-16 border border-white/5 rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="size-28 md:size-32 rounded-full ring-4 ring-black/40 overflow-hidden">
                  <img
                    src={track.art}
                    alt={`Album art for ${track.album}`}
                    width={512}
                    height={512}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 size-2 rounded-full bg-background" />
            </div>
            <div
              aria-hidden
              className="absolute -right-2 top-2 w-7 h-44 rounded-full bg-zinc-700/70 blur-[2px] -rotate-12 pointer-events-none"
            />
            <button
              onClick={() => setFocus(true)}
              aria-label="Focus mode"
              className="absolute -bottom-2 -right-2 size-10 grid place-items-center rounded-full bg-card ring-1 ring-border text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors"
            >
              <Maximize2 className="size-4" />
            </button>
          </div>

          <div className="mt-10 space-y-2">
            <h2 className="text-3xl md:text-5xl font-serif font-medium text-balance leading-tight text-glow">
              {track.title}
            </h2>
            <p className="text-muted-foreground text-base md:text-lg">
              {track.artist} — <span className="italic">{track.album}</span>
            </p>
            {playerError && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-destructive/80">
                {playerError}
              </p>
            )}
            {!canUseSpotifyPlayback && !track.previewUrl && (
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
                No preview available — open it in Spotify to hear the full track
              </p>
            )}
            {canUseSpotifyPlayback && profile?.product === "premium" && (
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
                Playing through your Spotify Premium session
              </p>
            )}
          </div>

          <Controls {...controlsProps} />

          {/* Floating lyrics */}
          <div className="mt-12 h-28 relative overflow-hidden w-full max-w-xl">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <p className="text-muted-foreground/60 text-sm italic font-serif">
                {lyrics[(lyricIdx - 1 + lyrics.length) % lyrics.length]?.text}
              </p>
              <p
                key={lyricIdx}
                className="text-foreground text-lg md:text-xl font-serif transition-opacity duration-700"
              >
                {lyrics[lyricIdx]?.text}
              </p>
              <p className="text-muted-foreground/40 text-sm italic font-serif">
                {lyrics[(lyricIdx + 1) % lyrics.length]?.text}
              </p>
            </div>
          </div>
        </section>

        {/* Right */}
        <aside className="col-span-12 lg:col-span-4 space-y-10">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Night Log</h3>
              <button
                onClick={() => setLiked((l) => !l)}
                aria-label="Like track"
                className={[
                  "size-7 rounded-full grid place-items-center ring-1 ring-border transition-colors",
                  liked ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Heart className="size-3.5" fill={liked ? "currentColor" : "none"} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-card p-3 rounded-sm shadow-xl ring-1 ring-border -rotate-2 hover:rotate-0 transition-transform duration-500">
                <img
                  src={polaroidRain}
                  alt="Rainy window at night"
                  loading="lazy"
                  width={512}
                  height={384}
                  className="w-full aspect-[4/3] object-cover bg-muted mb-3"
                />
                <p className="font-serif text-sm text-muted-foreground italic px-1">
                  October 14 — coffee went cold but the view was perfect.
                </p>
              </div>

              <div className="relative bg-card/60 p-5 rounded-lg ring-1 ring-border rotate-1">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-muted/40 backdrop-blur-sm border-x border-border" />
                <h4 className="text-sm font-medium text-foreground mb-3 font-serif">Late Shift Essentials</h4>
                <ul className="text-xs text-muted-foreground space-y-2">
                  {tracks.slice(0, 4).map((t) => (
                    <li key={t.id} className="flex items-center gap-2">
                      <span className="size-1 rounded-full" style={{ background: t.accent }} />
                      <span className="truncate">
                        {t.title} — {t.artist}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-4">Collection</h3>
            <div className="flex gap-4 overflow-x-auto pb-3 no-scrollbar">
              {tracks.map((t, i) => {
                const active = i === trackIdx;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTrackIdx(i)}
                    className="shrink-0 group text-left"
                  >
                    <div
                      className={[
                        "size-28 rounded-sm overflow-hidden ring-1 transition-all",
                        active
                          ? "ring-accent shadow-[0_0_20px_var(--glow)] -translate-y-1"
                          : "ring-border group-hover:-translate-y-1",
                      ].join(" ")}
                    >
                      <img
                        src={t.art}
                        alt={`${t.album} by ${t.artist}`}
                        loading="lazy"
                        width={512}
                        height={512}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-foreground truncate w-28">{t.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate w-28">{t.artist}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </main>

      {/* Visualizer */}
      <footer className="fixed bottom-0 inset-x-0 h-28 pointer-events-none z-0">
        <div className="flex items-end justify-center h-full gap-1 px-8 opacity-25">
          {[10, 22, 14, 28, 18, 12, 24, 16, 30, 20, 14, 26, 18, 12, 22, 16].map((h, i) => (
            <span
              key={i}
              className="w-1 rounded-t-full animate-eq"
              style={{
                height: `${h * 3}px`,
                background: "var(--accent)",
                animationDelay: `${i * 0.08}s`,
                animationPlayState: playing ? "running" : "paused",
              }}
            />
          ))}
        </div>
      </footer>

      {/* Search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-[70] bg-background/85 backdrop-blur-xl flex items-start justify-center pt-24 px-6">
          <div className="w-full max-w-2xl">
            <div className="flex items-center gap-3 bg-card ring-1 ring-border rounded-full px-5 py-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search Spotify — any song, artist, or album"
                className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
              />
              <button onClick={() => setSearchOpen(false)} aria-label="Close search">
                <X className="size-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-1">
              {searching && (
                <p className="text-xs text-muted-foreground px-2 py-3">Searching…</p>
              )}
              {!searching && searchError && (
                <p className="text-xs text-destructive px-2 py-3 break-words">{searchError}</p>
              )}
              {!searching && !searchError && searchResults.length === 0 && searchQ && (
                <p className="text-xs text-muted-foreground px-2 py-3">Nothing found. Try the exact song title, artist, or a shorter search.</p>
              )}
              {searchResults.map((t) => (
                <button
                  key={t.id}
                  onClick={() => playSearchResult(t)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-card/80 text-left"
                >
                  <img src={t.art} alt="" className="size-12 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.artist} · {t.album}
                    </p>
                  </div>
                  {!t.previewUrl && (
                    <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                      no preview
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ControlsProps = {
  playing: boolean;
  progress: number;
  duration: number;
  pct: number;
  fmt: (s: number) => string;
  volume: number;
  muted: boolean;
  hasAudio: boolean;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onScrub: (s: number) => void;
  onVolume: (v: number) => void;
  onMute: () => void;
};

function Controls(p: ControlsProps) {
  return (
    <div className="mt-8 w-full max-w-md">
      <div
        role="slider"
        aria-label="Track progress"
        aria-valuemin={0}
        aria-valuemax={p.duration}
        aria-valuenow={p.progress}
        className="w-full h-1 bg-muted rounded-full overflow-hidden relative cursor-pointer"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - r.left;
          p.onScrub(Math.max(0, Math.min(p.duration, Math.round((x / r.width) * p.duration))));
        }}
      >
        <div
          className="absolute inset-y-0 left-0 bg-accent shadow-[0_0_12px_var(--glow)] transition-[width] duration-300"
          style={{ width: `${p.pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] tabular-nums font-mono text-muted-foreground">
        <span>{p.fmt(p.progress)}</span>
        <span>{p.fmt(p.duration)}</span>
      </div>

      <div className="mt-6 flex justify-between items-center px-2">
        <button aria-label="Shuffle" className="text-muted-foreground hover:text-foreground transition-colors">
          <Shuffle className="size-4" />
        </button>
        <div className="flex items-center gap-8">
          <button
            aria-label="Previous"
            onClick={p.onPrev}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipBack className="size-5" />
          </button>
          <button
            aria-label={p.playing ? "Pause" : "Play"}
            onClick={p.onToggle}
            disabled={!p.hasAudio}
            className="size-14 rounded-full bg-foreground text-background flex items-center justify-center ring-4 ring-foreground/10 hover:ring-foreground/20 transition-all hover:scale-[1.03] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {p.playing ? (
              <Pause className="size-5" fill="currentColor" />
            ) : (
              <Play className="size-5 ml-0.5" fill="currentColor" />
            )}
          </button>
          <button
            aria-label="Next"
            onClick={p.onNext}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipForward className="size-5" />
          </button>
        </div>
        <button aria-label="Repeat" className="text-muted-foreground hover:text-foreground transition-colors">
          <Repeat className="size-4" />
        </button>
      </div>

      {/* Volume */}
      <div className="mt-5 flex items-center gap-3 px-2">
        <button
          onClick={p.onMute}
          aria-label={p.muted ? "Unmute" : "Mute"}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {p.muted || p.volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={p.muted ? 0 : p.volume}
          onChange={(e) => p.onVolume(Number(e.target.value))}
          aria-label="Volume"
          className="flex-1 h-1 accent-[var(--accent)] cursor-pointer"
        />
        <span className="text-[10px] tabular-nums font-mono text-muted-foreground w-8 text-right">
          {Math.round((p.muted ? 0 : p.volume) * 100)}
        </span>
      </div>
    </div>
  );
}

function FocusMode({
  track,
  lyrics,
  lyricIdx,
  roomStyle,
  onExit,
  controlsProps,
}: {
  track: Track;
  lyrics: string[];
  lyricIdx: number;
  roomStyle: React.CSSProperties;
  onExit: () => void;
  controlsProps: ControlsProps;
}) {
  return (
    <div className="fixed inset-0 z-[60] room-bg text-foreground" style={roomStyle}>
      <div className="grain-overlay fixed inset-0 z-50" />
      <button
        onClick={onExit}
        aria-label="Exit focus"
        className="absolute top-6 right-6 z-[70] size-10 grid place-items-center rounded-full bg-card/60 backdrop-blur ring-1 ring-border text-muted-foreground hover:text-foreground"
      >
        <Minimize2 className="size-4" />
      </button>

      <div className="relative z-10 h-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center px-8 lg:px-20 py-16">
        <div className="flex justify-center">
          <div className="relative animate-pulse-glow rounded-full">
            <div
              className={[
                "relative size-[300px] md:size-[460px] rounded-full bg-neutral-950 ring-1 ring-white/10 shadow-2xl overflow-hidden",
                controlsProps.playing ? "animate-vinyl-spin" : "",
              ].join(" ")}
            >
              <div className="absolute inset-0 vinyl-glare" />
              <div className="absolute inset-0 border-[18px] border-black/40 rounded-full" />
              {[6, 14, 22, 30, 38, 46].map((g) => (
                <div
                  key={g}
                  className="absolute rounded-full border border-white/[0.04]"
                  style={{ inset: `${g}px` }}
                />
              ))}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="size-36 md:size-44 rounded-full ring-4 ring-black/40 overflow-hidden">
                  <img
                    src={track.art}
                    alt={track.album}
                    width={512}
                    height={512}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 size-2 rounded-full bg-background" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8 max-w-xl">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-accent mb-3">Now Playing</p>
            <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] text-balance text-glow">
              {track.title}
            </h2>
            <p className="text-muted-foreground text-lg mt-2">
              {track.artist} — <span className="italic">{track.album}</span>
            </p>
          </div>

          <div className="space-y-4 min-h-[260px] max-h-[50vh] overflow-y-auto pr-2">
            {lyrics.map((line, i) => {
              const dist = Math.abs(i - lyricIdx);
              const active = i === lyricIdx;
              return (
                <p
                  key={i}
                  className={[
                    "font-serif transition-all duration-700",
                    active
                      ? "text-foreground text-2xl md:text-3xl text-glow"
                      : dist === 1
                        ? "text-muted-foreground text-lg"
                        : "text-muted-foreground/40 text-base italic",
                  ].join(" ")}
                >
                  {line}
                </p>
              );
            })}
          </div>

          <Controls {...controlsProps} />
        </div>
      </div>
    </div>
  );
}
