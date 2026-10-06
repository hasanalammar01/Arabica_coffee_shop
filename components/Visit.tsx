import { site } from "@/data/site";
import { formatDays, formatTime } from "@/lib/hours";
import { OpenStatus } from "./OpenStatus";

export const mapsLink = site.mapsQuery
  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.mapsQuery)}`
  : undefined;

const digits = (n: string) => n.replace(/[^\d]/g, "");

/** Contact actions; only the ones filled in data/site.ts are shown. */
const ACTIONS = [
  site.phone && { href: `tel:${site.phone}`, label: "Call us" },
  site.whatsapp && { href: `https://wa.me/${digits(site.whatsapp)}`, label: "WhatsApp" },
  mapsLink && { href: mapsLink, label: "Get directions" },
  site.instagram && { href: site.instagram, label: "Instagram" },
  site.email && { href: `mailto:${site.email}`, label: "Email" },
].filter((a): a is { href: string; label: string } => Boolean(a));

export function HoursTable() {
  if (!site.hours?.length) return <p className="text-muted">Opening hours coming soon.</p>;
  return (
    <dl className="divide-y divide-line border-y border-line">
      {site.hours.map((h) => (
        <div key={h.days.join()} className="flex justify-between gap-4 py-3">
          <dt>{formatDays(h.days)}</dt>
          <dd className="text-right tabular-nums">
            {formatTime(h.open)} – {formatTime(h.close)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ContactActions() {
  if (!ACTIONS.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {ACTIONS.map((a, i) => (
        <li key={a.label}>
          <a
            href={a.href}
            {...(a.href.startsWith("http") && { target: "_blank", rel: "noopener noreferrer" })}
            className={`inline-flex min-h-11 items-center rounded-full px-5 font-medium transition-colors ${
              i === 0 ? "bg-zaatar text-on-zaatar hover:bg-ink" : "border border-line hover:border-ink"
            }`}
          >
            {a.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Visit({ headingLevel: H = "h2" }: { headingLevel?: "h1" | "h2" }) {
  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-16">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <H className="font-display text-title">Hours</H>
          <OpenStatus />
        </div>
        <div className="mt-6">
          <HoursTable />
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <h2 className="font-display text-title">Find us</h2>
        <address className="text-lg text-muted not-italic">{site.address ?? "Address coming soon."}</address>
        <ContactActions />
      </div>
    </div>
  );
}
