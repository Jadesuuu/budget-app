import { z } from "zod";
import { HIDE_ATTR, HIDE_COOKIE } from "./privacy";

export const THEME_IDS = ["sakura", "strawberry", "bubblegum", "barako", "courtside", "denim", "mono", "coal"] as const;
export const MODES = ["light", "dark", "system"] as const;

export const themeIdSchema = z.enum(THEME_IDS);
export const modeSchema = z.enum(MODES);
export type ThemeId = z.infer<typeof themeIdSchema>;
export type Mode = z.infer<typeof modeSchema>;

export const DEFAULT_THEME: ThemeId = "sakura";
export const DEFAULT_MODE: Mode = "system";

/** Non-HttpOnly so the pre-paint script can read them; they only hold display preferences. */
export const THEME_COOKIE = "bp-theme";
export const MODE_COOKIE = "bp-mode";

export const THEMES: ReadonlyArray<{ id: ThemeId; name: string; feel: string }> = [
  { id: "sakura", name: "Sakura", feel: "Blush and plum, petal-cut corners" },
  { id: "strawberry", name: "Strawberry Milk", feel: "Pink milk, chunky carton cards" },
  { id: "bubblegum", name: "Bubblegum Pop", feel: "Hot pink and mint, sticker tiles" },
  { id: "barako", name: "Barako", feel: "Espresso and kraft, rubber-stamp dates" },
  { id: "courtside", name: "Courtside", feel: "Hardwood orange, scoreboard digits" },
  { id: "denim", name: "Denim", feel: "Indigo with stitched seams" },
  { id: "mono", name: "Monochrome", feel: "Black and white, nothing else" },
  { id: "coal", name: "Coal & Brass", feel: "Charcoal with brass nameplates" },
];

/**
 * Runs in <head> before first paint: applies the saved theme/mode from cookies so there is
 * no flash of the default theme, and follows the OS setting when mode is "system".
 */
export const themeBootScript = `(function(){try{var d=document.documentElement,ids=${JSON.stringify(THEME_IDS)};
function read(n){var m=document.cookie.match(new RegExp("(?:^|; )"+n+"=([a-z]+)"));return m?m[1]:null}
var t=read("${THEME_COOKIE}"),p=read("${MODE_COOKIE}");if(ids.indexOf(t)<0)t="${DEFAULT_THEME}";if(p!=="light"&&p!=="dark")p="system";
var mq=window.matchMedia("(prefers-color-scheme: dark)");
d.dataset.theme=t;d.dataset.modePref=p;d.dataset.mode=p==="system"?(mq.matches?"dark":"light"):p;
if(read("${HIDE_COOKIE}")==="on")d.setAttribute("${HIDE_ATTR}","");
mq.addEventListener("change",function(){if(d.dataset.modePref==="system")d.dataset.mode=mq.matches?"dark":"light"});
}catch(e){}})();`;

/** Client-side counterpart of the boot script, used when the user changes appearance. */
export function applyAppearance(theme: ThemeId, mode: Mode) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.modePref = mode;
  root.dataset.mode =
    mode === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode;
}
