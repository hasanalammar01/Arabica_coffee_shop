"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { MenuCategoryData } from "@/data/menu";
import type { SiteData } from "@/data/site";
import {
  connect,
  getOrders,
  getSession,
  setOrderStatus,
  signIn as startSession,
  signOut as endSession,
  type Backend,
  type FileChange,
  type Mode,
  type OrdersOverview,
} from "@/lib/admin/backend";
import {
  newKey,
  newItemId,
  toDraft,
  toJsonFile,
  toMenuJson,
  type DraftItem,
  type DraftSection,
} from "@/lib/admin/draft";
import { buildMenu, slugify } from "@/lib/menu-core";
import type { OrderStatus } from "@/lib/orders-core";
import { ItemEditor, type Destination } from "./ItemEditor";
import { MenuItems } from "./MenuItems";
import { NoDatabase, OrdersScreen, StatsScreen } from "./Orders";
import { Sections } from "./Sections";
import { PaymentsScreen, SettingsScreen } from "./Settings";
import { ShopInfo } from "./ShopInfo";
import { FullLogo, Icon, Logo, Toast, type IconName } from "./ui";

type Screen = "items" | "editor" | "sections" | "shop" | "orders" | "stats" | "payments" | "settings";
export type Editing = { item: DraftItem; sectionKey: string; isNew: boolean; afterKey?: string };
export type Publish = (next: DraftSection[], message: string) => Promise<void>;

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function AdminApp() {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [status, setStatus] = useState<"checking" | "signed-out" | "loading" | "ready">("checking");
  const [authError, setAuthError] = useState("");
  const [sections, setSections] = useState<DraftSection[]>([]);
  const [site, setSite] = useState<SiteData | null>(null);
  const [screen, setScreen] = useState<Screen>("items");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [ordersDb, setOrdersDb] = useState(false);
  const orders = useOrders(status === "ready" && ordersDb);

  // Each screen opens at the top.
  useEffect(() => {
    scrollTo(0, 0);
  }, [screen]);

  // Warn before closing the tab with unpublished edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** Loads the latest menu and shop info, then shows the dashboard. */
  const open = useCallback(async ({ mode, orders: db }: { mode: Mode | null; orders: boolean }) => {
    setStatus("loading");
    setAuthError("");
    try {
      const b = connect(mode);
      const [menu, siteData] = await Promise.all([
        b.loadJson<{ categories: MenuCategoryData[] }>("data/menu.json"),
        b.loadJson<SiteData>("data/site.json"),
      ]);
      setSections(toDraft(menu.categories));
      setSite(siteData);
      setBackend(b);
      setOrdersDb(db);
      setStatus("ready");
    } catch (e) {
      setAuthError(errorText(e));
      setStatus("signed-out");
    }
  }, []);

  // Still signed in from earlier (12-hour session)? Go straight to the dashboard.
  useEffect(() => {
    getSession()
      .then((s) => (s.signedIn ? open(s) : setStatus("signed-out")))
      .catch((e) => {
        setAuthError(errorText(e));
        setStatus("signed-out");
      });
  }, [open]);

  const signIn = async (username: string, password: string) => {
    setStatus("loading");
    setAuthError("");
    try {
      await startSession(username, password);
      await open(await getSession());
    } catch (e) {
      setAuthError(errorText(e));
      setStatus("signed-out");
    }
  };

  const signOut = async () => {
    await endSession().catch(() => {});
    setBackend(null);
    setStatus("signed-out");
    setScreen("items");
    setDirty(false);
  };

  /** Validates, uploads new photos and publishes menu.json, all in one commit. */
  const publish: Publish = useCallback(
    async (next, message) => {
      const withIds = next.map((s) => ({
        ...s,
        items: s.items.map((i) => (i.id ? i : { ...i, id: newItemId(i.name) })),
      }));
      try {
        buildMenu(toMenuJson(withIds).categories);
      } catch (e) {
        const problems = errorText(e)
          .split("\n")
          .slice(1)
          .map((l) => l.replace(/^\s*- /, ""));
        throw new Error(
          ["Fix these first. The website still shows the previous menu.", ...problems].join("\n"),
        );
      }
      const files: FileChange[] = [];
      const withPhotos = withIds.map((s) => ({
        ...s,
        items: s.items.map((i) => {
          if (!i.upload) return i;
          const image = `/menu/${slugify(i.name, "item")}-${crypto.randomUUID().slice(0, 6)}.webp`;
          files.push({ path: `public${image}`, content: i.upload });
          return { ...i, image, upload: undefined };
        }),
      }));
      files.push({ path: "data/menu.json", content: toJsonFile(toMenuJson(withPhotos)) });
      await backend!.publish(files, message);
      setSections(withPhotos);
      setNotice(backend!.afterPublish);
    },
    [backend],
  );

  /** Puts the edited item back in place (same spot if its section didn't change) and publishes. */
  const saveItem = async ({ item, isNew, afterKey }: Editing, to: Destination) => {
    const from = sections.find((s) => s.items.some((i) => i.key === item.key));
    const oldIndex = from?.items.findIndex((i) => i.key === item.key) ?? -1;
    let next = sections.map((s) => ({ ...s, items: s.items.filter((i) => i.key !== item.key) }));
    if ("newSection" in to)
      next = [...next, { key: newKey(), name: to.newSection, nameAr: "", arDraft: false, items: [item] }];
    else
      next = next.map((s) =>
        s.key === to.sectionKey ? insertAt(s, item, from?.key === s.key ? oldIndex : afterKey) : s,
      );
    await publish(next, `Menu: ${isNew ? "add" : "update"} ${item.name}`);
    setDirty(false);
    setScreen("items");
  };

  const deleteItem = async (item: DraftItem, from: DraftSection[] = sections) => {
    await publish(
      from.map((s) => ({ ...s, items: s.items.filter((i) => i.key !== item.key) })),
      `Menu: remove ${item.name}`,
    );
    setNotice(backend!.afterPublish.replace(/^Published/, "Deleted"));
    setDirty(false);
    setScreen("items");
  };

  const publishSite = async (next: SiteData) => {
    await backend!.publish([{ path: "data/site.json", content: toJsonFile(next) }], "Shop info: update");
    setSite(next);
    setNotice(backend!.afterPublish);
  };

  if (status !== "ready" || !backend || !site)
    return (
      <SignIn
        checking={status === "checking"}
        loading={status === "loading"}
        error={authError}
        onSignIn={signIn}
      />
    );

  const go = (to: Screen) => {
    if (dirty && !confirm("Discard your unpublished changes?")) return false;
    setDirty(false);
    setScreen(to);
    return true;
  };
  const edit = (e: Editing) => {
    setEditing(e);
    setScreen("editor");
  };

  return (
    <AppShell screen={screen} go={go} user={backend.user} onSignOut={signOut} newOrders={orders.data?.newOrders ?? 0}>
      {notice && <Toast message={notice} onClose={() => setNotice("")} />}
      {screen === "items" && (
        <MenuItems
          sections={sections}
          publish={publish}
          onEdit={edit}
          onDelete={deleteItem}
          setDirty={setDirty}
        />
      )}
      {screen === "editor" && editing && (
        <ItemEditor
          key={editing.item.key}
          editing={editing}
          sections={sections}
          onBack={() => {
            setDirty(false);
            setScreen("items");
          }}
          onPublish={(item, to) => saveItem({ ...editing, item }, to)}
          onDelete={() => deleteItem(editing.item)}
          setDirty={setDirty}
        />
      )}
      {screen === "sections" && <Sections sections={sections} publish={publish} setDirty={setDirty} />}
      {screen === "shop" && <ShopInfo site={site} onPublish={publishSite} setDirty={setDirty} />}
      {ORDER_SCREENS.includes(screen) && !ordersDb ? (
        <div className="page narrow-page">
          <NoDatabase />
        </div>
      ) : (
        <>
          {screen === "orders" && <OrdersScreen data={orders.data} error={orders.error} onStatus={orders.setStatus} />}
          {screen === "stats" && <StatsScreen data={orders.data} error={orders.error} />}
          {screen === "payments" && <PaymentsScreen setDirty={setDirty} onSaved={setNotice} />}
          {screen === "settings" && <SettingsScreen setDirty={setDirty} onSaved={setNotice} />}
        </>
      )}
    </AppShell>
  );
}

function insertAt(
  section: DraftSection,
  item: DraftItem,
  position: number | string | undefined,
): DraftSection {
  const items = [...section.items];
  const index =
    typeof position === "number" && position >= 0
      ? position
      : typeof position === "string" && items.some((i) => i.key === position)
        ? items.findIndex((i) => i.key === position) + 1
        : items.length;
  items.splice(index, 0, item);
  return { ...section, items };
}

function SignIn({
  checking,
  loading,
  error,
  onSignIn,
}: {
  checking: boolean;
  loading: boolean;
  error: string;
  onSignIn: (username: string, password: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (username && password) onSignIn(username, password);
  };
  return (
    <main id="main" className="sign-in">
      <form className="sign-in-card" onSubmit={submit}>
        <FullLogo />
        <h1>Arabica admin</h1>
        <p>{checking || loading ? "Loading the menu…" : "Sign in to edit the Arabica menu."}</p>
        {error && (
          <span className="error-text" role="alert">
            {error}
          </span>
        )}
        {!checking && (
          <>
            <label className="field">
              <span className="field-label">Username</span>
              <input
                autoComplete="username"
                autoCapitalize="none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </label>
            <button type="submit" className="button primary" disabled={loading || !username || !password}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <small>First time? The username is &ldquo;admin&rdquo; until it&apos;s changed in Settings.</small>
          </>
        )}
      </form>
    </main>
  );
}

function AppShell({
  screen,
  go,
  user,
  onSignOut,
  newOrders,
  children,
}: {
  screen: Screen;
  go: (to: Screen) => boolean;
  user: Backend["user"];
  onSignOut: () => void;
  newOrders: number;
  children: ReactNode;
}) {
  const [mobileNav, setMobileNav] = useState(false);
  const nav: { group: string; items: { id: Screen; label: string; icon: IconName; badge?: number }[] }[] = [
    {
      group: "Menu",
      items: [
        { id: "items", label: "Menu items", icon: "menu" },
        { id: "sections", label: "Sections", icon: "sections" },
        { id: "shop", label: "Shop info", icon: "shop" },
      ],
    },
    {
      group: "Online orders",
      items: [
        { id: "orders", label: "Orders", icon: "bag", badge: newOrders },
        { id: "stats", label: "Statistics", icon: "chart" },
        { id: "payments", label: "Payment methods", icon: "card" },
      ],
    },
    { group: "Admin", items: [{ id: "settings", label: "Settings", icon: "settings" }] },
  ];
  const active = screen === "editor" ? "items" : screen;
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand">
          <Logo />
          <div>
            <strong>Arabica</strong>
            <small>Admin</small>
          </div>
          <button
            type="button"
            className="nav-close"
            onClick={() => setMobileNav(false)}
            aria-label="Close menu"
          >
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="Dashboard navigation">
          {nav.map(({ group, items }) => (
            <div key={group} className="nav-group">
              <small>{group}</small>
              {items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={active === item.id ? "active" : ""}
                  aria-current={active === item.id ? "page" : undefined}
                  onClick={() => go(item.id) && setMobileNav(false)}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.badge ? <b className="count-badge">{item.badge} new</b> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <a href="/menu" target="_blank" rel="noreferrer">
            <Icon name="external" />
            <span>View public menu</span>
          </a>
          <div className="profile">
            <div>{initials}</div>
            <span>
              <b>{user.name}</b>
              <small>{user.detail}</small>
            </span>
          </div>
          <button type="button" className="sign-out" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          type="button"
          className="scrim"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        />
      )}
      <main id="main" className="app-main">
        <header className="mobile-header">
          <button type="button" aria-label="Open navigation" onClick={() => setMobileNav(true)}>
            <Icon name="menu" />
          </button>
          <Logo />
          <span aria-hidden="true" />
        </header>
        {children}
      </main>
    </div>
  );
}

const ORDER_SCREENS: Screen[] = ["orders", "stats", "payments", "settings"];
const POLL_MS = 15_000;

/** A short chime for a new order (no audio file needed). Browsers allow it once staff have clicked the page. */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.18;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  } catch {
    // No sound available; the badge and the tab title still show the new order.
  }
}

/** Polls the orders while the admin is open; chimes and updates the tab title when a new one arrives. */
function useOrders(enabled: boolean) {
  const [data, setData] = useState<OrdersOverview | null>(null);
  const [error, setError] = useState("");
  const lastId = useRef<number | null>(null);

  const refresh = useCallback(
    () =>
      getOrders().then(
        (next) => {
          const newest = next.orders[0]?.id ?? 0;
          if (lastId.current !== null && newest > lastId.current) chime();
          lastId.current = newest;
          setData(next);
          setError("");
        },
        (e) => setError(errorText(e)),
      ),
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  // Re-applied after every poll, so nothing that resets the page title leaves it stale.
  useEffect(() => {
    const n = data?.newOrders ?? 0;
    document.title = n ? `(${n}) New order${n === 1 ? "" : "s"} · Arabica admin` : "Arabica admin";
  }, [data]);

  const setStatus = useCallback(
    async (id: number, status: OrderStatus) => {
      await setOrderStatus(id, status);
      await refresh();
    },
    [refresh],
  );
  return { data, error, setStatus };
}
