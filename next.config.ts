import type { NextConfig } from "next";

const dev = process.env.NODE_ENV === "development";

/**
 * What pages may load: this site, plus the Google Maps embed (Visit page) and Plausible
 * analytics when it's turned on. Everything else, such as an injected script from another
 * site, is blocked. ponytail: inline scripts are allowed because Next.js inlines its startup
 * code; nonces would make every static page render on demand. Revisit if the site grows.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://plausible.io${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  `connect-src 'self' https://plausible.io${dev ? " ws:" : ""}`,
  "frame-src https://www.google.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  // Don't advertise the framework and its version in every response.
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/menu/**", search: "" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/photos/**", search: "" },
    ],
  },
  turbopack: { root: import.meta.dirname },
  // One 404 page for the whole app: the public site and the admin have separate root layouts.
  experimental: { globalNotFound: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No other site may show these pages in a frame (stops click-jacking the admin).
          { key: "Content-Security-Policy", value: csp },
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
