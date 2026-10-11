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
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
