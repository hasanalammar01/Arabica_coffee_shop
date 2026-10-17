"use client";

import { useState } from "react";
import { site } from "@/data/site";
import type { OrdersOverview } from "@/lib/admin/backend";
import { lineLabel, type Order, type OrderStatus, type Totals } from "@/lib/orders-core";
import { ErrorBanner, PageHeader } from "./ui";

const money = (n: number) => `${n.toLocaleString("en-US")} L.L`;
const when = new Intl.DateTimeFormat("en-GB", {
  timeZone: site.timeZone,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  accepted: "Accepted",
  done: "Done",
  cancelled: "Cancelled",
};

const FILTERS = {
  active: { label: "To do", match: (s: OrderStatus) => s === "new" || s === "accepted" },
  done: { label: "Done", match: (s: OrderStatus) => s === "done" },
  cancelled: { label: "Cancelled", match: (s: OrderStatus) => s === "cancelled" },
  all: { label: "All", match: () => true },
};
type Filter = keyof typeof FILTERS;

export function NoDatabase() {
  return (
    <div className="info-banner">
      The orders database isn&apos;t connected yet. In Vercel → Storage, connect the Neon database to this project,
      then redeploy.
    </div>
  );
}

export function OrdersScreen({
  data,
  error,
  onStatus,
}: {
  data: OrdersOverview | null;
  error: string;
  onStatus: (id: number, status: OrderStatus) => Promise<void>;
}) {
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
        eyebrow="Online orders"
        title="Orders"
        description="New orders appear here by themselves, with a sound. Keep this page open during service."
      />
      {(error || actionError) && <ErrorBanner message={actionError || error} onClose={() => setActionError("")} />}
      <div className="segmented" role="group" aria-label="Show orders">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {FILTERS[f].label}
            {f === "active" && data && data.newOrders > 0 && <b className="count-badge">{data.newOrders}</b>}
          </button>
        ))}
      </div>
      {!data && !error && <p className="muted-text">Loading orders…</p>}
      {data && !shown.length && (
        <div className="empty-state panel">
          <h2>{filter === "active" ? "No orders waiting" : "No orders here yet"}</h2>
          <p>Turn on online orders in Settings, and customers can order from the menu page.</p>
        </div>
      )}
      <div className="order-list">
        {shown.map((o) => (
          <OrderCard key={o.id} order={o} busy={busy === o.id} onStatus={(s) => change(o.id, s)} />
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order: o, busy, onStatus }: { order: Order; busy: boolean; onStatus: (s: OrderStatus) => void }) {
  const phone = o.phone.replace(/[^\d+]/g, "");
  return (
    <article className={`order-card panel ${o.status}`}>
      <header>
        <h2>
          Order #{o.id}
          {o.status === "new" ? (
            <span className="new-badge">New</span>
          ) : (
            <span className={`status-badge ${o.status}`}>{STATUS_LABEL[o.status]}</span>
          )}
        </h2>
        <time dateTime={o.createdAt}>{when.format(new Date(o.createdAt))}</time>
        <strong>{money(o.total)}</strong>
      </header>
      <ul className="order-items">
        {o.items.map((l, i) => (
          <li key={i}>
            <span>
              <b>{l.qty}×</b> {lineLabel(l)}
            </span>
            <span>{money(l.total)}</span>
          </li>
        ))}
      </ul>
      <dl className="order-facts">
        <div>
          <dt>Customer</dt>
          <dd>
            {o.name} · <a href={`tel:${phone}`}>{o.phone}</a> ·{" "}
            <a href={`https://wa.me/${phone.replace(/^\+/, "")}`} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          </dd>
        </div>
        <div>
          <dt>{o.fulfilment === "pickup" ? "Pickup" : "Delivery"}</dt>
          <dd>
            {o.fulfilment === "pickup" ? "Customer collects at the café" : o.address}
            {o.location && (
              <>
                {" · "}
                <a href={o.location} target="_blank" rel="noreferrer">
                  Open map
                </a>
              </>
            )}
          </dd>
        </div>
        {o.note && (
          <div>
            <dt>Note</dt>
            <dd>{o.note}</dd>
          </div>
        )}
        <div>
          <dt>Payment</dt>
          <dd>{o.payment}</dd>
        </div>
      </dl>
      {(o.status === "new" || o.status === "accepted") && (
        <footer>
          <button type="button" className="button secondary" disabled={busy} onClick={() => onStatus("cancelled")}>
            Cancel order
          </button>
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() => onStatus(o.status === "new" ? "accepted" : "done")}
          >
            {o.status === "new" ? "Accept" : "Mark as done"}
          </button>
        </footer>
      )}
    </article>
  );
}

/* ---------- Statistics ---------- */

const day = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
const dayLabel = (d: string) => day.format(new Date(`${d}T00:00:00Z`));

export function StatsScreen({ data, error }: { data: OrdersOverview | null; error: string }) {
  const s = data?.stats;
  const tiles: [string, Totals | undefined][] = [
    ["Today", s?.today],
    ["This week", s?.week],
    ["This month", s?.month],
    ["All time", s?.all],
  ];
  const max = Math.max(1, ...(s?.last30.map((d) => d.revenue) ?? []));
  return (
    <div className="page stats-page">
      <PageHeader
        eyebrow="Online orders"
        title="Statistics"
        description="Online orders and the money they brought in. Cancelled orders aren't counted."
      />
      {error && <ErrorBanner message={error} onClose={() => {}} />}
      <div className="stat-tiles">
        {tiles.map(([label, t]) => (
          <section key={label} className="stat-tile panel">
            <h2>{label}</h2>
            <strong>{t ? money(t.revenue) : "…"}</strong>
            <span>{t ? `${t.orders} ${t.orders === 1 ? "order" : "orders"}` : ""}</span>
          </section>
        ))}
      </div>
      {s && (
        <section className="panel chart-panel">
          <h2>Money from orders, last 30 days</h2>
          <div className="bar-chart" role="list" aria-label="Money from orders per day, last 30 days">
            <span className="chart-max">{money(max === 1 ? 0 : max)}</span>
            {s.last30.map((d, i) => (
              <div
                key={d.day}
                role="listitem"
                tabIndex={0}
                className="bar-slot"
                aria-label={`${dayLabel(d.day)}: ${money(d.revenue)}, ${d.orders} orders`}
              >
                <i style={{ height: `${(d.revenue / max) * 100}%` }} />
                <span className="bar-tip" aria-hidden>
                  <b>{money(d.revenue)}</b>
                  {dayLabel(d.day)} · {d.orders} {d.orders === 1 ? "order" : "orders"}
                </span>
                {[0, 7, 14, 21, 29].includes(i) && <small aria-hidden>{dayLabel(d.day)}</small>}
              </div>
            ))}
          </div>
          <details className="chart-table">
            <summary>Show as a table</summary>
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Orders</th>
                  <th>Money</th>
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
