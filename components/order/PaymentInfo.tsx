"use client";

import { useState } from "react";
import { pick, t, type Lang } from "@/lib/i18n";
import type { PublicPayment } from "@/lib/orders-core";

/** How to pay with the chosen method: built from the details the admin filled in for its kind. */
export function PaymentInfo({ method: m, total, lang }: { method: PublicPayment; total: string; lang: Lang }) {
  const d = t(lang).order.pay;
  const note = pick(lang, m.details, m.detailsAr);
  const rows: { label: string; value: string; copy?: boolean }[] =
    m.kind === "whish"
      ? [
          { label: d.number, value: m.phone, copy: true },
          { label: d.accountName, value: m.accountName },
        ]
      : m.kind === "bank"
        ? [
            { label: d.bank, value: m.bank },
            { label: d.accountName, value: m.accountName },
            { label: d.iban, value: m.iban, copy: true },
          ]
        : [];
  const intro = { cash: d.cash, whish: d.whishSend(total), card: d.cardIntro(m.cards), bank: d.bankSend(total), other: "" }[m.kind];

  return (
    <div className="space-y-2 text-sm">
      {intro && <p>{intro}</p>}
      {rows.length > 0 && (
        <dl className="divide-y divide-line rounded-xl border border-line bg-paper">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 px-3 py-2">
              <dt className="w-24 shrink-0 text-muted">{r.label}</dt>
              <dd className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]" dir="auto">
                {r.value}
              </dd>
              {r.copy && <CopyButton value={r.value} lang={lang} />}
            </div>
          ))}
        </dl>
      )}
      {note && <p className="whitespace-pre-line text-muted">{note}</p>}
    </div>
  );
}

function CopyButton({ value, lang }: { value: string; lang: Lang }) {
  const d = t(lang).order.pay;
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="min-h-9 shrink-0 rounded-full border border-line bg-surface px-3 text-xs font-medium"
      onClick={() =>
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
    >
      <span aria-live="polite">{copied ? d.copied : d.copy}</span>
    </button>
  );
}
