// Spotify Web API — PKCE flow for SPA (client secret NEVER required).
// Client ID is public/safe to ship in browser code.

export const SPOTIFY_CLIENT_ID = "68565523717e402fa9bdf0603b7425e6";

const SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-recently-played",
  "user-top-read",
  "playlist-read-private",
  "streaming",
].join(" ");

const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";
const PLAYER_SDK_URL = "https://sdk.scdn.co/spotify-player.js";

const LS = {
  access: "spotify_access_token",
  refresh: "spotify_refresh_token",
  expiresAt: "spotify_expires_at",
  verifier: "spotify_pkce_verifier",
  state: "spotify_oauth_state",
} as const;

const redirectUri = () =>
  typeof window === "undefined" ? "" : `${window.location.origin}/callback`;

// ---------- PKCE helpers ----------
function randomString(len: number) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

async function sha256(input: string) {
  const data = new TextEncoder().encode(input);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

function base64UrlEncode(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// ---------- Auth ----------
export async function beginSpotifyLogin() {
  const verifier = randomString(64);
  const challenge = base64UrlEncode(await sha256(verifier));
  const state = randomString(16);

  sessionStorage.setItem(LS.verifier, verifier);
  sessionStorage.setItem(LS.state, state);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: SCOPES,
  });

  window.location.assign(`${AUTH_URL}?${params.toString()}`);
}

export async function completeSpotifyLogin(code: string, returnedState: string) {
  const verifier = sessionStorage.getItem(LS.verifier);
  const expectedState = sessionStorage.getItem(LS.state);
  if (!verifier) throw new Error("Missing PKCE verifier — please try again.");
  if (returnedState !== expectedState) throw new Error("State mismatch — possible CSRF.");

  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${txt}`);
  }

  const data: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  } = await res.json();

  persistTokens(data.access_token, data.refresh_token, data.expires_in);
  sessionStorage.removeItem(LS.verifier);
  sessionStorage.removeItem(LS.state);
}

function persistTokens(access: string, refresh: string, expiresIn: number) {
  localStorage.setItem(LS.access, access);
  if (refresh) localStorage.setItem(LS.refresh, refresh);
  localStorage.setItem(LS.expiresAt, String(Date.now() + (expiresIn - 60) * 1000));
}

export function logoutSpotify() {
  localStorage.removeItem(LS.access);
  localStorage.removeItem(LS.refresh);
  localStorage.removeItem(LS.expiresAt);
}

export function isSpotifyConnected() {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(LS.access));
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem(LS.refresh);
  if (!refresh) return null;
  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refresh,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    logoutSpotify();
    return null;
  }
  const data: { access_token: string; refresh_token?: string; expires_in: number } =
    await res.json();
  persistTokens(data.access_token, data.refresh_token ?? refresh, data.expires_in);
  return data.access_token;
}

async function getValidToken(): Promise<string | null> {
  const token = localStorage.getItem(LS.access);
  const expiresAt = Number(localStorage.getItem(LS.expiresAt) || 0);
  if (token && Date.now() < expiresAt) return token;
  return refreshAccessToken();
}

// ---------- API ----------
export async function spotifyFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getValidToken();
  if (!token) throw new Error("Not authenticated with Spotify.");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Spotify ${res.status}: ${txt}`);
  }
  return res.json();
}

export type SpotifyProfile = {
  id: string;
  display_name: string;
  email?: string;
  images?: { url: string }[];
  product?: string; // 'premium' | 'free'
};

export type SpotifyTrack = {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  preview_url: string | null;
  artists: { name: string }[];
  album: { name: string; images: { url: string; width: number; height: number }[] };
  external_urls?: { spotify?: string };
};

export const getProfile = () => spotifyFetch<SpotifyProfile>("/me");

export const getTopTracks = (limit = 12) =>
  spotifyFetch<{ items: SpotifyTrack[] }>(
    `/me/top/tracks?limit=${limit}&time_range=short_term&market=from_token`,
  );

export const getRecentlyPlayed = (limit = 12) =>
  spotifyFetch<{ items: { track: SpotifyTrack }[] }>(
    `/me/player/recently-played?limit=${limit}`,
  );

export const searchTracks = (q: string, limit = 12) =>
  spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(
    `/search?type=track&limit=${limit}&market=from_token&q=${encodeURIComponent(q)}`,
  );

export type SpotifyPlayerState = {
  deviceId: string | null;
  isReady: boolean;
  isPremium: boolean;
  isActive: boolean;
  currentTrackUri: string | null;
  paused: boolean;
  position: number;
  duration: number;
  error: string | null;
};

export type SpotifyWebPlaybackPlayer = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  togglePlay: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  addListener: (event: string, cb: (payload: any) => void) => boolean;
  removeListener: (event?: string) => boolean;
};

declare global {
  interface Window {
    Spotify?: {
      Player: new (config: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyWebPlaybackPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

let sdkPromise: Promise<void> | null = null;

export async function ensureSpotifyPlaybackSdk() {
  if (typeof window === "undefined") return;
  if (window.Spotify?.Player) return;
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PLAYER_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Spotify Playback SDK.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = PLAYER_SDK_URL;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Spotify Playback SDK."));
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    document.body.appendChild(script);
  });

  return sdkPromise;
}

export async function createSpotifyPlayback(
  onStateChange: (state: SpotifyPlayerState) => void,
  volume = 0.7,
) {
  await ensureSpotifyPlaybackSdk();
  if (!window.Spotify?.Player) throw new Error("Spotify Playback SDK unavailable.");

  const player = new window.Spotify.Player({
    name: "echo.room",
    getOAuthToken: async (cb) => {
      const token = await getValidToken();
      cb(token ?? "");
    },
    volume,
  });

  const emitError = (message: string) => {
    onStateChange({
      deviceId: null,
      isReady: false,
      isPremium: false,
      isActive: false,
      currentTrackUri: null,
      paused: true,
      position: 0,
      duration: 0,
      error: message,
    });
  };

  player.addListener("ready", ({ device_id }: { device_id: string }) => {
    onStateChange({
      deviceId: device_id,
      isReady: true,
      isPremium: true,
      isActive: false,
      currentTrackUri: null,
      paused: true,
      position: 0,
      duration: 0,
      error: null,
    });
  });

  player.addListener("not_ready", () => {
    emitError("Spotify player went offline.");
  });
  player.addListener("initialization_error", ({ message }: { message: string }) => emitError(message));
  player.addListener("authentication_error", ({ message }: { message: string }) => emitError(message));
  player.addListener("account_error", ({ message }: { message: string }) => {
    onStateChange({
      deviceId: null,
      isReady: false,
      isPremium: false,
      isActive: false,
      currentTrackUri: null,
      paused: true,
      position: 0,
      duration: 0,
      error: message,
    });
  });
  player.addListener("playback_error", ({ message }: { message: string }) => emitError(message));

  player.addListener("player_state_changed", (state: any) => {
    if (!state) {
      onStateChange({
        deviceId: null,
        isReady: true,
        isPremium: true,
        isActive: false,
        currentTrackUri: null,
        paused: true,
        position: 0,
        duration: 0,
        error: null,
      });
      return;
    }
    onStateChange({
      deviceId: null,
      isReady: true,
      isPremium: true,
      isActive: true,
      currentTrackUri: state.track_window.current_track?.uri ?? null,
      paused: state.paused,
      position: state.position ?? 0,
      duration: state.duration ?? 0,
      error: null,
    });
  });

  const connected = await player.connect();
  if (!connected) throw new Error("Could not connect Spotify player.");
  return player;
}

export async function transferPlayback(deviceId: string, play = false) {
  const token = await getValidToken();
  if (!token) throw new Error("Not authenticated with Spotify.");
  const res = await fetch(`${API}/me/player`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
  if (!res.ok && res.status !== 204) {
    const txt = await res.text();
    throw new Error(`Spotify transfer failed (${res.status}): ${txt}`);
  }
}

export async function playTrackOnDevice(deviceId: string, uri: string) {
  const token = await getValidToken();
  if (!token) throw new Error("Not authenticated with Spotify.");
  const res = await fetch(`${API}/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris: [uri] }),
  });
  if (!res.ok && res.status !== 204) {
    const txt = await res.text();
    throw new Error(`Spotify play failed (${res.status}): ${txt}`);
  }
}
