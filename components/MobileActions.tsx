import { getContactActions, isExternal } from "@/lib/contact";
import { t, type Lang } from "@/lib/i18n";
import { getSite } from "@/lib/site";

const ICONS = {
  call: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  whatsapp:
    "M3 21l1.6-4.7A8.5 8.5 0 1 1 7.7 19.5L3 21zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.8-2-1-.9 1a5 5 0 0 1-2.8-2.8l1-.9-1-2-1.8 1z",
  directions:
    "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
};

/**
 * Phones only: a bar at the bottom with one-tap Call / WhatsApp / Directions.
 * Shows only the actions filled in under Shop info, and nothing at all if none are.
 */
export async function MobileActions({ lang }: { lang: Lang }) {
  const contactActions = getContactActions(await getSite());
  const d = t(lang).visit;
  const label = { call: d.call, whatsapp: d.whatsapp, directions: d.directions };
  const actions = contactActions.filter((a) => a.kind in ICONS) as {
    kind: keyof typeof ICONS;
    href: string;
  }[];
  if (!actions.length) return null;
  return (
    <>
      {/* Spacer so the bar never covers the end of the page. */}
      <div className="h-20 sm:hidden print:hidden" aria-hidden />
      <nav
        aria-label={d.title}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden print:hidden"
      >
        <ul className="flex gap-2">
          {actions.map((a) => (
            <li key={a.kind} className="flex-1">
              <a
                href={a.href}
                {...(isExternal(a.href) && { target: "_blank", rel: "noopener noreferrer" })}
                className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-medium text-ink hover:bg-surface"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                >
                  <path d={ICONS[a.kind]} />
                </svg>
                {label[a.kind]}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
