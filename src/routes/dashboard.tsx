import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { TRACKS, type Track } from "@/lib/tracks";
import polaroidRain from "@/assets/polaroid-rain.jpg";

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

function Dashboard() {
  const [trackIdx, setTrackIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(82);
  const [lyricIdx, setLyricIdx] = useState(1);
  const [clock, setClock] = useState("22:45");
  const [liked, setLiked] = useState(false);
  const [focus, setFocus] = useState(false);
  const [mood, setMood] = useState("shinjuku");

  const track: Track = TRACKS[trackIdx];
  const activeMood = useMemo(() => MOODS.find((m) => m.id === mood)!, [mood]);

  // accent style — drives whole-room color shift
  const roomStyle = useMemo(
    () =>
      ({
        ["--accent" as string]: track.accent,
        ["--glow" as string]: `color-mix(in oklab, ${track.accent} 55%, transparent)`,
      }) as React.CSSProperties,
    [track.accent],
  );

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setProgress((p) => {
        if (p + 1 >= track.duration) {
          setTrackIdx((i) => (i + 1) % TRACKS.length);
          return 0;
        }
        return p + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [playing, track.duration]);

  useEffect(() => {
    const id = setInterval(() => setLyricIdx((i) => (i + 1) % track.lyrics.length), 4200);
    return () => clearInterval(id);
  }, [track.lyrics.length]);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // reset progress when switching track
  useEffect(() => setProgress(0), [trackIdx]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const pct = (progress / track.duration) * 100;

  if (focus) {
    return (
      <FocusMode
        track={track}
        playing={playing}
        progress={progress}
        lyricIdx={lyricIdx}
        pct={pct}
        fmt={fmt}
        roomStyle={roomStyle}
        onExit={() => setFocus(false)}
        onToggle={() => setPlaying((p) => !p)}
        onPrev={() => setTrackIdx((i) => (i - 1 + TRACKS.length) % TRACKS.length)}
        onNext={() => setTrackIdx((i) => (i + 1) % TRACKS.length)}
        onScrub={(s) => setProgress(s)}
      />
    );
  }

  return (
    <div className="relative min-h-screen room-bg text-foreground overflow-hidden" style={roomStyle}>
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

            {/* expand button */}
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
          </div>

          <Controls
            playing={playing}
            progress={progress}
            duration={track.duration}
            pct={pct}
            fmt={fmt}
            onToggle={() => setPlaying((p) => !p)}
            onPrev={() => setTrackIdx((i) => (i - 1 + TRACKS.length) % TRACKS.length)}
            onNext={() => setTrackIdx((i) => (i + 1) % TRACKS.length)}
            onScrub={(s) => setProgress(s)}
          />

          {/* Floating lyrics */}
          <div className="mt-12 h-28 relative overflow-hidden w-full max-w-xl">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <p className="text-muted-foreground/60 text-sm italic font-serif animate-lyric-float">
                {track.lyrics[(lyricIdx - 1 + track.lyrics.length) % track.lyrics.length]}
              </p>
              <p
                key={lyricIdx}
                className="text-foreground text-lg md:text-xl font-serif transition-opacity duration-700"
              >
                {track.lyrics[lyricIdx]}
              </p>
              <p className="text-muted-foreground/40 text-sm italic font-serif">
                {track.lyrics[(lyricIdx + 1) % track.lyrics.length]}
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
                  {TRACKS.slice(0, 4).map((t) => (
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

          {/* Vinyl shelf */}
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-4">Collection</h3>
            <div className="flex gap-4 overflow-x-auto pb-3 no-scrollbar">
              {TRACKS.map((t, i) => {
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
    </div>
  );
}

function Controls({
  playing,
  progress,
  duration,
  pct,
  fmt,
  onToggle,
  onPrev,
  onNext,
  onScrub,
}: {
  playing: boolean;
  progress: number;
  duration: number;
  pct: number;
  fmt: (s: number) => string;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onScrub: (s: number) => void;
}) {
  return (
    <div className="mt-8 w-full max-w-md">
      <div
        role="slider"
        aria-label="Track progress"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={progress}
        className="w-full h-1 bg-muted rounded-full overflow-hidden relative cursor-pointer"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - r.left;
          onScrub(Math.max(0, Math.min(duration, Math.round((x / r.width) * duration))));
        }}
      >
        <div
          className="absolute inset-y-0 left-0 bg-accent shadow-[0_0_12px_var(--glow)] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] tabular-nums font-mono text-muted-foreground">
        <span>{fmt(progress)}</span>
        <span>{fmt(duration)}</span>
      </div>

      <div className="mt-6 flex justify-between items-center px-2">
        <button aria-label="Shuffle" className="text-muted-foreground hover:text-foreground transition-colors">
          <Shuffle className="size-4" />
        </button>
        <div className="flex items-center gap-8">
          <button
            aria-label="Previous"
            onClick={onPrev}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipBack className="size-5" />
          </button>
          <button
            aria-label={playing ? "Pause" : "Play"}
            onClick={onToggle}
            className="size-14 rounded-full bg-foreground text-background flex items-center justify-center ring-4 ring-foreground/10 hover:ring-foreground/20 transition-all hover:scale-[1.03]"
          >
            {playing ? (
              <Pause className="size-5" fill="currentColor" />
            ) : (
              <Play className="size-5 ml-0.5" fill="currentColor" />
            )}
          </button>
          <button
            aria-label="Next"
            onClick={onNext}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipForward className="size-5" />
          </button>
        </div>
        <button aria-label="Repeat" className="text-muted-foreground hover:text-foreground transition-colors">
          <Repeat className="size-4" />
        </button>
      </div>
    </div>
  );
}

function FocusMode({
  track,
  playing,
  progress,
  lyricIdx,
  pct,
  fmt,
  roomStyle,
  onExit,
  onToggle,
  onPrev,
  onNext,
  onScrub,
}: {
  track: Track;
  playing: boolean;
  progress: number;
  lyricIdx: number;
  pct: number;
  fmt: (s: number) => string;
  roomStyle: React.CSSProperties;
  onExit: () => void;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onScrub: (s: number) => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] room-bg text-foreground" style={roomStyle}>
      <div className="grain-overlay fixed inset-0 z-50" />
      <button
        onClick={onExit}
        aria-label="Exit focus"
        className="absolute top-6 right-6 z-10 size-10 grid place-items-center rounded-full bg-card/60 backdrop-blur ring-1 ring-border text-muted-foreground hover:text-foreground"
      >
        <Minimize2 className="size-4" />
      </button>

      <div className="relative z-10 h-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center px-8 lg:px-20 py-16">
        {/* Vinyl */}
        <div className="flex justify-center">
          <div className="relative animate-pulse-glow rounded-full">
            <div
              className={[
                "relative size-[300px] md:size-[460px] rounded-full bg-neutral-950 ring-1 ring-white/10 shadow-2xl overflow-hidden",
                playing ? "animate-vinyl-spin" : "",
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

        {/* Lyrics + meta */}
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

          <div className="space-y-4 min-h-[260px]">
            {track.lyrics.map((line, i) => {
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

          <Controls
            playing={playing}
            progress={progress}
            duration={track.duration}
            pct={pct}
            fmt={fmt}
            onToggle={onToggle}
            onPrev={onPrev}
            onNext={onNext}
            onScrub={onScrub}
          />
        </div>
      </div>
    </div>
  );
}
