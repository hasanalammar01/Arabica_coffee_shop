import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { site } from "@/data/site";
import { dir, href, isLang, LANGS, pick, t, type Lang } from "@/lib/i18n";
import { scriptJson } from "@/lib/script-json";
import { fontVars } from "../fonts";
import "../globals.css";


export const dynamicParams = false;
export const generateStaticParams = () => LANGS.map((lang) => ({ lang }));

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : "en") as Lang;
  const name = pick(l, site.name, site.nameAr);
  return {
    metadataBase: new URL(site.url),
    title: {
      default: l === "ar" ? `${name} | قهوة، صاج وأراكيل` : `${name} | Coffee, saj & shisha`,
      template: `%s | ${name}`,
    },
    description: pick(l, site.description, site.descriptionAr),
    openGraph: { type: "website", siteName: name, locale: l === "ar" ? "ar_LB" : "en_US" },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f0e7" },
    { media: "(prefers-color-scheme: dark)", color: "#17110d" },
  ],
};

const DAY_SCHEMA = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const analyticsDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const d = t(lang);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    name: pick(lang, site.name, site.nameAr),
    url: `${site.url}${href(lang, "/")}`,
    logo: `${site.url}/logo.svg`,
    image: `${site.url}/opengraph-image`,
    hasMenu: `${site.url}${href(lang, "/menu")}`,
    servesCuisine: ["Coffee", "Lebanese"],
    currenciesAccepted: "LBP",
    address: pick(lang, site.address ?? "", site.addressAr) || undefined,
    telephone: site.phone,
    email: site.email,
    sameAs: site.instagram ? [site.instagram] : undefined,
    openingHoursSpecification: [
      ...site.hours.map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: h.days.map((n) => DAY_SCHEMA[n]),
        opens: h.open,
        closes: h.close,
      })),
      // Holiday closures and special hours, so search engines show them too.
      ...site.specialHours.map((s) => ({
        "@type": "OpeningHoursSpecification",
        validFrom: s.from,
        validThrough: s.to || s.from,
        opens: s.closed ? "00:00" : s.open,
        closes: s.closed ? "00:00" : s.close,
      })),
    ],
  };

  return (
    <html
      lang={lang}
      dir={dir(lang)}
      className={fontVars}
    >
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-espresso px-4 py-3 text-on-espresso focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
        >
          {d.skip}
        </a>
        {children}
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
