import { getContactActions, isExternal } from "@/lib/contact";
import { formatDays, formatTime } from "@/lib/hours";
import { pick, t, type Lang } from "@/lib/i18n";
import { getSite } from "@/lib/site";
import { OpenStatus } from "./OpenStatus";
import { SpecialHoursNotice } from "./SpecialHoursNotice";

export async function HoursTable({ lang }: { lang: Lang }) {
  const site = await getSite();
  if (!site.hours.length) return <p className="text-muted">{t(lang).visit.hoursSoon}</p>;
  return (
    <dl className="divide-y divide-line border-y border-line">
      {site.hours.map((h) => (
        <div key={h.days.join()} className="flex justify-between gap-4 py-3">
          <dt>{formatDays(h.days, lang)}</dt>
          <dd className="text-end tabular-nums">
            {formatTime(h.open, lang)} – {formatTime(h.close, lang)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export async function ContactActions({ lang }: { lang: Lang }) {
  const contactActions = getContactActions(await getSite());
  if (!contactActions.length) return null;
  const d = t(lang).visit;
  const label = { call: d.call, whatsapp: d.whatsapp, directions: d.directions, instagram: d.instagram, email: d.email };
  return (
    <ul className="flex flex-wrap gap-2">
      {contactActions.map((a, i) => (
        <li key={a.kind}>
          <a
            href={a.href}
            {...(isExternal(a.href) && { target: "_blank", rel: "noopener noreferrer" })}
            className={`inline-flex min-h-11 items-center rounded-full px-5 font-medium transition-colors ${
              i === 0 ? "bg-espresso text-on-espresso hover:bg-ink" : "border border-line hover:border-ink"
            }`}
          >
            {label[a.kind]}
          </a>
        </li>
      ))}
    </ul>
  );
}

export async function Visit({ lang, headingLevel: H = "h2" }: { lang: Lang; headingLevel?: "h1" | "h2" }) {
  const site = await getSite();
  const contactActions = getContactActions(site);
  const d = t(lang).visit;
  const address = pick(lang, site.address ?? "", site.addressAr);
  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-16">
      <div className="reveal">
        <div className="flex flex-wrap items-center gap-3">
          <H className="font-display text-title">{d.hours}</H>
          <OpenStatus lang={lang} hours={site.hours} specialHours={site.specialHours} timeZone={site.timeZone} />
        </div>
        <SpecialHoursNotice lang={lang} specialHours={site.specialHours} timeZone={site.timeZone} />
        <div className="mt-6">
          <HoursTable lang={lang} />
        </div>
      </div>
      <div className="reveal flex flex-col gap-5">
        <h2 className="font-display text-title">{d.findUs}</h2>
        {address && <address className="text-lg whitespace-pre-line text-muted not-italic">{address}</address>}
        {/* Nothing to show yet: one honest line instead of empty headings. */}
        {!address && !contactActions.length && <p className="text-lg text-muted">{d.contactSoon}</p>}
        <ContactActions lang={lang} />
      </div>
    </div>
  );
}
