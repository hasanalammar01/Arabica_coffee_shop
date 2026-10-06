import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { formats: ["image/avif", "image/webp"] },
  turbopack: { root: import.meta.dirname },
  // Menu admin (Decap CMS) lives in public/admin/index.html.
  rewrites: async () => [{ source: "/admin", destination: "/admin/index.html" }],
};

export default nextConfig;
