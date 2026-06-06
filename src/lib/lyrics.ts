// Lyrics provider. Tries lrclib.net first (great coverage + synced lyrics),
// falls back to lyrics.ovh for plain lyrics.

export type LyricLine = { time: number | null; text: string };
export type LyricsResult = { lines: LyricLine[]; synced: boolean } | null;

const cache = new Map<string, LyricsResult>();

function cleanTitle(title: string) {
  return title
    .replace(/\s*[\(\[][^)\]]*[\)\]]/g, "")
    .replace(/\s-\s.*$/, "")
    .trim();
}

function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  const lines = lrc.split(/\r?\n/);
  const re = /\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]/g;
  for (const raw of lines) {
    const stamps: number[] = [];
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(raw))) {
      stamps.push(parseInt(m[1], 10) * 60 + parseFloat(m[2]));
    }
    const text = raw.replace(re, "").trim();
    if (!text) continue;
    if (stamps.length === 0) {
      out.push({ time: null, text });
    } else {
      for (const t of stamps) out.push({ time: t, text });
    }
  }
  return out.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
}

async function fromLrclib(artist: string, title: string): Promise<LyricsResult> {
  try {
    const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
    const res = await fetch(url);
    if (!res.ok) {
      // Fallback to search endpoint
      const s = await fetch(
        `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`,
      );
      if (!s.ok) return null;
      const arr: any[] = await s.json();
      const hit = arr?.[0];
      if (!hit) return null;
      if (hit.syncedLyrics) return { lines: parseLrc(hit.syncedLyrics), synced: true };
      if (hit.plainLyrics) {
        return {
          lines: hit.plainLyrics
            .split(/\r?\n/)
            .map((l: string) => l.trim())
            .filter((l: string) => l.length)
            .map((text: string) => ({ time: null, text })),
          synced: false,
        };
      }
      return null;
    }
    const data: { syncedLyrics?: string; plainLyrics?: string } = await res.json();
    if (data.syncedLyrics) return { lines: parseLrc(data.syncedLyrics), synced: true };
    if (data.plainLyrics) {
      return {
        lines: data.plainLyrics
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length)
          .map((text) => ({ time: null, text })),
        synced: false,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function fromLyricsOvh(artist: string, title: string): Promise<LyricsResult> {
  try {
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
    );
    if (!res.ok) return null;
    const data: { lyrics?: string } = await res.json();
    if (!data.lyrics) return null;
    const lines = data.lyrics
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^\[.*\]$/.test(l))
      .map((text) => ({ time: null as number | null, text }));
    return lines.length ? { lines, synced: false } : null;
  } catch {
    return null;
  }
}

export async function fetchLyrics(artist: string, title: string): Promise<LyricsResult> {
  const key = `${artist}::${title}`.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const ct = cleanTitle(title);
  const primary = artist.split(",")[0].trim();

  let result =
    (await fromLrclib(primary, ct)) ||
    (await fromLrclib(artist, title)) ||
    (await fromLyricsOvh(primary, ct)) ||
    (await fromLyricsOvh(artist, title));

  cache.set(key, result);
  return result;
}
