// Free public lyrics service (lyrics.ovh). No API key required.
// Returns an array of trimmed non-empty lines, or null if not found.

const cache = new Map<string, string[] | null>();

export async function fetchLyrics(artist: string, title: string): Promise<string[] | null> {
  const key = `${artist}::${title}`.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  // Strip "(feat. …)" / "- Remastered" style suffixes that confuse the lookup
  const cleanTitle = title
    .replace(/\s*[\(\[][^)\]]*[\)\]]/g, "")
    .replace(/\s-\s.*$/, "")
    .trim();
  const primaryArtist = artist.split(",")[0].trim();

  try {
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(primaryArtist)}/${encodeURIComponent(cleanTitle)}`,
    );
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data: { lyrics?: string } = await res.json();
    if (!data.lyrics) {
      cache.set(key, null);
      return null;
    }
    const lines = data.lyrics
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^\[.*\]$/.test(l));
    const result = lines.length ? lines : null;
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
}
