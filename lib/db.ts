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
import { cleanPages, type Page } from "./admin/permissions.ts";

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
    await sql`create table if not exists staff (
      id serial primary key,
      username text not null unique,
      password_hash text not null,
      pages jsonb not null,
      active boolean not null default true,
      session_epoch integer not null default 0,
      created_at timestamptz not null default now()
    )`;
    // Presence: last request, and last sign-out (both null until the first sign-in).
    await sql`alter table staff add column if not exists last_seen timestamptz`;
    await sql`alter table staff add column if not exists last_signout timestamptz`;
    await sql`create table if not exists activity (
      id serial primary key,
      at timestamptz not null default now(),
      actor text not null,
      action text not null
    )`;
    await sql`create index if not exists activity_at on activity (at desc)`;
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

/* ---------- Staff accounts ---------- */

export type StaffRow = {
  id: number;
  username: string;
  passwordHash: string;
  pages: Page[];
  active: boolean;
  sessionEpoch: number;
  createdAt: string;
};

const toStaff = (r: Record<string, unknown>): StaffRow => ({
  id: Number(r.id),
  username: r.username as string,
  passwordHash: r.password_hash as string,
  pages: cleanPages(r.pages),
  active: r.active === true,
  sessionEpoch: Number(r.session_epoch),
  createdAt: new Date(r.created_at as string).toISOString(),
});

export async function listStaff() {
  const sql = await db();
  return (await sql`select * from staff order by username`).map(toStaff);
}

export async function getStaff(id: number) {
  const sql = await db();
  const [row] = await sql`select * from staff where id = ${id}`;
  return row ? toStaff(row) : null;
}

export async function findStaff(username: string) {
  const sql = await db();
  const [row] = await sql`select * from staff where username = ${username.trim().toLowerCase()}`;
  return row ? toStaff(row) : null;
}

export async function createStaff(username: string, passwordHash: string, pages: Page[]) {
  const sql = await db();
  const [row] = await sql`
    insert into staff (username, password_hash, pages) values (${username.trim().toLowerCase()}, ${passwordHash}, ${JSON.stringify(pages)})
    on conflict (username) do nothing returning *`;
  return row ? toStaff(row) : null; // null: the username is taken
}

/** Any change to an account also ends its sessions (the epoch is part of its signing secret). */
export async function updateStaff(id: number, patch: { pages?: Page[]; active?: boolean; passwordHash?: string }) {
  const sql = await db();
  const current = await getStaff(id);
  if (!current) return null;
  const [row] = await sql`
    update staff set
      pages = ${JSON.stringify(patch.pages ?? current.pages)},
      active = ${patch.active ?? current.active},
      password_hash = ${patch.passwordHash ?? current.passwordHash},
      session_epoch = session_epoch + 1
    where id = ${id} returning *`;
  return row ? toStaff(row) : null;
}

export async function deleteStaff(id: number) {
  const sql = await db();
  return (await sql`delete from staff where id = ${id} returning id`).length > 0;
}

/** "Sign out all devices": ends every staff session too. */
export async function signOutAllStaff() {
  if (!dbConfigured()) return;
  const sql = await db();
  await sql`update staff set session_epoch = session_epoch + 1`;
}

/* ---------- Presence and activity ---------- */

const ONLINE_MINUTES = 5;

/** Notes that a staff member is active (at most one write a minute per person). */
export async function touchStaff(id: number) {
  const sql = await db();
  await sql`update staff set last_seen = now() where id = ${id} and (last_seen is null or last_seen < now() - interval '1 minute')`;
}

/** A sign-in counts as activity straight away (it isn't throttled like touchStaff). */
export async function markSignedIn(id: number) {
  const sql = await db();
  await sql`update staff set last_seen = now() where id = ${id}`;
}

export async function markSignedOut(id: number) {
  const sql = await db();
  await sql`update staff set last_signout = now() where id = ${id}`;
}

/** Online = active in the last 5 minutes and not signed out since. */
export async function staffPresence() {
  const sql = await db();
  const rows = await sql`select id, last_seen, last_signout,
      (last_seen > now() - make_interval(mins => ${ONLINE_MINUTES}) and (last_signout is null or last_signout < last_seen)) as online
    from staff`;
  return new Map(
    rows.map((r) => [
      Number(r.id),
      {
        online: r.online === true,
        lastSeen: r.last_seen ? new Date(r.last_seen as string).toISOString() : null,
        lastSignout: r.last_signout ? new Date(r.last_signout as string).toISOString() : null,
      },
    ]),
  );
}

/**
 * Records what someone did in the admin (never passwords or codes). Entries older than 90 days
 * are removed as new ones arrive. A failed write never blocks the action itself.
 */
export async function logActivity(actor: string, action: string) {
  if (!dbConfigured()) return;
  try {
    const sql = await db();
    await sql`insert into activity (actor, action) values (${actor.slice(0, 60)}, ${action.slice(0, 300)})`;
    await sql`delete from activity where at < now() - interval '90 days'`;
  } catch (e) {
    console.error("Activity log write failed:", e);
  }
}

export type ActivityEntry = { id: number; at: string; actor: string; action: string };

export async function listActivity(actor?: string, limit = 300): Promise<ActivityEntry[]> {
  const sql = await db();
  const rows = actor
    ? await sql`select * from activity where actor = ${actor} order by id desc limit ${limit}`
    : await sql`select * from activity order by id desc limit ${limit}`;
  return rows.map((r) => ({ id: Number(r.id), at: new Date(r.at as string).toISOString(), actor: r.actor as string, action: r.action as string }));
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
