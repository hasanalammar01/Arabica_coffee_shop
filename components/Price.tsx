import { currency, type MenuItem } from "@/data/menu";
import { formatAmount } from "@/lib/format";
import type { Lang } from "@/lib/i18n";

/** A single price, or one per size: "Small 300,000 · Large 400,000". */
export function Price({
  prices,
  sizesAr,
  lang = "en",
  className = "",
}: {
  prices: MenuItem["prices"];
  sizesAr?: string[];
  lang?: Lang;
  className?: string;
}) {
  return (
    <span className={`whitespace-nowrap tabular-nums ${className}`}>
      {prices.map(([size, amount], i) => {
        const label = lang === "ar" && sizesAr?.[i] ? sizesAr[i] : size;
        return (
          <span key={size || "price"}>
            {i > 0 && <span aria-hidden> · </span>}
            {label && <span className="text-muted">{label} </span>}
            <span dir="ltr">{formatAmount(amount)}</span>
            <span className="ms-1 text-[0.75em] tracking-wide text-muted">
              {lang === "ar" ? currency.labelAr : currency.label}
            </span>
          </span>
        );
      })}
    </span>
  );
}
