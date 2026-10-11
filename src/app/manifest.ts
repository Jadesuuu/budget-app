import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Budget",
    short_name: "Budget",
    description: "Review the transactions your bank emails already told you about.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF4F7",
    theme_color: "#C2306A",
    // Source: design/icon/ (the review stack, petal-cut cards, peso sign). Maskable = full bleed for Android's shapes.
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
