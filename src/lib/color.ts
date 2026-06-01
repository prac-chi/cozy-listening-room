// Extract a dominant vibrant color from an image URL using canvas sampling.
// Returns an oklch() string suitable for design tokens, or null.

const cache = new Map<string, string>();

export async function extractAccent(url: string): Promise<string | null> {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url)!;
  if (typeof window === "undefined") return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 40;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // Pick most vibrant pixel (highest saturation * brightness mid-range)
        let best = { r: 120, g: 120, b: 160, score: -1 };
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 200) continue;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const bright = max / 255;
          // favor saturated, not-too-dark, not-too-bright
          const score = sat * 1.6 + (1 - Math.abs(bright - 0.55)) * 0.6;
          if (score > best.score) best = { r, g, b, score };
        }

        const accent = rgbToOklch(best.r, best.g, best.b);
        cache.set(url, accent);
        resolve(accent);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function rgbToOklch(r: number, g: number, b: number): string {
  // sRGB → linear
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const C = Math.sqrt(A * A + Bb * Bb);
  let h = (Math.atan2(Bb, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  // Punch up saturation, normalize lightness for a glowing accent
  const Lout = Math.min(0.82, Math.max(0.6, L * 1.1));
  const Cout = Math.min(0.22, Math.max(0.14, C * 1.4));
  return `oklch(${Lout.toFixed(3)} ${Cout.toFixed(3)} ${h.toFixed(1)})`;
}
