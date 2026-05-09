import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NURA Cosmetics",
    short_name: "NURA",
    description: "Halal beauty with private upload-first virtual try-on.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f3ec",
    theme_color: "#4a1e3a",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icons/apple-touch-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
