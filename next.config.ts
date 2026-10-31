import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tester le jeu depuis un autre PC du réseau local : Wi-Fi domestique et Tailscale.
  allowedDevOrigins: ["192.168.*.*", "100.*.*.*"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
