import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { formats: ["image/avif", "image/webp"] },
  turbopack: { root: import.meta.dirname },
  // One 404 page for the whole app: the public site and the admin have separate root layouts.
  experimental: { globalNotFound: true },
};

export default nextConfig;
