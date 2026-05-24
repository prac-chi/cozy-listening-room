import { createFileRoute, Link } from "@tanstack/react-router";
import { Music, Headphones } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "echo.room — your tiny digital listening room" },
      {
        name: "description",
        content:
          "An aesthetic, cozy music player. Spinning vinyl, floating lyrics, mood rooms, and album-color ambience for late-night listening.",
      },
      { property: "og:title", content: "echo.room — your tiny digital listening room" },
      {
        property: "og:description",
        content: "Connect Spotify. Listen inside an enchanted jukebox of vinyl, lyrics & light.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="grain-overlay fixed inset-0 z-50" />

      {/* Rose halos */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[900px] rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(closest-side, var(--glow), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 -left-32 size-[600px] rounded-full blur-3xl opacity-25"
        style={{ background: "radial-gradient(closest-side, oklch(0.65 0.2 350 / 0.6), transparent 70%)" }}
      />

      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none">
        {[
          { left: "12%", dur: "16s", delay: "0s" },
          { left: "28%", dur: "20s", delay: "2s" },
          { left: "48%", dur: "14s", delay: "6s" },
          { left: "70%", dur: "22s", delay: "1s" },
          { left: "88%", dur: "18s", delay: "5s" },
        ].map((p, i) => (
          <span
            key={i}
            className="absolute bottom-0 size-[3px] rounded-full bg-primary/70"
            style={{ left: p.left, animation: `particle-rise ${p.dur} linear ${p.delay} infinite` }}
          />
        ))}
      </div>

      <header className="relative z-10 mx-auto max-w-7xl px-6 lg:px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2 font-serif text-lg">
          <span className="size-2 rounded-full bg-primary shadow-[0_0_10px_var(--glow)]" />
          echo<span className="text-primary">.</span>room
        </div>
        <nav className="hidden sm:flex items-center gap-7 text-xs uppercase tracking-[0.22em] text-muted-foreground">
          <a href="#rooms" className="hover:text-foreground transition-colors">Rooms</a>
          <a href="#story" className="hover:text-foreground transition-colors">Story</a>
          <Link to="/dashboard" className="hover:text-foreground transition-colors">Enter</Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 lg:px-10 pt-6 pb-24 flex flex-col items-center text-center">
        {/* Vinyl with app name on the label */}
        <div className="relative mt-6 animate-pulse-glow rounded-full">
          <div className="relative size-[300px] sm:size-[420px] rounded-full bg-neutral-950 ring-1 ring-white/10 shadow-2xl overflow-hidden animate-vinyl-spin">
            <div className="absolute inset-0 vinyl-glare" />
            <div className="absolute inset-0 border-[18px] border-black/40 rounded-full" />
            {/* grooves */}
            {[6, 14, 22, 30, 38, 46].map((g) => (
              <div
                key={g}
                className="absolute rounded-full border border-white/[0.04]"
                style={{ inset: `${g}px` }}
              />
            ))}
            {/* label */}
            <div
              className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 size-40 sm:size-52 rounded-full grid place-items-center text-center ring-4 ring-black/40"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, oklch(0.85 0.18 10), oklch(0.55 0.22 0) 60%, oklch(0.3 0.15 0))",
              }}
            >
              <div className="flex flex-col items-center gap-1 px-4">
                <span className="text-[9px] uppercase tracking-[0.35em] text-white/70">side a</span>
                <span className="font-serif italic text-2xl sm:text-3xl text-white drop-shadow">
                  echo<span className="opacity-80">.</span>room
                </span>
                <span className="text-[9px] uppercase tracking-[0.3em] text-white/60">
                  33⅓ rpm · stereo
                </span>
              </div>
              <div className="absolute size-3 rounded-full bg-neutral-950 ring-2 ring-white/20" />
            </div>
          </div>
          {/* stylus arm */}
          <div
            aria-hidden
            className="absolute -right-4 top-2 w-7 h-52 rounded-full bg-zinc-700/60 blur-[2px] -rotate-12 pointer-events-none"
          />
        </div>

        <div className="mt-14 max-w-2xl space-y-5">
          <p className="text-[10px] uppercase tracking-[0.35em] text-primary">
            a tiny digital listening room
          </p>
          <h1 className="font-serif text-4xl sm:text-6xl leading-[1.05] text-balance text-glow">
            Music isn't a file.<br />
            It's a <em className="italic">room you walk into.</em>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Connect Spotify and we'll turn your library into a candlelit café, a rainy
            cassette deck, a neon attic at 2&nbsp;AM. Same songs. Better atmosphere.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-3 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium text-sm shadow-[0_8px_40px_-8px_var(--glow)] hover:scale-[1.03] transition-transform"
            >
              <Music className="size-4" />
              Continue with Spotify
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full ring-1 ring-border text-sm text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors"
            >
              <Headphones className="size-4" />
              Tour the room
            </Link>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
            Demo mode · no account needed
          </p>
        </div>

        {/* Rooms preview */}
        <section id="rooms" className="mt-32 w-full">
          <h2 className="font-serif text-xs uppercase tracking-[0.3em] text-muted-foreground mb-8">
            Choose your room
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: "Rainy Café", desc: "Steam, jazz, soft chatter.", c: "oklch(0.72 0.12 60)" },
              { name: "Shinjuku Neon", desc: "City pop & wet asphalt.", c: "oklch(0.7 0.2 320)" },
              { name: "Vinyl Attic", desc: "Dust, lamplight, slow records.", c: "oklch(0.72 0.14 30)" },
            ].map((r) => (
              <div
                key={r.name}
                className="group relative aspect-[4/5] rounded-2xl ring-1 ring-border overflow-hidden bg-card p-5 flex flex-col justify-end text-left hover:-translate-y-1 transition-transform"
                style={{
                  background: `radial-gradient(120% 80% at 50% 0%, color-mix(in oklab, ${r.c} 35%, transparent), transparent 60%), var(--color-card)`,
                }}
              >
                <div
                  className="absolute top-6 left-6 size-16 rounded-full ring-1 ring-white/10 animate-vinyl-spin"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${r.c}, oklch(0.18 0.01 350) 70%)`,
                  }}
                />
                <h3 className="font-serif text-xl text-foreground">{r.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="story" className="mt-32 max-w-2xl text-center">
          <p className="font-serif italic text-xl text-muted-foreground leading-relaxed">
            "Spotify is the backstage machinery.<br />
            <span className="text-foreground">echo.room is the enchanted jukebox.</span>"
          </p>
        </section>
      </main>

      <footer className="relative z-10 mx-auto max-w-7xl px-6 lg:px-10 py-8 flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-muted-foreground border-t border-border">
        <span>echo.room · 2026</span>
        <span>side a — track 01</span>
      </footer>
    </div>
  );
}
