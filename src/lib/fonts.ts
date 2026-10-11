import {
  Archivo,
  Bagel_Fat_One,
  Barlow,
  Big_Shoulders,
  Fredoka,
  Geist,
  Manrope,
  Marcellus,
  Rubik,
  Work_Sans,
  Young_Serif,
  Zen_Maru_Gothic,
} from "next/font/google";

// Self-hosted by next/font. preload: false, so a theme's faces download only when that theme is in use.
// Options must be literals: next/font evaluates them at build time.
const zen = Zen_Maru_Gothic({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "700", "900"], variable: "--ff-zen" });
const fredoka = Fredoka({ subsets: ["latin"], display: "swap", preload: false, variable: "--ff-fredoka" });
const bagel = Bagel_Fat_One({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--ff-bagel" });
const rubik = Rubik({ subsets: ["latin"], display: "swap", preload: false, variable: "--ff-rubik" });
const young = Young_Serif({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--ff-young" });
const work = Work_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--ff-work" });
const shoulders = Big_Shoulders({ subsets: ["latin"], display: "swap", preload: false, variable: "--ff-shoulders" });
const barlow = Barlow({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600", "700"], variable: "--ff-barlow" });
const archivo = Archivo({ subsets: ["latin"], display: "swap", preload: false, axes: ["wdth"], variable: "--ff-archivo" });
const geist = Geist({ subsets: ["latin"], display: "swap", preload: false, variable: "--ff-geist" });
const marcellus = Marcellus({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--ff-marcellus" });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false, variable: "--ff-manrope" });

export const fontVariables = [zen, fredoka, bagel, rubik, young, work, shoulders, barlow, archivo, geist, marcellus, manrope]
  .map((font) => font.variable)
  .join(" ");
