import { loadFont as loadPlexSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as loadPlexMono } from "@remotion/google-fonts/IBMPlexMono";

const { fontFamily: plexSans } = loadPlexSans("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
});

const { fontFamily: plexMono } = loadPlexMono("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

export const FONT_SANS = plexSans;
export const FONT_MONO = plexMono;
