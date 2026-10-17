import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { formats: ["image/avif", "image/webp"] },
  turbopack: { root: import.meta.dirname },
  // One 404 page for the whole app: the public site and the admin have separate root layouts.
  experimental: { globalNotFound: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No other site may show these pages in a frame (stops click-jacking the admin).
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Location only for the delivery pin; nothing else.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
        ],
      },
      {
        // Search engines never list the admin. (Its data comes from /api/admin, sent with no-store.)
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
