"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { currency, type MenuCategory, type MenuItem } from "@/data/menu";
import { formatAmount } from "@/lib/format";
import { href, pick, t, type Lang } from "@/lib/i18n";
import { menuItems, priceLine, type OrderError, type OrderLine } from "@/lib/orders-core";
import { Stepper } from "./AddToCart";
import { cart, useCart, useOrdering } from "./cart";

type Placed = { id: number; total: number; payment: string };

export function Checkout({ menu, lang }: { menu: MenuCategory[]; lang: Lang }) {
  const d = t(lang).order;
  const ordering = useOrdering();
  const lines = useCart();
  const items = useMemo(() => menuItems(menu), [menu]);
  const priced = lines.map((l) => priceLine(items, l));
  const total = priced.reduce((n, l) => n + (l?.total ?? 0), 0);
  const money = (n: number) => `${formatAmount(n)} ${lang === "ar" ? currency.labelAr : currency.label}`;

  const [fulfilment, setFulfilment] = useState<"delivery" | "pickup">("delivery");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, hidden from people
  const [payment, setPayment] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<"idle" | "busy" | "failed">("idle");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState<Placed | null>(null);

  const payments = ordering?.payments ?? [];
  const chosen = payments.find((p) => p.id === payment) ?? payments[0];

  const locate = () => {
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating("idle");
      },
      () => setLocating("failed"),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosen) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang,
          lines: lines.filter((_, i) => priced[i]),
          name,
          phone,
          fulfilment,
          address,
          note,
          location,
          payment: chosen.id,
          website,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: number; total?: number; error?: OrderError };
      if (!res.ok || !body.id) {
        setError(d.errors[body.error ?? "invalid"]);
        return;
      }
      setPlaced({ id: body.id, total: body.total ?? total, payment: chosen.id });
      cart.clear();
      scrollTo({ top: 0, behavior: "instant" });
    } catch {
      setError(d.errors.network);
    } finally {
      setSending(false);
    }
  };

  const page = "mx-auto max-w-2xl px-4 pt-8 pb-16 sm:px-6 sm:pt-14";
  const back = (
    <Link href={href(lang, "/menu")} className="mt-6 inline-flex min-h-11 items-center rounded-full bg-espresso px-6 font-medium text-on-espresso">
      {d.backToMenu}
    </Link>
  );

  if (placed) {
    const method = payments.find((p) => p.id === placed.payment);
    const instructions = method && pick(lang, method.details, method.detailsAr);
    return (
      <div className={page} role="status">
        <p className="font-display text-hero">{d.thanks}</p>
        <h1 className="mt-4 text-2xl font-medium">{d.received(placed.id)}</h1>
        <p className="mt-2 text-lg tabular-nums">
          {d.total}: <span dir="ltr">{money(placed.total)}</span>
        </p>
        {method && (
          <div className="mt-6 rounded-card border border-line bg-surface p-5">
            <p className="font-medium">{pick(lang, method.name, method.nameAr)}</p>
            {instructions && <p className="mt-1 whitespace-pre-line text-muted">{instructions}</p>}
          </div>
        )}
        <p className="mt-6 text-muted">{d.callYou}</p>
        {back}
      </div>
    );
  }

  if (!ordering) return <p className={`${page} text-muted`}>{t(lang).loading}…</p>;

  if (!ordering.enabled)
    return (
      <div className={page}>
        <h1 className="font-display text-hero">{d.title}</h1>
        <p className="mt-4 text-lg text-muted">{d.off}</p>
        {back}
      </div>
    );

  if (!lines.length)
    return (
      <div className={page}>
        <h1 className="font-display text-hero">{d.title}</h1>
        <p className="mt-4 text-lg text-muted">{d.empty}</p>
        {back}
      </div>
    );

  const input =
    "mt-1.5 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base placeholder:text-muted focus:border-ink";
  const section = "mt-8 border-t border-line pt-6";
  const segment =
    "flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-full px-4 text-center has-checked:bg-espresso has-checked:text-on-espresso has-focus-visible:outline-2";

  return (
    <form className={page} onSubmit={submit}>
      <h1 className="font-display text-hero">{d.title}</h1>
      <p className="mt-2 text-muted">{d.description}</p>
      {!ordering.open && (
        <p className="mt-6 rounded-xl bg-pomegranate/12 px-4 py-3 text-pomegranate" role="alert">
          {d.closed}
        </p>
      )}

      <ul className="mt-6 divide-y divide-line">
        {lines.map((l, i) => (
          <CartRow
            key={i}
            line={priced[i]}
            item={items.get(l.id)}
            fallbackName={l.id}
            qty={l.qty}
            lang={lang}
            money={money}
            setQty={(q) => cart.setQty(i, q)}
          />
        ))}
      </ul>
      <p className="mt-4 flex items-baseline justify-between border-t-2 border-ink pt-4 text-lg font-medium">
        <span>{d.total}</span>
        <span className="tabular-nums" dir="ltr">
          {money(total)}
        </span>
      </p>

      <fieldset className={section}>
        <legend className="text-lg font-medium">{d.how}</legend>
        <div className="mt-3 flex gap-1 rounded-full border border-line bg-surface p-1">
          {(["delivery", "pickup"] as const).map((f) => (
            <label key={f} className={segment}>
              <input type="radio" name="fulfilment" className="sr-only" checked={fulfilment === f} onChange={() => setFulfilment(f)} />
              {f === "delivery" ? d.delivery : d.pickup}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={section}>
        <legend className="text-lg font-medium">{d.details}</legend>
        <div className="mt-3 grid gap-4">
          <label>
            {d.name}
            <input className={input} required minLength={2} maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            {d.phone}
            <input
              className={input}
              type="tel"
              dir="ltr"
              required
              pattern="\+?[0-9 \(\)\-]{7,20}"
              autoComplete="tel"
              placeholder="+961 …"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          {fulfilment === "delivery" && (
            <>
              <label>
                {d.address}
                <textarea
                  className={input}
                  required
                  minLength={5}
                  maxLength={300}
                  rows={2}
                  autoComplete="street-address"
                  placeholder={d.addressHint}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
              <div>
                <button
                  type="button"
                  onClick={locate}
                  disabled={locating === "busy"}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 font-medium disabled:opacity-60"
                >
                  <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
                    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
                  </svg>
                  {locating === "busy" ? d.locating : location ? d.located : d.useLocation}
                </button>
                {locating === "failed" && <p className="mt-2 text-sm text-pomegranate">{d.locationFailed}</p>}
              </div>
            </>
          )}
          <label>
            {d.note}
            <textarea className={input} maxLength={300} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {/* Honeypot: hidden from people and screen readers; bots that fill it are ignored. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="hidden"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className={section}>
        <legend className="text-lg font-medium">{d.payment}</legend>
        <div className="mt-3 grid gap-2">
          {payments.map((p) => {
            const details = pick(lang, p.details, p.detailsAr);
            return (
              <label key={p.id} className="flex cursor-pointer gap-3 rounded-xl border border-line bg-surface p-4 has-checked:border-espresso">
                <input type="radio" name="payment" className="mt-1 accent-espresso" checked={chosen?.id === p.id} onChange={() => setPayment(p.id)} />
                <span>
                  <span className="font-medium">{pick(lang, p.name, p.nameAr)}</span>
                  {details && chosen?.id === p.id && <span className="mt-1 block whitespace-pre-line text-sm text-muted">{details}</span>}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p className="mt-6 rounded-xl bg-pomegranate/12 px-4 py-3 text-pomegranate" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending || !ordering.open || !chosen || !priced.some(Boolean)}
        className="mt-8 flex min-h-14 w-full items-center justify-between gap-3 rounded-full bg-espresso px-6 text-lg font-medium text-on-espresso disabled:opacity-50"
      >
        <span>{sending ? d.placing : d.place}</span>
        <span className="tabular-nums" dir="ltr">
          {money(total)}
        </span>
      </button>
    </form>
  );
}

function CartRow({
  line,
  item,
  fallbackName,
  qty,
  lang,
  money,
  setQty,
}: {
  line: OrderLine | null;
  item: MenuItem | undefined;
  fallbackName: string;
  qty: number;
  lang: Lang;
  money: (n: number) => string;
  setQty: (n: number) => void;
}) {
  const d = t(lang).order;
  if (!line)
    return (
      <li className="flex items-center justify-between gap-4 py-4">
        <span>
          <span className="text-muted line-through">{fallbackName}</span>
          <span className="block text-sm text-pomegranate">{d.unavailable}</span>
        </span>
        <button type="button" onClick={() => setQty(0)} className="min-h-11 rounded-full border border-line px-4">
          {d.remove}
        </button>
      </li>
    );
  // The cart stores English names; show the Arabic ones on the Arabic page.
  const size = item?.prices.findIndex(([s]) => s === line.size) ?? -1;
  const option = item?.options?.indexOf(line.option) ?? -1;
  const choices = [
    pick(lang, line.size, item?.sizesAr?.[size]),
    pick(lang, line.option, item?.optionsAr?.[option]),
    ...line.mods.map((m) => pick(lang, m.name, m.nameAr)),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4">
      <span className="min-w-0 flex-1">
        <span className="font-medium">{pick(lang, line.name, line.nameAr)}</span>
        {choices && <span className="block text-sm text-muted">{choices}</span>}
        <span className="block text-sm tabular-nums" dir="ltr">
          {money(line.total)}
        </span>
      </span>
      <span className="flex items-center gap-2">
        {qty === 1 && (
          <button type="button" onClick={() => setQty(0)} className="min-h-11 px-2 text-sm text-muted underline">
            {d.remove}
          </button>
        )}
        <Stepper qty={qty} setQty={setQty} lang={lang} />
      </span>
    </li>
  );
}
