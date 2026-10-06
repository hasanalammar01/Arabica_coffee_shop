import type { Metadata } from "next";
import { mapsIsLink, Visit } from "@/components/Visit";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "Hours & location",
  description: `Opening hours, directions and contact details for ${site.name}.`,
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-14">
      <Visit headingLevel="h1" />
      {/* Shared links (maps.app.goo.gl/…) can't be embedded, only searches can. */}
      {site.mapsQuery && !mapsIsLink && (
        <iframe
          title={`Map showing ${site.name}`}
          src={`https://www.google.com/maps?q=${encodeURIComponent(site.mapsQuery)}&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="mt-14 aspect-[4/3] w-full rounded-card border border-line sm:aspect-[16/7]"
        />
      )}
    </div>
  );
}
