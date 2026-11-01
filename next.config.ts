import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a production build sit next to a running dev server (NEXT_DIST_DIR=.next-prod).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // jsPDF pulls optional browser-only deps; keep it out of the server bundle graph.
  serverExternalPackages: ["jspdf", "jspdf-autotable"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Microphone is needed by the worker portal on our own origin only.
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
