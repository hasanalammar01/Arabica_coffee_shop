import type { Metadata, Viewport } from "next";
import { Readex_Pro, Young_Serif } from "next/font/google";
import Script from "next/script";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { scriptJson } from "@/lib/script-json";
import { site } from "@/data/site";
import "./globals.css";

const display = Young_Serif({ weight: "400", subsets: ["latin"], variable: "--font-young-serif" });
const body = Readex_Pro({ subsets: ["latin"], variable: "--font-readex" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} | Coffee, saj & shisha`, template: `%s | ${site.name}` },
  description: site.description,
  openGraph: { type: "website", siteName: site.name, locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1712" },
  ],
};

const DAY_SCHEMA = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CafeOrCoffeeShop",
  name: site.name,
  url: site.url,
  logo: `${site.url}/logo.svg`,
  image: `${site.url}/opengraph-image`,
  hasMenu: `${site.url}/menu`,
  servesCuisine: ["Coffee", "Lebanese"],
  currenciesAccepted: "LBP",
  address: site.address,
  telephone: site.phone,
  email: site.email,
  sameAs: site.instagram ? [site.instagram] : undefined,
  openingHoursSpecification: site.hours?.map((h) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: h.days.map((d) => DAY_SCHEMA[d]),
    opens: h.open,
    closes: h.close,
  })),
};

const analyticsDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-zaatar px-4 py-3 text-on-zaatar focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptJson(jsonLd) }} />
        {/* Offline support for the menu: the service worker caches pages as they're visited. */}
        {process.env.NODE_ENV === "production" && (
          <Script id="sw" strategy="afterInteractive">
            {`if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");`}
          </Script>
        )}
        {/* Privacy-friendly analytics (no cookies). Off unless NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set. */}
        {analyticsDomain && (
          <Script defer data-domain={analyticsDomain} src="https://plausible.io/js/script.js" />
        )}
      </body>
    </html>
  );
}
