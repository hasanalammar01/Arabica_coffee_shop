"use client";

import { useMemo, useState } from "react";
import type { OrdersOverview } from "@/lib/admin/backend";
import { type Order, type OrderStatus, type Totals } from "@/lib/orders-core";
import { useAdminLanguage } from "./Language";
import { ErrorBanner, PageHeader } from "./ui";

const STATUS_LABEL: Record<OrderStatus, [string, string]> = {
  new: ["New", "جديد"],
  accepted: ["Accepted", "مقبول"],
  done: ["Done", "مكتمل"],
  cancelled: ["Cancelled", "ملغى"],
};

const FILTERS = {
  active: {
    label: "To do",
    labelAr: "قيد التنفيذ",
    match: (s: OrderStatus) => s === "new" || s === "accepted",
  },
  done: { label: "Done", labelAr: "مكتمل", match: (s: OrderStatus) => s === "done" },
  cancelled: { label: "Cancelled", labelAr: "ملغى", match: (s: OrderStatus) => s === "cancelled" },
  all: { label: "All", labelAr: "الكل", match: () => true },
};
type Filter = keyof typeof FILTERS;

export function NoDatabase() {
  const { t } = useAdminLanguage();
  return (
    <div className="info-banner">
      {t(
        "The orders database isn't connected yet. In Vercel → Storage, connect the Neon database to this project, then redeploy.",
        "قاعدة بيانات الطلبات غير متصلة بعد. في Vercel ← Storage، اربط قاعدة بيانات Neon بهذا المشروع ثم أعد النشر.",
      )}
    </div>
  );
}

export function OrdersScreen({
  data,
  error,
  timeZone,
  onStatus,
}: {
  data: OrdersOverview | null;
  error: string;
  timeZone: string;
  onStatus: (id: number, status: OrderStatus) => Promise<void>;
}) {
  const { locale, t } = useAdminLanguage();
  const when = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone,
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale, timeZone],
  );
  const [filter, setFilter] = useState<Filter>("active");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const shown = data?.orders.filter((o) => FILTERS[filter].match(o.status)) ?? [];

  const change = async (id: number, status: OrderStatus) => {
    setBusy(id);
    setActionError("");
    try {
      await onStatus(id, status);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page orders-page">
      <PageHeader
        eyebrow={t("Online orders", "الطلبات عبر الإنترنت")}
        title={t("Orders", "الطلبات")}
        description={t(
          "New orders appear here by themselves, with a sound. Keep this page open during service.",
          "تظهر الطلبات الجديدة هنا تلقائياً مع تنبيه صوتي. أبقِ هذه الصفحة مفتوحة أثناء العمل.",
        )}
      />
      {(error || actionError) && (
        <ErrorBanner message={actionError || error} onClose={() => setActionError("")} />
      )}
      <div className="segmented" role="group" aria-label={t("Show orders", "عرض الطلبات")}>
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {t(FILTERS[f].label, FILTERS[f].labelAr)}
            {f === "active" && data && data.newOrders > 0 && <b className="count-badge">{data.newOrders}</b>}
          </button>
        ))}
      </div>
      {!data && !error && <p className="muted-text">{t("Loading orders…", "جارٍ تحميل الطلبات…")}</p>}
      {data && !shown.length && (
        <div className="empty-state panel">
          <h2>
            {filter === "active"
              ? t("No orders waiting", "لا توجد طلبات قيد الانتظار")
              : t("No orders here yet", "لا توجد طلبات هنا بعد")}
          </h2>
          <p>
            {t(
              "Turn on online orders in Settings, and customers can order from the menu page.",
              "فعّل الطلبات عبر الإنترنت في الإعدادات ليتمكّن الزبائن من الطلب من صفحة القائمة.",
            )}
          </p>
        </div>
      )}
      <div className="order-list">
        {shown.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            when={when}
            busy={busy === o.id}
            onStatus={(s) => change(o.id, s)}
          />
        ))}
      </div>
    </div>
  );
}

function OrderCard({
  order: o,
  when,
  busy,
  onStatus,
}: {
  order: Order;
  when: Intl.DateTimeFormat;
  busy: boolean;
  onStatus: (s: OrderStatus) => void;
}) {
  const { lang, locale, t } = useAdminLanguage();
  const money = (n: number) => `${n.toLocaleString(locale)} ${t("L.L", "ل.ل")}`;
  const phone = o.phone.replace(/[^\d+]/g, "");
  return (
    <article className={`order-card panel ${o.status}`}>
      <header>
        <h2>
          {t("Order", "طلب")} <bdi dir="ltr">#{o.id}</bdi>
          {o.status === "new" ? (
            <span className="new-badge">{t("New", "جديد")}</span>
          ) : (
            <span className={`status-badge ${o.status}`}>{t(...STATUS_LABEL[o.status])}</span>
          )}
        </h2>
        <time dateTime={o.createdAt}>{when.format(new Date(o.createdAt))}</time>
        <strong>{money(o.total)}</strong>
      </header>
      <ul className="order-items">
        {o.items.map((l, i) => (
          <li key={i}>
            <span>
              <b>{l.qty}×</b>{" "}
              {[
                lang === "ar" ? l.nameAr || l.name : l.name,
                [l.size, l.option, ...l.mods.map((m) => (lang === "ar" ? m.nameAr || m.name : m.name))]
                  .filter(Boolean)
                  .join(t(", ", "، ")),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <span>{money(l.total)}</span>
          </li>
        ))}
      </ul>
      <dl className="order-facts">
        <div>
          <dt>{t("Customer", "الزبون")}</dt>
          <dd>
            <bdi>{o.name}</bdi> ·{" "}
            <a href={`tel:${phone}`} dir="ltr">
              {o.phone}
            </a>{" "}
            ·{" "}
            <a href={`https://wa.me/${phone.replace(/^\+/, "")}`} target="_blank" rel="noreferrer">
              {t("WhatsApp", "واتساب")}
            </a>
          </dd>
        </div>
        <div>
          <dt>{o.fulfilment === "pickup" ? t("Pickup", "استلام من المقهى") : t("Delivery", "توصيل")}</dt>
          <dd>
            {o.fulfilment === "pickup"
              ? t("Customer collects at the café", "يستلم الزبون من المقهى")
              : o.address}
            {o.location && (
              <>
                {" · "}
                <a href={o.location} target="_blank" rel="noreferrer">
                  {t("Open map", "فتح الخريطة")}
                </a>
              </>
            )}
          </dd>
        </div>
        {o.note && (
          <div>
            <dt>{t("Note", "ملاحظة")}</dt>
            <dd>{o.note}</dd>
          </div>
        )}
        <div>
          <dt>{t("Payment", "الدفع")}</dt>
          <dd>{o.payment}</dd>
        </div>
      </dl>
      {(o.status === "new" || o.status === "accepted") && (
        <footer>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => onStatus("cancelled")}
          >
            {t("Cancel order", "إلغاء الطلب")}
          </button>
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() => onStatus(o.status === "new" ? "accepted" : "done")}
          >
            {o.status === "new" ? t("Accept", "قبول") : t("Mark as done", "تحديد كمكتمل")}
          </button>
        </footer>
      )}
    </article>
  );
}

/* ---------- Statistics ---------- */

export function StatsScreen({ data, error }: { data: OrdersOverview | null; error: string }) {
  const { locale, t } = useAdminLanguage();
  const money = (n: number) => `${n.toLocaleString(locale)} ${t("L.L", "ل.ل")}`;
  const day = new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "short" });
  const dayLabel = (d: string) => day.format(new Date(`${d}T00:00:00Z`));
  const orderCount = (n: number) =>
    t(`${n} ${n === 1 ? "order" : "orders"}`, `${n.toLocaleString(locale)} طلب`);
  const s = data?.stats;
  const tiles: [string, Totals | undefined][] = [
    [t("Today", "اليوم"), s?.today],
    [t("This week", "هذا الأسبوع"), s?.week],
    [t("This month", "هذا الشهر"), s?.month],
    [t("All time", "منذ البداية"), s?.all],
  ];
  const max = Math.max(1, ...(s?.last30.map((d) => d.revenue) ?? []));
  return (
    <div className="page stats-page">
      <PageHeader
        eyebrow={t("Online orders", "الطلبات عبر الإنترنت")}
        title={t("Statistics", "الإحصاءات")}
        description={t(
          "Online orders and the money they brought in. Cancelled orders aren't counted.",
          "الطلبات عبر الإنترنت وإيراداتها. لا تُحتسب الطلبات الملغاة.",
        )}
      />
      {error && <ErrorBanner message={error} onClose={() => {}} />}
      <div className="stat-tiles">
        {tiles.map(([label, t]) => (
          <section key={label} className="stat-tile panel">
            <h2>{label}</h2>
            <strong>{t ? money(t.revenue) : "…"}</strong>
            <span>{t ? orderCount(t.orders) : ""}</span>
          </section>
        ))}
      </div>
      {s && (
        <section className="panel chart-panel">
          <h2>{t("Money from orders, last 30 days", "إيرادات الطلبات خلال آخر 30 يوماً")}</h2>
          <div
            className="bar-chart"
            role="list"
            aria-label={t(
              "Money from orders per day, last 30 days",
              "إيرادات الطلبات يومياً خلال آخر 30 يوماً",
            )}
          >
            <span className="chart-max">{money(max === 1 ? 0 : max)}</span>
            {s.last30.map((d, i) => (
              <div
                key={d.day}
                role="listitem"
                tabIndex={0}
                className="bar-slot"
                aria-label={`${dayLabel(d.day)}: ${money(d.revenue)}, ${orderCount(d.orders)}`}
              >
                <i style={{ height: `${(d.revenue / max) * 100}%` }} />
                <span className="bar-tip" aria-hidden>
                  <b>{money(d.revenue)}</b>
                  {dayLabel(d.day)} · {orderCount(d.orders)}
                </span>
                {[0, 7, 14, 21, 29].includes(i) && <small aria-hidden>{dayLabel(d.day)}</small>}
              </div>
            ))}
          </div>
          <details className="chart-table">
            <summary>{t("Show as a table", "عرض كجدول")}</summary>
            <table>
              <thead>
                <tr>
                  <th>{t("Day", "اليوم")}</th>
                  <th>{t("Orders", "الطلبات")}</th>
                  <th>{t("Money", "الإيرادات")}</th>
                </tr>
              </thead>
              <tbody>
                {[...s.last30].reverse().map((d) => (
                  <tr key={d.day}>
                    <td>{dayLabel(d.day)}</td>
                    <td>{d.orders}</td>
                    <td>{money(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      )}
    </div>
  );
}
