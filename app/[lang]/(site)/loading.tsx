import { lang as rootLang } from "next/root-params";
import { isLang, t } from "@/lib/i18n";

export default async function Loading() {
  const l = await rootLang();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-14 sm:px-6" role="status" aria-label={t(l && isLang(l) ? l : "en").loading}>
      <div className="h-14 w-48 animate-pulse rounded-full bg-surface" />
      <div className="mt-8 h-4 w-72 max-w-full animate-pulse rounded-full bg-surface" />
    </div>
  );
}
