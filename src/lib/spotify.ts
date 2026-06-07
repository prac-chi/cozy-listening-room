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
  "playlist-read-collaborative",
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
    show_dialog: "true",
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

async function spotifyApiRequest(path: string, init: RequestInit = {}, retryOnAuth = true) {
  const token = await getValidToken();
  if (!token) throw new Error("Not authenticated with Spotify.");

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401 && retryOnAuth) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      return spotifyApiRequest(path, init, false);
    }
  }

  return res;
}

// ---------- API ----------
export async function spotifyFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await spotifyApiRequest(path, init);
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
  country?: string;
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

export type SpotifyAlbum = {
  id: string;
  name: string;
  uri: string;
  album_type?: string;
  total_tracks?: number;
  release_date?: string;
  artists: { name: string }[];
  images: { url: string; width?: number; height?: number }[];
  external_urls?: { spotify?: string };
};

export type SpotifyPlaylist = {
  id: string;
  name: string;
  uri: string;
  description?: string;
  images: { url: string; width?: number; height?: number }[];
  owner?: { display_name?: string };
  tracks?: { total: number };
  external_urls?: { spotify?: string };
};

type ItunesSong = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  trackViewUrl?: string;
};

type TrackPreviewMatch = {
  previewUrl: string;
  art?: string;
  durationMs?: number;
  album?: string;
  externalUrl?: string;
};

const previewLookupCache = new Map<string, TrackPreviewMatch | null>();

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchItunesTracks(query: string, limit: number) {
  const res = await fetch(
    `https://itunes.apple.com/search?media=music&entity=song&limit=${limit}&term=${encodeURIComponent(query)}`,
  );
  if (!res.ok) return [] as SpotifyTrack[];

  const data: { results?: ItunesSong[] } = await res.json();
  return (data.results ?? [])
    .filter((item) => item.previewUrl && item.trackName && item.artistName)
    .map((item, index) => ({
      id: `it-${item.trackId ?? `${normalizeSearchValue(item.artistName ?? "artist")}-${normalizeSearchValue(item.trackName ?? `track-${index}`)}`}`,
      name: item.trackName ?? "Unknown track",
      uri: "",
      duration_ms: item.trackTimeMillis ?? 30_000,
      preview_url: item.previewUrl ?? null,
      artists: [{ name: item.artistName ?? "Unknown artist" }],
      album: {
        name: item.collectionName ?? "Single",
        images: item.artworkUrl100
          ? [{ url: item.artworkUrl100, width: 100, height: 100 }]
          : [],
      },
      external_urls: { spotify: item.trackViewUrl },
    }));
}

export async function getFallbackTracks(limit = 12) {
  const seeds = ["The Weeknd", "Taylor Swift", "Drake", "Billie Eilish", "SZA"];
  const batches = await Promise.all(seeds.map((seed) => searchItunesTracks(seed, Math.max(3, Math.ceil(limit / seeds.length)))));
  const seen = new Set<string>();
  const items: SpotifyTrack[] = [];

  for (const batch of batches) {
    for (const track of batch) {
      if (seen.has(track.id)) continue;
      seen.add(track.id);
      items.push(track);
      if (items.length >= limit) return items;
    }
  }

  return items;
}

export async function lookupTrackPreview(artist: string, title: string): Promise<TrackPreviewMatch | null> {
  const cacheKey = `${artist}::${title}`.toLowerCase();
  if (previewLookupCache.has(cacheKey)) return previewLookupCache.get(cacheKey) ?? null;

  try {
    const results = await searchItunesTracks(`${artist} ${title}`, 6);
    const normalizedTitle = normalizeSearchValue(title);
    const normalizedArtist = normalizeSearchValue(artist.split(",")[0] ?? artist);

    const match = results.find((result) => {
      const resultTitle = normalizeSearchValue(result.name);
      const resultArtist = normalizeSearchValue(result.artists[0]?.name ?? "");
      return (
        (resultTitle.includes(normalizedTitle) || normalizedTitle.includes(resultTitle))
        && (resultArtist.includes(normalizedArtist) || normalizedArtist.includes(resultArtist))
      );
    }) ?? results[0];

    const preview = match?.preview_url
      ? {
          previewUrl: match.preview_url,
          art: match.album.images[0]?.url,
          durationMs: match.duration_ms,
          album: match.album.name,
          externalUrl: match.external_urls?.spotify,
        }
      : null;

    previewLookupCache.set(cacheKey, preview);
    return preview;
  } catch {
    previewLookupCache.set(cacheKey, null);
    return null;
  }
}

export const getProfile = () => spotifyFetch<SpotifyProfile>("/me");

export const getTopTracks = (limit = 12) =>
  spotifyFetch<{ items: SpotifyTrack[] }>(
    `/me/top/tracks?limit=${limit}&time_range=short_term`,
  );

export const getRecentlyPlayed = (limit = 12) =>
  spotifyFetch<{ items: { track: SpotifyTrack }[] }>(
    `/me/player/recently-played?limit=${limit}`,
  );

export async function searchTracks(q: string, limit = 20, market?: string) {
  const query = q.replace(/\s+/g, " ").trim();
  if (query.length < 2) return { tracks: { items: [] } };

  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
  if (!isSpotifyConnected()) {
    return { tracks: { items: await searchItunesTracks(query, safeLimit) } };
  }

  const normalizedMarket = market?.trim().toUpperCase();
  const validMarket = normalizedMarket && /^[A-Z]{2}$/.test(normalizedMarket)
    ? normalizedMarket
    : null;
  const simplifiedQuery = query
    .replace(/[^\p{L}\p{N}\s'&-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const queryVariants = Array.from(
    new Set([
      query,
      simplifiedQuery,
      `track:${query}`,
      `"${query}"`,
      `track:"${query}"`,
    ].filter(Boolean)),
  );

  const attempts = [
    ...queryVariants.flatMap((value) =>
      validMarket
        ? [`/search?type=track&limit=${safeLimit}&market=${validMarket}&q=${encodeURIComponent(value)}`]
        : [],
    ),
    ...queryVariants.map(
      (value) => `/search?type=track&limit=${safeLimit}&q=${encodeURIComponent(value)}`,
    ),
  ];

  let lastResult: { tracks: { items: SpotifyTrack[] } } | null = null;
  let lastError: unknown = null;

  for (const path of attempts) {
    try {
      const result = await spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(path);
      lastResult = result;
      if (result.tracks?.items?.length) return result;
    } catch (err) {
      lastError = err;
    }
  }

  const fallbackItems = await searchItunesTracks(query, safeLimit);
  if (fallbackItems.length) {
    return { tracks: { items: fallbackItems } };
  }

  if (
    !lastResult
    && lastError instanceof Error
    && /Not authenticated|Spotify 401/i.test(lastError.message)
  ) {
    return { tracks: { items: [] } };
  }

  return lastResult ?? { tracks: { items: [] } };
}

export async function searchCatalog(q: string, limit = 12, market?: string) {
  const query = q.replace(/\s+/g, " ").trim();
  if (query.length < 2) {
    return {
      tracks: { items: [] as SpotifyTrack[] },
      albums: { items: [] as SpotifyAlbum[] },
      playlists: { items: [] as SpotifyPlaylist[] },
    };
  }

  if (!isSpotifyConnected()) {
    return {
      tracks: { items: await searchItunesTracks(query, limit) },
      albums: { items: [] as SpotifyAlbum[] },
      playlists: { items: [] as SpotifyPlaylist[] },
    };
  }

  const normalizedMarket = market?.trim().toUpperCase();
  const validMarket = normalizedMarket && /^[A-Z]{2}$/.test(normalizedMarket)
    ? normalizedMarket
    : null;
  const params = new URLSearchParams({
    type: "track,album,playlist",
    limit: String(Math.min(50, Math.max(1, Math.floor(limit)))),
    q: query,
  });

  if (validMarket) params.set("market", validMarket);

  return spotifyFetch<{
    tracks: { items: SpotifyTrack[] };
    albums: { items: SpotifyAlbum[] };
    playlists: { items: SpotifyPlaylist[] };
  }>(`/search?${params.toString()}`);
}

export const getMyPlaylists = (limit = 12) =>
  spotifyFetch<{ items: SpotifyPlaylist[] }>(`/me/playlists?limit=${limit}`);

export async function getAlbumTracks(albumId: string) {
  const album = await spotifyFetch<SpotifyAlbum & {
    tracks: {
      items: Array<{
        id: string;
        name: string;
        uri: string;
        duration_ms: number;
        preview_url: string | null;
        artists: { name: string }[];
        external_urls?: { spotify?: string };
      }>;
    };
  }>(`/albums/${encodeURIComponent(albumId)}`);

  const tracks: SpotifyTrack[] = (album.tracks?.items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    uri: item.uri,
    duration_ms: item.duration_ms,
    preview_url: item.preview_url,
    artists: item.artists,
    album: { name: album.name, images: album.images.map((image) => ({
      url: image.url,
      width: image.width ?? 0,
      height: image.height ?? 0,
    })) },
    external_urls: item.external_urls,
  }));

  return { album, tracks };
}

export async function getPlaylistTracks(playlistId: string) {
  const playlist = await spotifyFetch<SpotifyPlaylist & {
    tracks: {
      items: Array<{ track: SpotifyTrack | null }>;
    };
  }>(`/playlists/${encodeURIComponent(playlistId)}`);

  const tracks = (playlist.tracks?.items ?? [])
    .map((item) => item.track)
    .filter((track): track is SpotifyTrack => Boolean(track?.id));

  return { playlist, tracks };
}

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
  activateElement?: () => Promise<void>;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  getCurrentState: () => Promise<any>;
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
  const res = await spotifyApiRequest("/me/player", {
    method: "PUT",
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
  if (!res.ok && res.status !== 204) {
    const txt = await res.text();
    throw new Error(`Spotify transfer failed (${res.status}): ${txt}`);
  }
}

export async function playTrackOnDevice(deviceId: string, uri: string) {
  const res = await spotifyApiRequest(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    body: JSON.stringify({ uris: [uri] }),
  });
  if (!res.ok && res.status !== 204) {
    const txt = await res.text();
    throw new Error(`Spotify play failed (${res.status}): ${txt}`);
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function startPlaybackOnDevice(deviceId: string, uri: string) {
  await transferPlayback(deviceId, true);
  await delay(350);

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await playTrackOnDevice(deviceId, uri);
      return;
    } catch (error) {
      lastError = error;
      await delay(350 * (attempt + 1));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Spotify play failed.");
}
