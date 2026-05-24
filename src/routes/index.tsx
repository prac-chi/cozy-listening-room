import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat } from "lucide-react";
import albumMain from "@/assets/album-main.jpg";
import polaroidRain from "@/assets/polaroid-rain.jpg";
import album1 from "@/assets/album-1.jpg";
import album2 from "@/assets/album-2.jpg";
import album3 from "@/assets/album-3.jpg";
import album4 from "@/assets/album-4.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Echo Room — a tiny digital listening room" },
      {
        name: "description",
        content:
          "An aesthetic, cozy music player. Spinning vinyl, floating lyrics, mood rooms, and scrapbook playlists for late-night listening.",
      },
      { property: "og:title", content: "Echo Room — a tiny digital listening room" },
      {
        property: "og:description",
        content:
          "Spinning vinyl, floating lyrics, mood rooms and scrapbook playlists. Music as atmosphere.",
      },
    ],
  }),
  component: EchoRoom,
});

type Mood = {
  id: string;
  name: string;
  weather: string;
  temp: string;
  city: string;
};

const MOODS: Mood[] = [
  { id: "shinjuku", name: "Shinjuku Neon", weather: "Light rain on asphalt", temp: "14°C", city: "Tokyo" },
  { id: "cafe", name: "Rainy Café", weather: "Steam on the window", temp: "11°C", city: "Kyoto" },
  { id: "attic", name: "Vinyl Attic", weather: "Dust drifting in lamplight", temp: "18°C", city: "Berlin" },
];

const LYRICS = [
  "Streetlights paint the road in honey gold",
  "The city lights reflecting on the dashboard",
  "Watching the neon signs drift slowly by",
  "Somewhere a saxophone is missing you",
  "Tonight the rain remembers every name",
];

const SHELF = [
  { art: album1, title: "Sunsets & Cigarettes", artist: "Aiko Mori" },
  { art: album2, title: "Urban Melancholy", artist: "Tomoko Aran" },
  { art: album3, title: "Deep Sea Jazz", artist: "Hiroshi Sato" },
  { art: album4, title: "Plastic Summer", artist: "Mariya Takeuchi" },
];

function EchoRoom() {
  const [mood, setMood] = useState<string>("shinjuku");
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(82); // seconds
  const duration = 264; // 4:24
  const [lyricIdx, setLyricIdx] = useState(1);
  const [clock, setClock] = useState("22:45");
  const [liked, setLiked] = useState(false);

  const activeMood = useMemo(() => MOODS.find((m) => m.id === mood)!, [mood]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setProgress((p) => (p + 1) % duration);
    }, 1000);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    const id = setInterval(() => {
      setLyricIdx((i) => (i + 1) % LYRICS.length);
    }, 4200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      setClock(`${hh}:${mm}`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const pct = (progress / duration) * 100;

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <div className="grain-overlay fixed inset-0 z-50" />

      {/* Ambient particles */}
      <div className="fixed inset-0 pointer-events-none">
        {[
          { left: "8%", delay: "0s", dur: "14s" },
          { left: "22%", delay: "3s", dur: "18s" },
          { left: "44%", delay: "6s", dur: "16s" },
          { left: "63%", delay: "1s", dur: "20s" },
          { left: "82%", delay: "8s", dur: "15s" },
          { left: "92%", delay: "4s", dur: "22s" },
        ].map((p, i) => (
          <span
            key={i}
            className="absolute bottom-0 size-[3px] rounded-full bg-white/80"
            style={{
              left: p.left,
              animation: `particle-rise ${p.dur} linear ${p.delay} infinite`,
            }}
          />
        ))}
      </div>

      {/* Ambient amber halo */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-1/3 left-1/2 -translate-x-1/2 size-[900px] rounded-full blur-3xl opacity-20"
        style={{ background: "radial-gradient(closest-side, var(--glow), transparent 70%)" }}
      />

      <main className="relative z-10 mx-auto max-w-7xl px-6 lg:px-10 py-10 lg:py-14 grid grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left rail */}
        <aside className="col-span-12 lg:col-span-2 space-y-10">
          <div>
            <h1 className="font-serif text-xl tracking-tight">
              echo<span className="text-accent">.</span>room
            </h1>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">
              a listening room
            </p>
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
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Atmosphere
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{clock}</span>
            </div>
            <div className="text-xs leading-relaxed text-foreground/85">
              {activeMood.city} — {activeMood.temp}
              <br />
              {activeMood.weather}.
            </div>
          </div>
        </aside>

        {/* Center: vinyl + controls + lyrics */}
        <section className="col-span-12 lg:col-span-6 flex flex-col items-center text-center">
          <div className="relative">
            {/* Vinyl */}
            <div
              className={[
                "relative size-72 md:size-96 rounded-full bg-neutral-900 shadow-2xl ring-1 ring-white/10 overflow-hidden",
                playing ? "animate-vinyl-spin" : "",
              ].join(" ")}
              style={!playing ? { animationPlayState: "paused" } : undefined}
            >
              <div className="absolute inset-0 vinyl-glare" />
              <div className="absolute inset-0 border-[16px] border-black/30 rounded-full" />
              <div className="absolute inset-4 border border-white/5 rounded-full" />
              <div className="absolute inset-10 border border-white/5 rounded-full" />
              <div className="absolute inset-16 border border-white/5 rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="size-28 md:size-32 rounded-full ring-4 ring-black/40 overflow-hidden">
                  <img
                    src={albumMain}
                    alt="Album art: Midnight in Ginza"
                    width={512}
                    height={512}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 size-2 rounded-full bg-background" />
            </div>

            {/* Stylus */}
            <div
              aria-hidden
              className="absolute -right-2 top-2 w-7 h-44 rounded-full bg-zinc-700/70 blur-[2px] -rotate-12 pointer-events-none"
            />
          </div>

          <div className="mt-10 space-y-2">
            <h2 className="text-3xl md:text-5xl font-serif font-medium text-balance leading-tight text-glow">
              Midnight in Ginza
            </h2>
            <p className="text-muted-foreground text-base md:text-lg">
              Hiroshi Matsui — <span className="italic">Transient Summers</span>
            </p>
          </div>

          {/* Controls */}
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
                setProgress(Math.max(0, Math.min(duration, Math.round((x / r.width) * duration))));
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
              <button
                onClick={() => {}}
                aria-label="Shuffle"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Shuffle className="size-4" />
              </button>
              <div className="flex items-center gap-8">
                <button
                  aria-label="Previous"
                  onClick={() => setProgress(0)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <SkipBack className="size-5" />
                </button>
                <button
                  aria-label={playing ? "Pause" : "Play"}
                  onClick={() => setPlaying((p) => !p)}
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
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <SkipForward className="size-5" />
                </button>
              </div>
              <button
                aria-label="Repeat"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Repeat className="size-4" />
              </button>
            </div>
          </div>

          {/* Floating lyrics */}
          <div className="mt-12 h-28 relative overflow-hidden w-full max-w-xl">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <p className="text-muted-foreground/60 text-sm italic font-serif animate-lyric-float">
                {LYRICS[(lyricIdx - 1 + LYRICS.length) % LYRICS.length]}
              </p>
              <p
                key={lyricIdx}
                className="text-foreground text-lg md:text-xl font-serif transition-opacity duration-700"
              >
                {LYRICS[lyricIdx]}
              </p>
              <p className="text-muted-foreground/40 text-sm italic font-serif">
                {LYRICS[(lyricIdx + 1) % LYRICS.length]}
              </p>
            </div>
          </div>
        </section>

        {/* Right rail: scrapbook + shelf */}
        <aside className="col-span-12 lg:col-span-4 space-y-10">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Night Log
              </h3>
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
              {/* Polaroid */}
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

              {/* Tape cassette card */}
              <div className="relative bg-card/60 p-5 rounded-lg ring-1 ring-border rotate-1">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-muted/40 backdrop-blur-sm border-x border-border" />
                <h4 className="text-sm font-medium text-foreground mb-3 font-serif">
                  Late Shift Essentials
                </h4>
                <ul className="text-xs text-muted-foreground space-y-2">
                  {[
                    "Plastic Love — Mariya Takeuchi",
                    "Midnight Pretenders — Tomoko Aran",
                    "Stay With Me — Miki Matsubara",
                    "Mayonaka no Door — Miki Matsubara",
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <span className="size-1 rounded-full bg-accent/60" />
                      <span className="truncate">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Vinyl shelf */}
          <div className="pt-2">
            <h3 className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground mb-4">
              Collection
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-3 no-scrollbar">
              {SHELF.map((a) => (
                <button key={a.title} className="shrink-0 group text-left">
                  <div className="size-28 rounded-sm overflow-hidden ring-1 ring-border transition-transform group-hover:-translate-y-1">
                    <img
                      src={a.art}
                      alt={`${a.title} by ${a.artist}`}
                      loading="lazy"
                      width={512}
                      height={512}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-foreground truncate w-28">{a.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate w-28">{a.artist}</p>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* Ambient visualizer footer */}
      <footer className="fixed bottom-0 inset-x-0 h-28 pointer-events-none z-0">
        <div className="flex items-end justify-center h-full gap-1 px-8 opacity-25">
          {[10, 22, 14, 28, 18, 12, 24, 16, 30, 20, 14, 26, 18, 12, 22, 16].map((h, i) => (
            <span
              key={i}
              className="w-1 bg-foreground rounded-t-full animate-eq"
              style={{
                height: `${h * 3}px`,
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
