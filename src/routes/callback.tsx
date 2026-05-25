import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { completeSpotifyLogin } from "@/lib/spotify";

export const Route = createFileRoute("/callback")({
  head: () => ({
    meta: [{ title: "Connecting Spotify — echo.room" }],
  }),
  component: Callback,
});

function Callback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const err = url.searchParams.get("error");

    if (err) {
      setError(err);
      return;
    }
    if (!code || !state) {
      setError("Missing authorization code.");
      return;
    }

    completeSpotifyLogin(code, state)
      .then(() => navigate({ to: "/dashboard", replace: true }))
      .catch((e: Error) => setError(e.message));
  }, [navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
      <div className="text-center max-w-md space-y-4">
        <div className="mx-auto size-16 rounded-full bg-neutral-950 ring-1 ring-white/10 animate-vinyl-spin" />
        {error ? (
          <>
            <h1 className="font-serif text-2xl text-glow">Couldn't connect</h1>
            <p className="text-sm text-muted-foreground break-words">{error}</p>
            <p className="text-xs text-muted-foreground/70">
              Make sure this URL is added as a Redirect URI in your Spotify app settings:
              <br />
              <code className="text-foreground">{typeof window !== "undefined" ? window.location.origin + "/callback" : ""}</code>
            </p>
            <a
              href="/"
              className="inline-block px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm"
            >
              Back to lobby
            </a>
          </>
        ) : (
          <>
            <h1 className="font-serif text-2xl text-glow">Tuning the room…</h1>
            <p className="text-sm text-muted-foreground">Connecting to Spotify.</p>
          </>
        )}
      </div>
    </div>
  );
}
