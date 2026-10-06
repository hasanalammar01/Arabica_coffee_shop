import type { MenuItem } from "@/data/menu";
import { currencyLabel, formatAmount } from "@/lib/format";

/** A single price, or one line per size: "Small 300,000 · Large 400,000". */
export function Price({ prices, className = "" }: { prices: MenuItem["prices"]; className?: string }) {
  return (
    <span className={`whitespace-nowrap tabular-nums ${className}`}>
      {prices.map(([size, amount], i) => (
        <span key={size || "price"}>
          {i > 0 && <span aria-hidden> · </span>}
          {size && <span className="text-muted">{size} </span>}
          {formatAmount(amount)}
          <span className="ml-1 text-[0.75em] tracking-wide text-muted">{currencyLabel}</span>
        </span>
      ))}
    </span>
  );
}
