import albumMain from "@/assets/album-main.jpg";
import album1 from "@/assets/album-1.jpg";
import album2 from "@/assets/album-2.jpg";
import album3 from "@/assets/album-3.jpg";
import album4 from "@/assets/album-4.jpg";
import type { LyricLine } from "@/lib/lyrics";

export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  art: string;
  duration: number; // seconds
  uri?: string;
  externalUrl?: string;
  /** oklch lightness/chroma/hue for the room accent */
  accent: string; // valid CSS color (oklch)
  lyrics: LyricLine[];
  previewUrl?: string | null;
};

const toLines = (arr: string[]): LyricLine[] => arr.map((text) => ({ time: null, text }));

export const TRACKS: Track[] = [
  {
    id: "ginza",
    title: "Midnight in Ginza",
    artist: "Hiroshi Matsui",
    album: "Transient Summers",
    art: albumMain,
    duration: 264,
    accent: "oklch(0.82 0.17 35)", // amber
    lyrics: toLines([
      "Streetlights paint the road in honey gold",
      "The city lights reflecting on the dashboard",
      "Watching the neon signs drift slowly by",
      "Somewhere a saxophone is missing you",
      "Tonight the rain remembers every name",
    ]),
  },
  {
    id: "sunsets",
    title: "Sunsets & Cigarettes",
    artist: "Aiko Mori",
    album: "Pink Hour",
    art: album1,
    duration: 211,
    accent: "oklch(0.78 0.18 10)", // rose
    lyrics: toLines([
      "Smoke curls like a question into the dusk",
      "You said love was a slow burning thing",
      "I'm learning how to let the evening stay",
      "Pink skies forgive the things we said",
    ]),
  },
  {
    id: "urban",
    title: "Urban Melancholy",
    artist: "Tomoko Aran",
    album: "Last Train Home",
    art: album2,
    duration: 248,
    accent: "oklch(0.72 0.18 280)", // indigo
    lyrics: toLines([
      "Carriage lights flicker on the windowpane",
      "The city sleeps in shades of indigo",
      "I count the stations like a lullaby",
      "Somewhere between the stops, I disappear",
    ]),
  },
  {
    id: "deepsea",
    title: "Deep Sea Jazz",
    artist: "Hiroshi Sato",
    album: "Submarine Sessions",
    art: album3,
    duration: 305,
    accent: "oklch(0.7 0.18 235)", // ocean blue
    lyrics: toLines([
      "Bass notes drifting through the deep blue",
      "Trumpets singing where the daylight ends",
      "We sink like a slow, perfect chord",
      "And the tide hums in seven flats",
    ]),
  },
  {
    id: "plastic",
    title: "Plastic Summer",
    artist: "Mariya Takeuchi",
    album: "City Pop Forever",
    art: album4,
    duration: 232,
    accent: "oklch(0.8 0.18 55)", // orange
    lyrics: toLines([
      "Cassette tapes spinning in the August heat",
      "Palm trees swaying to a synth refrain",
      "We're plastic dreaming in a neon haze",
      "Summer ends but the song plays on",
    ]),
  },
];
