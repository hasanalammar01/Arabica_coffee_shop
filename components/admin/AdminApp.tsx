"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { MenuCategoryData } from "@/data/menu";
import type { SiteData } from "@/data/site";
import {
  connect,
  getOrders,
  getSession,
  setOrderStatus,
  requestPinReset,
  resetPin,
  signIn as startSession,
  verifyPin,
  signOut as endSession,
  type Backend,
  type FileChange,
  type Mode,
  type OrdersOverview,
  type SessionUser,
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
import { currencyLabel, formatAmount } from "@/lib/format";
import { buildMenu, slugify } from "@/lib/menu-core";
import { PAGES, type Page } from "@/lib/admin/permissions";
import { pinProblem } from "@/lib/admin/pin";
import { pick } from "@/lib/i18n";
import type { OrderStatus } from "@/lib/orders-core";
import { ItemEditor, type Destination } from "./ItemEditor";
import { MenuItems } from "./MenuItems";
import { ActivityScreen } from "./Activity";
import { NoDatabase, OrdersScreen, StatsScreen } from "./Orders";
import { Sections } from "./Sections";
import { PaymentsScreen, SettingsScreen } from "./Settings";
import { ShopInfo } from "./ShopInfo";
import { FullLogo, Icon, Logo, Toast, type IconName } from "./ui";
import { LanguageSwitch, useAdminLanguage } from "./Language";

type Screen =
  "items" | "editor" | "sections" | "shop" | "orders" | "stats" | "payments" | "settings" | "activity";
export type Editing = { item: DraftItem; sectionKey: string; isNew: boolean; afterKey?: string };
export type Publish = (next: DraftSection[], message: string) => Promise<void>;

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function AdminApp() {
  const { t } = useAdminLanguage();
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
  // The pages this user may open (all for the super admin). The server enforces the same list.
  const [pages, setPages] = useState<Page[]>([...PAGES]);
  const [isAdmin, setIsAdmin] = useState(true);
  const orders = useOrders(
    status === "ready" && ordersDb && (pages.includes("orders") || pages.includes("stats")),
  );

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
  const open = useCallback(
    async ({ mode, orders: db, user }: { mode: Mode | null; orders: boolean; user?: SessionUser }) => {
      setStatus("loading");
      setAuthError("");
      try {
        const b = connect(mode, user);
        const allowed = user?.pages ?? [...PAGES];
        setPages(allowed);
        setIsAdmin(!user || user.role === "admin");
        // Open on the first page this user may use; Settings ("My account") is always there.
        setScreen(PAGES.find((p) => allowed.includes(p)) ?? "settings");
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
    },
    [],
  );

  // Check in every 30 seconds while the dashboard is open: keeps "online" accurate for the super admin,
  // and sends someone whose account was disabled or signed out back to the sign-in screen.
  useEffect(() => {
    if (status !== "ready") return;
    const id = setInterval(() => {
      getSession()
        .then((s) => {
          if (s.signedIn) return;
          setBackend(null);
          setAuthError("You were signed out. Sign in again.");
          setStatus("signed-out");
        })
        .catch(() => {}); // offline for a moment: try again next minute
    }, 30_000);
    return () => clearInterval(id);
  }, [status]);

  // Still signed in from earlier (12-hour session)? Go straight to the dashboard.
  useEffect(() => {
    getSession()
      .then((s) => (s.signedIn ? open(s) : setStatus("signed-out")))
      .catch((e) => {
        setAuthError(errorText(e));
        setStatus("signed-out");
      });
  }, [open]);

  const [pinStep, setPinStep] = useState(false);

  /** Opens the dashboard; nudges towards a PIN while none is set. */
  const enter = async () => {
    const session = await getSession();
    await open(session);
    if (session.user?.role === "admin" && session.orders && !session.pin)
      setNotice("Protect the admin: create a 4-digit sign-in PIN in Settings.");
  };

  const signIn = async (username: string, password: string) => {
    setStatus("loading");
    setAuthError("");
    try {
      const { pin } = await startSession(username, password);
      if (pin) {
        setPinStep(true);
        setStatus("signed-out");
        return;
      }
      await enter();
    } catch (e) {
      setAuthError(errorText(e));
      setStatus("signed-out");
    }
  };

  const enterPin = async (pin: string) => {
    setStatus("loading");
    setAuthError("");
    try {
      await verifyPin(pin);
      setPinStep(false);
      await enter();
    } catch (e) {
      const message = errorText(e);
      setAuthError(message);
      // The 5 minutes for the PIN ran out: back to the password.
      if (message.startsWith("Sign in with your password")) setPinStep(false);
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

  /** Validates content and publishes it with any new photos. */
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
      const images = await backend!.publish(files, message);
      setSections(
        withPhotos.map((section) => ({
          ...section,
          items: section.items.map((item) => {
            if (item.preview?.startsWith("blob:")) URL.revokeObjectURL(item.preview);
            return { ...item, image: images[item.image] ?? item.image, preview: undefined };
          }),
        })),
      );
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
        pinStep={pinStep}
        onPin={enterPin}
        onReset={async () => {
          setPinStep(false);
          setStatus("loading");
          await enter().catch((e) => {
            setAuthError(errorText(e));
            setStatus("signed-out");
          });
        }}
        onBack={() => {
          setPinStep(false);
          setAuthError("");
        }}
      />
    );

  const go = (to: Screen) => {
    if (dirty && !confirm(t("Discard your unpublished changes?", "هل تريد تجاهل التغييرات غير المنشورة؟")))
      return false;
    setDirty(false);
    setScreen(to);
    return true;
  };
  const edit = (e: Editing) => {
    setEditing(e);
    setScreen("editor");
  };
  // From the top search: may leave another screen, so ask about unpublished changes first.
  const openItem = (e: Editing) => go("editor") && setEditing(e);

  return (
    <AppShell
      screen={screen}
      go={go}
      user={backend.user}
      pages={pages}
      isAdmin={isAdmin}
      onSignOut={signOut}
      newOrders={orders.data?.newOrders ?? 0}
      orders={orders.data?.orders ?? []}
      sections={sections}
      onOpenItem={openItem}
    >
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
          {screen === "orders" && (
            <OrdersScreen
              data={orders.data}
              error={orders.error}
              timeZone={site.timeZone}
              onStatus={orders.setStatus}
            />
          )}
          {screen === "stats" && <StatsScreen data={orders.data} error={orders.error} />}
          {screen === "payments" && <PaymentsScreen setDirty={setDirty} onSaved={setNotice} />}
          {screen === "settings" && <SettingsScreen setDirty={setDirty} onSaved={setNotice} pages={pages} />}
          {screen === "activity" && isAdmin && <ActivityScreen timeZone={site.timeZone} />}
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
  pinStep,
  onPin,
  onReset,
  onBack,
}: {
  checking: boolean;
  loading: boolean;
  error: string;
  onSignIn: (username: string, password: string) => void;
  pinStep: boolean;
  onPin: (pin: string) => void;
  onReset: () => void;
  onBack: () => void;
}) {
  const { t, localizeError } = useAdminLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (username && password) onSignIn(username, password);
  };
  if (pinStep)
    return <PinStep loading={loading} error={error} onPin={onPin} onReset={onReset} onBack={onBack} />;
  return (
    <main id="main" className="sign-in">
      <div className="sign-in-language">
        <LanguageSwitch />
      </div>
      <form className="sign-in-card" onSubmit={submit}>
        <FullLogo />
        <h1>{t("Arabica admin", "إدارة أرابيكا")}</h1>
        <p>
          {checking || loading
            ? t("Loading the menu…", "جارٍ تحميل القائمة…")
            : t("Sign in to edit the Arabica menu.", "سجّل الدخول لتعديل قائمة أرابيكا.")}
        </p>
        {error && (
          <span className="error-text" role="alert">
            {localizeError(error)}
          </span>
        )}
        {!checking && (
          <>
            <label className="field">
              <span className="field-label">{t("Username", "اسم المستخدم")}</span>
              <input
                dir="ltr"
                autoComplete="username"
                autoCapitalize="none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </label>
            <label className="field">
              <span className="field-label">{t("Password", "كلمة المرور")}</span>
              <input
                dir="ltr"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </label>
            <button type="submit" className="button primary" disabled={loading || !username || !password}>
              {loading ? t("Signing in…", "جارٍ تسجيل الدخول…") : t("Sign in", "تسجيل الدخول")}
            </button>
            <small>
              {t(
                "First time? The username is “admin” until it's changed in Settings.",
                "هل هذه أول مرة؟ اسم المستخدم هو “admin” إلى أن يتم تغييره في الإعدادات.",
              )}
            </small>
          </>
        )}
      </form>
    </main>
  );
}

/** Step 2 of signing in: the 4-digit PIN. Sends itself once the 4th digit is typed. */
function PinStep({
  loading,
  error,
  onPin,
  onReset,
  onBack,
}: {
  loading: boolean;
  error: string;
  onPin: (pin: string) => void;
  onReset: () => void;
  onBack: () => void;
}) {
  const { t, localizeError } = useAdminLanguage();
  const [forgot, setForgot] = useState(false);
  const [pin, setPin] = useState("");
  // A wrong PIN clears the field for the next try.
  const [lastError, setLastError] = useState(error);
  if (error !== lastError) {
    setLastError(error);
    if (error) setPin("");
  }
  if (forgot) return <ForgotPin onDone={onReset} onCancel={() => setForgot(false)} />;
  const change = (value: string) => {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 4);
    setPin(digits);
    if (digits.length === 4) onPin(digits);
  };
  return (
    <main id="main" className="sign-in">
      <div className="sign-in-language">
        <LanguageSwitch />
      </div>
      <form
        className="sign-in-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (pin.length === 4) onPin(pin);
        }}
      >
        <FullLogo />
        <h1>{t("Enter your PIN", "أدخل رمز الدخول")}</h1>
        <p>
          {loading
            ? t("Checking…", "جارٍ التحقّق…")
            : t("Your 4-digit sign-in PIN.", "رمز الدخول المكوّن من ٤ أرقام.")}
        </p>
        {error && (
          <span className="error-text" role="alert">
            {localizeError(error)}
          </span>
        )}
        <label className="field">
          <span className="field-label">{t("PIN", "رمز الدخول")}</span>
          <input
            dir="ltr"
            className="pin-input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            autoComplete="one-time-code"
            value={pin}
            onChange={(e) => change(e.target.value)}
            disabled={loading}
            autoFocus
          />
        </label>
        <button type="submit" className="button primary" disabled={loading || pin.length !== 4}>
          {loading ? t("Checking…", "جارٍ التحقّق…") : t("Continue", "متابعة")}
        </button>
        <button type="button" className="button ghost" onClick={() => setForgot(true)} disabled={loading}>
          {t("Forgot PIN?", "نسيت رمز الدخول؟")}
        </button>
        <button type="button" className="button ghost" onClick={onBack} disabled={loading}>
          {t("Use a different account", "استخدام حساب آخر")}
        </button>
      </form>
    </main>
  );
}

/** Forgot PIN: a 6-digit code by WhatsApp, then a new PIN. Only reachable after the password. */
function ForgotPin({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t, localizeError } = useAdminLanguage();
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const digits = (v: string, n: number) => v.replace(/[^0-9]/g, "").slice(0, n);

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      setSentTo((await requestPinReset()).sentTo);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = pinProblem(newPin) ?? (newPin !== confirm ? "The two new PINs don't match." : null);
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      await resetPin(code, newPin);
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <main id="main" className="sign-in">
      <div className="sign-in-language">
        <LanguageSwitch />
      </div>
      <form className="sign-in-card" onSubmit={submit}>
        <FullLogo />
        <h1>{t("Reset your PIN", "إعادة تعيين رمز الدخول")}</h1>
        <p>
          {sentTo
            ? t(
                `We sent a 6-digit code to the admin WhatsApp (${sentTo}). It works for 10 minutes.`,
                `أرسلنا رمزًا من ٦ أرقام إلى واتساب المسؤول (${sentTo}). صلاحيته ١٠ دقائق.`,
              )
            : t(
                "We'll send a 6-digit code to the admin WhatsApp number saved in Settings.",
                "سنرسل رمزًا من ٦ أرقام إلى رقم واتساب المسؤول المحفوظ في الإعدادات.",
              )}
        </p>
        {error && (
          <span className="error-text" role="alert">
            {localizeError(error)}
          </span>
        )}
        {!sentTo ? (
          <button type="button" className="button primary" onClick={send} disabled={busy}>
            {busy ? t("Sending…", "جارٍ الإرسال…") : t("Send the code", "إرسال الرمز")}
          </button>
        ) : (
          <>
            <label className="field">
              <span className="field-label">{t("Code from WhatsApp", "الرمز المرسل عبر واتساب")}</span>
              <input
                dir="ltr"
                className="pin-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(digits(e.target.value, 6))}
                autoFocus
              />
            </label>
            <label className="field">
              <span className="field-label">{t("New PIN", "رمز الدخول الجديد")}</span>
              <input
                dir="ltr"
                className="pin-input"
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoComplete="new-password"
                value={newPin}
                onChange={(e) => setNewPin(digits(e.target.value, 4))}
              />
            </label>
            <label className="field">
              <span className="field-label">{t("Repeat the new PIN", "أعد إدخال رمز الدخول الجديد")}</span>
              <input
                dir="ltr"
                className="pin-input"
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(digits(e.target.value, 4))}
              />
            </label>
            <button
              type="submit"
              className="button primary"
              disabled={busy || code.length !== 6 || newPin.length !== 4 || confirm.length !== 4}
            >
              {busy
                ? t("Saving…", "جارٍ الحفظ…")
                : t("Set new PIN and sign in", "حفظ الرمز الجديد وتسجيل الدخول")}
            </button>
            <button type="button" className="button ghost" onClick={send} disabled={busy}>
              {t("Send a new code", "إرسال رمز جديد")}
            </button>
          </>
        )}
        <button type="button" className="button ghost" onClick={onCancel} disabled={busy}>
          {t("Back to PIN", "العودة إلى رمز الدخول")}
        </button>
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
  orders,
  sections,
  onOpenItem,
  pages,
  isAdmin,
  children,
}: {
  screen: Screen;
  go: (to: Screen) => boolean;
  user: Backend["user"];
  pages: Page[];
  isAdmin: boolean;
  onSignOut: () => void;
  newOrders: number;
  orders: OrdersOverview["orders"];
  sections: DraftSection[];
  onOpenItem: (e: Editing) => void;
  children: ReactNode;
}) {
  const { lang, t } = useAdminLanguage();
  const [mobileNav, setMobileNav] = useState(false);
  const allNav: { group: string; items: { id: Screen; label: string; icon: IconName; badge?: number }[] }[] =
    [
      {
        group: t("Menu", "القائمة"),
        items: [
          { id: "items", label: t("Menu items", "أصناف القائمة"), icon: "menu" },
          { id: "sections", label: t("Sections", "الأقسام"), icon: "sections" },
          { id: "shop", label: t("Shop info", "معلومات المقهى"), icon: "shop" },
        ],
      },
      {
        group: t("Online orders", "الطلبات عبر الإنترنت"),
        items: [
          { id: "orders", label: t("Orders", "الطلبات"), icon: "bag", badge: newOrders },
          { id: "stats", label: t("Statistics", "الإحصاءات"), icon: "chart" },
          { id: "payments", label: t("Payment methods", "طرق الدفع"), icon: "card" },
        ],
      },
      {
        group: t("Admin", "الإدارة"),
        items: isAdmin ? [{ id: "activity", label: t("Activity", "سجل النشاط"), icon: "clock" }] : [],
      },
    ];
  const nav = allNav
    // Only the pages this user may open. Settings is the gear in the top bar, always there.
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => i.id === "activity" || pages.includes(i.id as Page)),
    }))
    .filter((g) => g.items.length > 0);
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
            <strong>{t("Arabica", "أرابيكا")}</strong>
            <small>{t("Admin", "الإدارة")}</small>
          </div>
          <button
            type="button"
            className="nav-close"
            onClick={() => setMobileNav(false)}
            aria-label={t("Close menu", "إغلاق القائمة")}
          >
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label={t("Dashboard navigation", "التنقّل في لوحة الإدارة")}>
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
                  {item.badge ? (
                    <b className="count-badge">
                      {item.badge} {t("new", "جديد")}
                    </b>
                  ) : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <a href={lang === "ar" ? "/ar/menu" : "/menu"} target="_blank" rel="noreferrer">
            <Icon name="external" />
            <span>{t("View public menu", "عرض القائمة العامة")}</span>
          </a>
          <div className="profile">
            <div>{initials}</div>
            <span>
              <b>{user.name}</b>
              <small>
                {user.detail === "Staff"
                  ? t("Staff", "موظّف")
                  : user.detail === "Super admin"
                    ? t("Super admin", "المسؤول الرئيسي")
                    : t("Editing files on this computer", "تعديل الملفات على هذا الكمبيوتر")}
              </small>
            </span>
          </div>
          <button type="button" className="sign-out" onClick={onSignOut}>
            {t("Sign out", "تسجيل الخروج")}
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          type="button"
          className="scrim"
          onClick={() => setMobileNav(false)}
          aria-label={t("Close navigation", "إغلاق قائمة التنقّل")}
        />
      )}
      <main id="main" className="app-main">
        <header className="mobile-header">
          <button
            type="button"
            aria-label={t("Open navigation", "فتح قائمة التنقّل")}
            onClick={() => setMobileNav(true)}
          >
            <Icon name="menu" />
          </button>
          <Logo />
          <span aria-hidden="true" />
        </header>
        <div className="topbar">
          <TopSearch
            sections={pages.includes("items") ? sections : []}
            pages={[
              ...nav.flatMap((g) => g.items),
              { id: "settings", label: t("Settings", "الإعدادات"), icon: "settings" },
            ]}
            go={go}
            onOpenItem={onOpenItem}
          />
          <LanguageSwitch />
          {pages.includes("orders") && <Notifications orders={orders} count={newOrders} go={go} />}
          <button
            type="button"
            className={`icon-button ${active === "settings" ? "active" : ""}`}
            aria-label={t("Settings", "الإعدادات")}
            aria-current={active === "settings" ? "page" : undefined}
            title={t("Settings", "الإعدادات")}
            onClick={() => go("settings")}
          >
            <Icon name="settings" />
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}

type NavItem = { id: Screen; label: string; icon: IconName };

/** Finds menu items (English or Arabic name) and dashboard pages; Enter opens the first match. */
function TopSearch({
  sections,
  pages,
  go,
  onOpenItem,
}: {
  sections: DraftSection[];
  pages: NavItem[];
  go: (to: Screen) => boolean;
  onOpenItem: (e: Editing) => void;
}) {
  const { lang, t } = useAdminLanguage();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const q = query.trim().toLowerCase();
  const results = q
    ? [
        ...pages
          .filter((p) => p.label.toLowerCase().includes(q))
          .map((p) => ({
            key: `page-${p.id}`,
            icon: p.icon,
            label: p.label,
            detail: t("Page", "صفحة"),
            run: () => go(p.id),
          })),
        ...sections.flatMap((s) =>
          s.items
            .filter((i) => i.name.toLowerCase().includes(q) || i.nameAr.includes(q))
            .map((i) => ({
              key: i.key,
              icon: "menu" as const,
              label: pick(lang, i.name || i.nameAr, i.nameAr),
              detail: pick(lang, s.name, s.nameAr),
              run: () => onOpenItem({ item: i, sectionKey: s.key, isNew: false }),
            })),
        ),
      ].slice(0, 8)
    : [];
  const choose = (r: (typeof results)[number]) => {
    r.run();
    setQuery("");
    setOpen(false);
  };
  return (
    <div className="top-search" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <label className="search">
        <Icon name="search" />
        <input
          type="search"
          value={query}
          placeholder={t("Search menu items and pages", "البحث في الأصناف والصفحات")}
          aria-label={t("Search menu items and pages", "البحث في الأصناف والصفحات")}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) choose(results[0]);
            if (e.key === "Escape") setOpen(false);
          }}
        />
      </label>
      {open && q && (
        <div className="search-results">
          {results.length ? (
            results.map((r) => (
              <button type="button" key={r.key} onClick={() => choose(r)}>
                <Icon name={r.icon} size={18} />
                <span>{r.label}</span>
                <small>{r.detail}</small>
              </button>
            ))
          ) : (
            <p>{t(`Nothing matches ‘${query.trim()}’.`, `لا توجد نتائج لـ«${query.trim()}».`)}</p>
          )}
        </div>
      )}
    </div>
  );
}

const ago = (iso: string, locale: string) => {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return min < 60 ? relative.format(-min, "minute") : relative.format(-Math.round(min / 60), "hour");
};

/** The bell: new orders waiting for staff, newest first. */
function Notifications({
  orders,
  count,
  go,
}: {
  orders: OrdersOverview["orders"];
  count: number;
  go: (to: Screen) => boolean;
}) {
  const { locale, t } = useAdminLanguage();
  const panel = useRef<HTMLDivElement>(null);
  const fresh = orders.filter((o) => o.status === "new").slice(0, 6);
  const openOrders = () => go("orders") && panel.current?.hidePopover();
  return (
    <>
      <button
        type="button"
        className="icon-button"
        popoverTarget="notifications"
        aria-label={
          count
            ? t(`Notifications: ${count} new order${count === 1 ? "" : "s"}`, `التنبيهات: ${count} طلب جديد`)
            : t("Notifications", "التنبيهات")
        }
        title={t("Notifications", "التنبيهات")}
      >
        <Icon name="bell" />
        {count > 0 && <b className="count-badge">{count}</b>}
      </button>
      <div id="notifications" popover="auto" ref={panel} className="notifications">
        <h2>{t("Notifications", "التنبيهات")}</h2>
        {fresh.length ? (
          <ul>
            {fresh.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={openOrders}>
                  <Icon name="bag" size={18} />
                  <span>
                    <b>
                      {t(`New order #${o.id}`, `طلب جديد #${o.id}`)} · {o.name}
                    </b>
                    <small>
                      {formatAmount(o.total)} {t(currencyLabel, "ل.ل")} ·{" "}
                      {o.fulfilment === "pickup" ? t("Pickup", "استلام من المقهى") : t("Delivery", "توصيل")} ·{" "}
                      {ago(o.createdAt, locale)}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("No new orders right now.", "لا توجد طلبات جديدة حاليًا.")}</p>
        )}
        <button type="button" className="see-all" onClick={openOrders}>
          {t("Open orders", "فتح الطلبات")}
        </button>
      </div>
    </>
  );
}

const ORDER_SCREENS: Screen[] = ["orders", "stats", "payments", "settings", "activity"];
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
  const { t } = useAdminLanguage();
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
    document.title = n
      ? t(`(${n}) New order${n === 1 ? "" : "s"} · Arabica admin`, `(${n}) طلب جديد · إدارة أرابيكا`)
      : t("Arabica admin", "إدارة أرابيكا");
  }, [data, t]);

  const setStatus = useCallback(
    async (id: number, status: OrderStatus) => {
      await setOrderStatus(id, status);
      await refresh();
    },
    [refresh],
  );
  return { data, error, setStatus };
}
