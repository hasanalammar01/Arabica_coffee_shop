"use client";

import { useRef, useState } from "react";
import { currency, type MenuItem } from "@/data/menu";
import { formatAmount } from "@/lib/format";
import { pick, t, type Lang } from "@/lib/i18n";
import { MAX_QTY, needsChoices, priceLine, type CartLine } from "@/lib/orders-core";
import { cart, type OrderingConfig } from "./cart";

/** The round + button next to an item. Items with sizes or choices open a small sheet first. */
export function AddToCart({ item, lang, ordering }: { item: MenuItem; lang: Lang; ordering: OrderingConfig | null }) {
  const d = t(lang).order;
  const dialog = useRef<HTMLDialogElement>(null);
  const [added, setAdded] = useState(false);
  if (!ordering?.enabled || item.availability !== "available") return null;
  const name = pick(lang, item.name, item.nameAr);

  const confirmAdded = () => {
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };
  const onClick = () => {
    if (needsChoices(item)) return dialog.current?.showModal();
    cart.add({ id: item.id, size: item.prices[0][0], option: "", mods: [], qty: 1 });
    confirmAdded();
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label={added ? d.added : d.add(name)}
        className="add-button relative z-20 grid size-11 shrink-0 place-items-center rounded-full bg-espresso text-on-espresso shadow-lift transition-transform active:scale-90 print:hidden"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d={added ? "m5 12 4 4L19 6" : "M12 5v14M5 12h14"} />
        </svg>
      </button>
      {needsChoices(item) && (
        <dialog
          ref={dialog}
          aria-label={name}
          className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card bg-paper p-0 text-ink shadow-lift backdrop:bg-ink/50"
          onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        >
          <ChoiceSheet
            item={item}
            lang={lang}
            onClose={() => dialog.current?.close()}
            onAdd={(line) => {
              cart.add(line);
              dialog.current?.close();
              confirmAdded();
            }}
          />
        </dialog>
      )}
    </>
  );
}

function ChoiceSheet({
  item,
  lang,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  lang: Lang;
  onClose: () => void;
  onAdd: (line: CartLine) => void;
}) {
  const d = t(lang).order;
  const [size, setSize] = useState(item.prices[0][0]);
  const [option, setOption] = useState("");
  const [mods, setMods] = useState<string[]>(() =>
    // Pre-pick the first choice of required single-choice groups (e.g. "Milk: Full").
    (item.modifiers ?? []).filter((g) => g.min === 1 && g.max === 1).map((g) => `${g.id}/${g.choices[0].id}`),
  );
  const [qty, setQty] = useState(1);
  const line: CartLine = { id: item.id, size, option, mods, qty };
  const priced = priceLine(new Map([[item.id, item]]), line);
  const label = lang === "ar" ? currency.labelAr : currency.label;

  const toggle = (groupId: string, key: string, single: boolean) =>
    setMods((m) => {
      const others = m.filter((k) => !k.startsWith(`${groupId}/`));
      if (single) return [...others, key];
      return m.includes(key) ? m.filter((k) => k !== key) : [...m, key];
    });

  const legend = "mb-2 font-medium";
  const choice =
    "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-3 has-checked:border-espresso has-disabled:opacity-50";

  return (
    <form
      method="dialog"
      className="max-h-[85dvh] overflow-y-auto p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (priced) onAdd(line);
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="font-display text-2xl">{pick(lang, item.name, item.nameAr)}</h2>
        <button type="button" onClick={onClose} aria-label={d.close} className="-m-2 grid size-11 place-items-center rounded-full">
          <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div className="space-y-5">
        {item.prices.length > 1 && (
          <fieldset>
            <legend className={legend}>{d.size}</legend>
            <div className="grid gap-2">
              {item.prices.map(([s, price], i) => (
                <label key={s} className={choice}>
                  <input type="radio" name="size" checked={size === s} onChange={() => setSize(s)} className="accent-espresso" />
                  <span className="flex-1">{lang === "ar" && item.sizesAr?.[i] ? item.sizesAr[i] : s}</span>
                  <span className="text-sm text-muted tabular-nums" dir="ltr">
                    {formatAmount(price)} {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {item.options?.length ? (
          <fieldset>
            <legend className={legend}>
              {d.flavour} <span className="text-sm font-normal text-muted">· {d.pickOne}</span>
            </legend>
            <div className="grid gap-2">
              {item.options.map((o, i) => (
                <label key={o} className={choice}>
                  <input type="radio" name="option" required checked={option === o} onChange={() => setOption(o)} className="accent-espresso" />
                  <span>{pick(lang, o, item.optionsAr?.[i])}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {item.modifiers?.map((g) => {
          const single = g.max === 1;
          const picked = mods.filter((k) => k.startsWith(`${g.id}/`)).length;
          return (
            <fieldset key={g.id}>
              <legend className={legend}>
                {pick(lang, g.name, g.nameAr)}{" "}
                <span className="text-sm font-normal text-muted">· {single ? d.pickOne : d.upTo(g.max)}</span>
              </legend>
              <div className="grid gap-2">
                {g.choices.map((c) => {
                  const key = `${g.id}/${c.id}`;
                  const on = mods.includes(key);
                  return (
                    <label key={key} className={choice}>
                      <input
                        type={single ? "radio" : "checkbox"}
                        name={g.id}
                        checked={on}
                        disabled={!single && !on && picked >= g.max}
                        onChange={() => toggle(g.id, key, single)}
                        className="accent-espresso"
                      />
                      <span className="flex-1">{pick(lang, c.name, c.nameAr)}</span>
                      {c.price > 0 && (
                        <span className="text-sm text-muted tabular-nums" dir="ltr">
                          +{formatAmount(c.price)} {label}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <div className="flex items-center justify-between">
          <span className="font-medium">{d.quantity}</span>
          <Stepper qty={qty} setQty={setQty} lang={lang} />
        </div>
      </div>

      <button
        type="submit"
        // A missing flavour stays clickable so the browser's "required" prompt points at it.
        disabled={!priced && !(item.options?.length && !option)}
        className="mt-6 flex min-h-12 w-full items-center justify-between gap-3 rounded-full bg-espresso px-6 font-medium text-on-espresso disabled:opacity-50"
      >
        <span>{d.addToOrder}</span>
        {priced && (
          <span className="tabular-nums" dir="ltr">
            {formatAmount(priced.total)} {label}
          </span>
        )}
      </button>
    </form>
  );
}

/** − 2 + */
export function Stepper({ qty, setQty, lang, min = 1 }: { qty: number; setQty: (n: number) => void; lang: Lang; min?: number }) {
  const d = t(lang).order;
  const button = "grid size-11 place-items-center rounded-full border border-line bg-surface text-lg disabled:opacity-40";
  return (
    <span className="flex items-center gap-2">
      <button type="button" className={button} onClick={() => setQty(qty - 1)} disabled={qty <= min} aria-label={d.fewer}>
        −
      </button>
      <span className="w-6 text-center tabular-nums" aria-live="polite">
        {qty}
      </span>
      <button type="button" className={button} onClick={() => setQty(qty + 1)} disabled={qty >= MAX_QTY} aria-label={d.more}>
        +
      </button>
    </span>
  );
}
