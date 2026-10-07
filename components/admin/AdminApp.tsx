"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { MenuCategoryData } from "@/data/menu";
import type { SiteData } from "@/data/site";
import {
  connect,
  getSession,
  signIn as startSession,
  signOut as endSession,
  type Backend,
  type FileChange,
  type Mode,
} from "@/lib/admin/backend";
import {
  newKey,
  toDraft,
  toJsonFile,
  toMenuJson,
  type DraftItem,
  type DraftSection,
} from "@/lib/admin/draft";
import { buildMenu, slugify } from "@/lib/menu-core";
import { ItemEditor, type Destination } from "./ItemEditor";
import { MenuItems } from "./MenuItems";
import { Sections } from "./Sections";
import { ShopInfo } from "./ShopInfo";
import { FullLogo, Icon, Logo, Toast, type IconName } from "./ui";

type Screen = "items" | "editor" | "sections" | "shop";
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
  const open = useCallback(async (mode: Mode | null) => {
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
      setStatus("ready");
    } catch (e) {
      setAuthError(errorText(e));
      setStatus("signed-out");
    }
  }, []);

  // Still signed in from earlier (12-hour session)? Go straight to the dashboard.
  useEffect(() => {
    getSession()
      .then((s) => (s.signedIn ? open(s.mode) : setStatus("signed-out")))
      .catch((e) => {
        setAuthError(errorText(e));
        setStatus("signed-out");
      });
  }, [open]);

  const signIn = async (password: string) => {
    setStatus("loading");
    setAuthError("");
    try {
      await startSession(password);
      await open((await getSession()).mode);
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
      try {
        buildMenu(toMenuJson(next).categories);
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
      const withPhotos = next.map((s) => ({
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
    if ("newSection" in to) next = [...next, { key: newKey(), name: to.newSection, items: [item] }];
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
    <AppShell screen={screen} go={go} user={backend.user} onSignOut={signOut}>
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
  onSignIn: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (password) onSignIn(password);
  };
  return (
    <main id="main" className="sign-in">
      <form className="sign-in-card" onSubmit={submit}>
        <FullLogo />
        <h1>Menu admin</h1>
        <p>{checking || loading ? "Loading the menu…" : "Sign in to edit the Arabica menu."}</p>
        {error && (
          <span className="error-text" role="alert">
            {error}
          </span>
        )}
        {!checking && (
          <>
            <label className="field">
              <span className="field-label">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </label>
            <button type="submit" className="button primary" disabled={loading || !password}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <small>Ask the owner for the admin password.</small>
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
  children,
}: {
  screen: Screen;
  go: (to: Screen) => boolean;
  user: Backend["user"];
  onSignOut: () => void;
  children: ReactNode;
}) {
  const [mobileNav, setMobileNav] = useState(false);
  const nav: { id: Screen; label: string; icon: IconName }[] = [
    { id: "items", label: "Menu items", icon: "menu" },
    { id: "sections", label: "Sections", icon: "sections" },
    { id: "shop", label: "Shop info", icon: "shop" },
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
            <small>Menu admin</small>
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
          {nav.map((item) => (
            <button
              type="button"
              key={item.id}
              className={active === item.id ? "active" : ""}
              aria-current={active === item.id ? "page" : undefined}
              onClick={() => go(item.id) && setMobileNav(false)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
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
