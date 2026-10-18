import { createHash } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { site } from "../data/site.ts";
import {
  summarize,
  withDefaults,
  type DayTotal,
  type NewOrder,
  type Order,
  type OrderStatus,
  type Settings,
} from "./orders-core.ts";

/**
 * Orders and settings live in Postgres (Neon, connected in Vercel → Storage), never in the
 * public GitHub repository: they hold customers' names, phones and addresses.
 */
export const dbConfigured = () => Boolean(process.env.DATABASE_URL);

let client: NeonQueryFunction<false, false> | null = null;
let ready: Promise<unknown> | null = null;

async function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL isn't set.");
  client ??= neon(process.env.DATABASE_URL);
  const sql = client;
  // Create the tables on first use; the statements are no-ops once they exist.
  ready ??= (async () => {
    await sql`create table if not exists settings (id int primary key default 1 check (id = 1), data jsonb not null)`;
    await sql`create table if not exists orders (
      id serial primary key,
      created_at timestamptz not null default now(),
      status text not null default 'new',
      name text not null,
      phone text not null,
      fulfilment text not null,
      address text not null default '',
      location text not null default '',
      note text not null default '',
      payment text not null,
      items jsonb not null,
      total integer not null,
      lang text not null default 'en'
    )`;
    await sql`create index if not exists orders_created_at on orders (created_at desc)`;
    await sql`create table if not exists hits (key text not null, at timestamptz not null default now())`;
    await sql`create index if not exists hits_key_at on hits (key, at)`;
  })().catch((e) => {
    ready = null; // try again on the next request
    throw e;
  });
  await ready;
  return sql;
}

/* ---------- Rate limits (wrong passwords, order spam) ---------- */

/**
 * Who is asking, as a salted hash of their IP (Vercel sets x-real-ip; the raw address is never
 * stored). The salt is a server secret, so stored keys can't be matched back to IPs by trying all
 * of them. ponytail: per-IP only; people sharing one connection (a café's Wi-Fi) share the limit.
 */
export function clientKey(headers: Headers, purpose: string) {
  const ip = headers.get("x-real-ip") || headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const salt = process.env.DATABASE_URL ?? "";
  return `${purpose}:${createHash("sha256").update(`${salt}|${ip}`).digest("base64url").slice(0, 22)}`;
}

/** Has `key` been recorded `limit` times in the last `minutes`? Always false without a database. */
export async function limited(key: string, limit: number, minutes: number) {
  if (!dbConfigured()) return false;
  const sql = await db();
  const [row] = await sql`select count(*)::int as n from hits where key = ${key} and at > now() - make_interval(mins => ${minutes})`;
  return Number(row.n) >= limit;
}

export async function recordHit(key: string) {
  if (!dbConfigured()) return;
  const sql = await db();
  await sql`insert into hits (key) values (${key})`;
  await sql`delete from hits where at < now() - interval '1 day'`;
}

export async function clearHits(key: string) {
  if (!dbConfigured()) return;
  const sql = await db();
  await sql`delete from hits where key = ${key}`;
}

/* ---------- Settings ---------- */

export async function getSettings(): Promise<Settings> {
  if (!dbConfigured()) return withDefaults({});
  const sql = await db();
  const rows = await sql`select data from settings where id = 1`;
  return withDefaults(rows[0]?.data);
}

export async function saveSettings(patch: Partial<Settings>) {
  const sql = await db();
  const next = { ...(await getSettings()), ...patch };
  await sql`insert into settings (id, data) values (1, ${JSON.stringify(next)})
            on conflict (id) do update set data = excluded.data`;
  return next;
}

/* ---------- Orders ---------- */

type Row = Record<string, unknown>;
const toOrder = (r: Row): Order => ({
  id: Number(r.id),
  createdAt: new Date(r.created_at as string).toISOString(),
  status: r.status as OrderStatus,
  name: r.name as string,
  phone: r.phone as string,
  fulfilment: r.fulfilment as Order["fulfilment"],
  address: r.address as string,
  location: r.location as string,
  note: r.note as string,
  payment: r.payment as string,
  items: r.items as Order["items"],
  total: Number(r.total),
  lang: r.lang as Order["lang"],
});

export async function addOrder(o: NewOrder): Promise<Order> {
  const sql = await db();
  const [row] = await sql`
    insert into orders (name, phone, fulfilment, address, location, note, payment, items, total, lang)
    values (${o.name}, ${o.phone}, ${o.fulfilment}, ${o.address}, ${o.location}, ${o.note}, ${o.payment},
            ${JSON.stringify(o.items)}, ${o.total}, ${o.lang})
    returning *`;
  return toOrder(row);
}

export async function setOrderStatus(id: number, status: OrderStatus) {
  const sql = await db();
  const rows = await sql`update orders set status = ${status} where id = ${id} returning id`;
  return rows.length > 0;
}

/** The latest orders plus statistics, for the admin. Cancelled orders don't count as money taken. */
export async function ordersOverview(limit = 150) {
  const sql = await db();
  const tz = site.timeZone;
  const [orders, days, [all], [meta]] = await Promise.all([
    sql`select * from orders order by id desc limit ${limit}`,
    sql`select to_char(created_at at time zone ${tz}, 'YYYY-MM-DD') as day,
               count(*)::int as orders, coalesce(sum(total), 0)::float8 as revenue
        from orders where status <> 'cancelled' and created_at > now() - interval '62 days'
        group by 1`,
    sql`select count(*)::int as orders, coalesce(sum(total), 0)::float8 as revenue
        from orders where status <> 'cancelled'`,
    sql`select to_char(now() at time zone ${tz}, 'YYYY-MM-DD') as day,
               count(*) filter (where status = 'new')::int as new_orders from orders`,
  ]);
  return {
    orders: orders.map(toOrder),
    newOrders: Number(meta.new_orders),
    stats: {
      ...summarize(days as DayTotal[], meta.day as string),
      all: { orders: Number(all.orders), revenue: Number(all.revenue) },
    },
  };
}
