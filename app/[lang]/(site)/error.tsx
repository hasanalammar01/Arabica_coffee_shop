"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { href, isLang, t } from "@/lib/i18n";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const { lang: l } = useParams<{ lang: string }>();
  const lang = isLang(l) ? l : "en";
  const d = t(lang);
  return (
    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6" role="alert">
      <h1 className="font-display text-title">{d.error.title}</h1>
      <p className="mt-4 text-lg text-muted">{d.error.body}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-12 rounded-full bg-espresso px-6 font-medium text-on-espresso"
        >
          {d.error.retry}
        </button>
        <Link
          href={href(lang, "/menu")}
          className="inline-flex min-h-12 items-center rounded-full border border-line px-6 font-medium"
        >
          {d.notFound.toMenu}
        </Link>
      </div>
    </div>
  );
}
