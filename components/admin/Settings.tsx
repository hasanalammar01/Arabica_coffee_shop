"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  getSettings,
  saveAccount,
  changeMyPassword,
  createStaff,
  deleteStaff,
  listStaff,
  savePin,
  saveShopSettings,
  signOutAllDevices,
  updateStaff,
  type StaffAccount,
  testNotification,
  type SettingsData,
} from "@/lib/admin/backend";
import { PAGE_LABELS, PAGES, STAFF_DEFAULT, type Page } from "@/lib/admin/permissions";
import { pinProblem } from "@/lib/admin/pin";
import {
  PAYMENT_KINDS,
  paymentReady,
  REQUIRED_FIELDS,
  type PaymentKind,
  type PaymentMethod,
  type ShopSettings,
} from "@/lib/orders-core";
import { Button, ErrorBanner, Field, Icon, PageHeader, Toggle } from "./ui";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Loads the settings once; `update` edits the draft, `save` stores it. */
function useShopSettings(setDirty: (d: boolean) => void, onSaved: (message: string) => void) {
  const [data, setData] = useState<SettingsData | null>(null);
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [dirty, setLocalDirty] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSettings()
      .then((d) => {
        setData(d);
        setShop(d.shop);
      })
      .catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => setDirty(dirty), [dirty, setDirty]);

  const update = (patch: Partial<ShopSettings>) => {
    setShop((s) => (s ? { ...s, ...patch } : s));
    setLocalDirty(true);
  };
  const save = async (currentPin = "") => {
    if (!shop) return;
    setBusy(true);
    setError("");
    try {
      const saved = await saveShopSettings(shop, currentPin);
      setShop(saved);
      setData((d) => (d ? { ...d, shop: saved } : d));
      setLocalDirty(false);
      onSaved("Saved. The website uses the new settings right away.");
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const discard = () => {
    setShop(data?.shop ?? null);
    setLocalDirty(false);
  };
  return { data, shop, dirty, error, setError, busy, update, save, discard };
}

function SaveBar({
  busy,
  dirty,
  onSave,
  onDiscard,
  blocked = false,
}: {
  busy: boolean;
  dirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
  blocked?: boolean;
}) {
  return (
    <div className="bottom-actions">
      <span>{busy ? "Saving…" : dirty ? "Unsaved changes" : "No changes"}</span>
      <div>
        <Button variant="secondary" disabled={!dirty || busy} onClick={onDiscard}>
          Discard
        </Button>
        <Button disabled={!dirty || busy || blocked} onClick={onSave}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function SettingRow({ title, children, toggle }: { title: string; children: ReactNode; toggle: ReactNode }) {
  return (
    <div className="setting-row">
      <div>
        <b>{title}</b>
        <p>{children}</p>
      </div>
      {toggle}
    </div>
  );
}

/* ---------- Payment methods ---------- */

const KIND_LABEL: Record<PaymentKind, string> = {
  cash: "Cash on delivery",
  whish: "Whish Money",
  card: "Card on delivery",
  bank: "Bank transfer",
  other: "Other",
};
const KIND_NAME_AR: Record<PaymentKind, string> = {
  cash: "الدفع نقداً عند الاستلام",
  whish: "ويش موني",
  card: "بطاقة عند الاستلام",
  bank: "تحويل مصرفي",
  other: "",
};
const KIND_HINT: Record<PaymentKind, string> = {
  cash: "Customers pay in cash when they receive the order. Nothing else to fill in.",
  whish: "Customers send the total to this Whish number, then you check it arrived.",
  card: "The driver (or the counter) takes the card on a card machine. Never type card numbers or CVVs here.",
  bank: "Customers transfer the total to this account. Only receiving details: never share passwords or card numbers.",
  other: "For anything else (OMT, a wallet…). Write exactly what customers should do.",
};
const FIELD_LABEL: Partial<Record<keyof PaymentMethod, string>> = {
  phone: "Whish phone number",
  accountName: "Account name",
  cards: "Accepted cards",
  bank: "Bank name",
  iban: "IBAN or account number",
  details: "Instructions",
};
const PLACEHOLDER: Partial<Record<keyof PaymentMethod, string>> = {
  phone: "e.g. 03 123 456",
  accountName: "Name on the account",
  cards: "e.g. Visa, Mastercard",
  bank: "e.g. Bank Audi",
  iban: "e.g. LB62 0999 0000 0001 0019 0122 9114",
  details: "e.g. Send the total by OMT to …",
};

const blankMethod = (): PaymentMethod => ({
  id: crypto.randomUUID().slice(0, 8),
  kind: "other",
  name: "",
  nameAr: "",
  enabled: true,
  phone: "",
  accountName: "",
  cards: "",
  bank: "",
  iban: "",
  details: "",
  detailsAr: "",
});

export function PaymentsScreen({ setDirty, onSaved }: { setDirty: (d: boolean) => void; onSaved: (m: string) => void }) {
  const s = useShopSettings(setDirty, onSaved);
  const methods = s.shop?.payments ?? [];
  const edit = (index: number, patch: Partial<PaymentMethod>) =>
    s.update({ payments: methods.map((m, i) => (i === index ? { ...m, ...patch } : m)) });

  // Switching the type renames a method that still has the old type's default name.
  const changeKind = (index: number, kind: PaymentKind) => {
    const m = methods[index];
    const defaultName = !m.name || m.name === KIND_LABEL[m.kind];
    edit(index, {
      kind,
      ...(defaultName && { name: kind === "other" ? "" : KIND_LABEL[kind], nameAr: KIND_NAME_AR[kind] }),
    });
  };

  return (
    <div className="page narrow-page">
      <PageHeader
        eyebrow="Online orders"
        title="Payment methods"
        description="Choose how customers can pay, and fill in the details each method needs."
      />
      {s.error && <ErrorBanner message={s.error} onClose={() => s.setError("")} />}
      {!s.shop && !s.error && <p className="muted-text">Loading…</p>}
      {s.shop && (
        <>
          {!methods.some(paymentReady) && (
            <div className="info-banner">Turn on at least one complete method, or customers can&apos;t place orders.</div>
          )}
          {methods.map((m, i) => {
            const missing = REQUIRED_FIELDS[m.kind].filter((f) => !String(m[f]).trim());
            return (
              <section key={m.id} className="form-section payment-method">
                <SettingRow
                  title={m.name || "New payment method"}
                  toggle={<Toggle checked={m.enabled} onChange={(enabled) => edit(i, { enabled })} label={`Offer ${m.name}`} />}
                >
                  {!m.enabled
                    ? "Hidden from customers."
                    : missing.length
                      ? `Hidden from customers until you fill in: ${missing.map((f) => FIELD_LABEL[f]).join(", ")}.`
                      : "Customers can choose this when ordering."}
                </SettingRow>
                <Field label="Type" hint={KIND_HINT[m.kind]}>
                  <select value={m.kind} onChange={(e) => changeKind(i, e.target.value as PaymentKind)}>
                    {PAYMENT_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="form-grid">
                  <Field label="Name customers see" required>
                    <input value={m.name} onChange={(e) => edit(i, { name: e.target.value })} placeholder="e.g. Whish Money" />
                  </Field>
                  <Field label="Name in Arabic">
                    <input dir="rtl" value={m.nameAr} onChange={(e) => edit(i, { nameAr: e.target.value })} />
                  </Field>
                  {REQUIRED_FIELDS[m.kind]
                    .filter((f) => f !== "details")
                    .map((f) => (
                      <Field key={f} label={FIELD_LABEL[f]!} required>
                        <input
                          value={String(m[f])}
                          onChange={(e) => edit(i, { [f]: e.target.value })}
                          placeholder={PLACEHOLDER[f]}
                          dir={f === "phone" || f === "iban" ? "ltr" : undefined}
                          inputMode={f === "phone" ? "tel" : undefined}
                          autoComplete="off"
                          className={m.enabled && missing.includes(f) ? "error" : ""}
                        />
                      </Field>
                    ))}
                </div>
                <Field
                  label={m.kind === "other" ? "Instructions for customers" : "Extra note (optional)"}
                  required={m.kind === "other"}
                  hint={m.kind === "other" ? undefined : "e.g. Send a screenshot of the transfer on WhatsApp."}
                >
                  <textarea
                    rows={2}
                    value={m.details}
                    onChange={(e) => edit(i, { details: e.target.value })}
                    placeholder={m.kind === "other" ? PLACEHOLDER.details : undefined}
                  />
                </Field>
                <Field label={m.kind === "other" ? "Instructions in Arabic" : "Extra note in Arabic"}>
                  <textarea rows={2} dir="rtl" value={m.detailsAr} onChange={(e) => edit(i, { detailsAr: e.target.value })} />
                </Field>
                <button
                  type="button"
                  className="delete-item-button"
                  onClick={() => s.update({ payments: methods.filter((_, j) => j !== i) })}
                >
                  <Icon name="trash" /> Remove this method
                </button>
              </section>
            );
          })}
          <button type="button" className="add-row" onClick={() => s.update({ payments: [...methods, blankMethod()] })}>
            <Icon name="plus" /> Add a payment method
          </button>
          <SaveBar busy={s.busy} dirty={s.dirty} onSave={() => s.save()} onDiscard={s.discard} />
        </>
      )}
    </div>
  );
}

/* ---------- Settings ---------- */

export function SettingsScreen({
  setDirty,
  onSaved,
  pages,
}: {
  setDirty: (d: boolean) => void;
  onSaved: (m: string) => void;
  pages: Page[];
}) {
  const s = useShopSettings(setDirty, onSaved);
  const isAdmin = s.data?.role === "admin";
  // Ordering and notifications: the super admin, or staff given "Settings".
  const canSettings = isAdmin || pages.includes("settings");
  const [pinOverride, setPinOverride] = useState<boolean | null>(null);
  const pinSet = pinOverride ?? Boolean(s.data?.pinSet);
  // The WhatsApp number also receives "forgot PIN" codes, so changing it asks for the PIN.
  const [whatsappPin, setWhatsappPin] = useState("");
  const saved = s.data?.shop?.whatsapp;
  const numberChanged =
    pinSet && Boolean(s.shop && saved) && (s.shop!.whatsapp.phone !== saved!.phone || s.shop!.whatsapp.apiKey !== saved!.apiKey);
  const [testing, setTesting] = useState<"whatsapp" | "email" | null>(null);
  const [testResult, setTestResult] = useState("");

  const test = async (channel: "whatsapp" | "email") => {
    setTesting(channel);
    setTestResult("");
    try {
      await testNotification(channel);
      setTestResult(channel === "whatsapp" ? "Test sent. Check WhatsApp on that phone." : "Test sent. Check the inbox (and spam).");
    } catch (e) {
      setTestResult(errorText(e));
    } finally {
      setTesting(null);
    }
  };

  const shop = s.shop;
  return (
    <div className="page narrow-page">
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        description={canSettings ? "Online orders, notifications and your login." : "Your login."}
      />
      {s.error && <ErrorBanner message={s.error} onClose={() => s.setError("")} />}
      {!s.data && !s.error && <p className="muted-text">Loading…</p>}
      {s.data && (
        <>
          {canSettings && shop && (
          <>
          <section className="form-section">
            <div className="section-title">
              <h2>Online orders</h2>
              <p>When on, customers see an Add button on the menu and can order during opening hours.</p>
            </div>
            <SettingRow
              title="Accept online orders"
              toggle={
                <Toggle
                  checked={shop.ordersEnabled}
                  onChange={(ordersEnabled) => s.update({ ordersEnabled })}
                  label="Accept online orders"
                />
              }
            >
              {shop.ordersEnabled ? "On: the menu takes orders." : "Off: the menu is view-only."}
            </SettingRow>
            {shop.ordersEnabled && !shop.payments.some((p) => p.enabled) && (
              <div className="info-banner">No payment method is turned on, so customers can&apos;t finish an order yet.</div>
            )}
          </section>

          <section className="form-section">
            <div className="section-title">
              <h2>Notifications</h2>
              <p>Get a message for every new order. Save before sending a test.</p>
            </div>
            <SettingRow
              title="WhatsApp"
              toggle={
                <Toggle
                  checked={shop.whatsapp.enabled}
                  onChange={(enabled) => s.update({ whatsapp: { ...shop.whatsapp, enabled } })}
                  label="WhatsApp notifications"
                />
              }
            >
              Free, through CallMeBot. One-time setup: follow the steps on{" "}
              <a href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noreferrer">
                callmebot.com
              </a>{" "}
              from the phone that should get the orders, then paste the key it sends you below. This number
              also receives the code if the sign-in PIN is forgotten.
            </SettingRow>
            <div className="form-grid">
              <Field label="Phone number" hint="With country code, e.g. +961 71 123 456">
                <input
                  type="tel"
                  value={shop.whatsapp.phone}
                  onChange={(e) => s.update({ whatsapp: { ...shop.whatsapp, phone: e.target.value } })}
                  placeholder="+961 …"
                  disabled={!isAdmin}
                  title={isAdmin ? undefined : "Only the super admin can change this number."}
                />
              </Field>
              {isAdmin ? (
                <Field label="CallMeBot key">
                  <input
                    value={shop.whatsapp.apiKey}
                    onChange={(e) => s.update({ whatsapp: { ...shop.whatsapp, apiKey: e.target.value } })}
                    autoComplete="off"
                  />
                </Field>
              ) : (
                <p className="field-hint">Only the super admin can change the WhatsApp number and key.</p>
              )}
              {numberChanged && (
                <Field label="Your PIN" required hint="Needed to change the number or key, which receive PIN reset codes.">
                  <PinInput value={whatsappPin} onChange={setWhatsappPin} autoComplete="off" />
                </Field>
              )}
            </div>
            <Button variant="secondary" disabled={s.dirty || testing !== null} onClick={() => test("whatsapp")}>
              {testing === "whatsapp" ? "Sending…" : "Send a test WhatsApp"}
            </Button>

            <hr />
            <SettingRow
              title="Email"
              toggle={
                <Toggle
                  checked={shop.email.enabled}
                  onChange={(enabled) => s.update({ email: { ...shop.email, enabled } })}
                  label="Email notifications"
                />
              }
            >
              {s.data.emailReady
                ? "Each new order is emailed to this address."
                : "Email isn't connected yet: add RESEND_API_KEY in Vercel (see README), then redeploy."}
            </SettingRow>
            <Field label="Email address">
              <input
                type="email"
                value={shop.email.address}
                onChange={(e) => s.update({ email: { ...shop.email, address: e.target.value } })}
                placeholder="name@example.com"
              />
            </Field>
            <Button variant="secondary" disabled={s.dirty || testing !== null} onClick={() => test("email")}>
              {testing === "email" ? "Sending…" : "Send a test email"}
            </Button>
            {testResult && (
              <p className="field-hint" role="status">
                {testResult}
              </p>
            )}
          </section>
          </>
          )}

          {isAdmin ? (
            <>
              <AccountSection data={s.data} pinSet={pinSet} onSaved={onSaved} />
              <DevicesSection onSaved={onSaved} />
              <PinSection
                pinSet={pinSet}
                onSaved={(m) => {
                  setPinOverride(true);
                  onSaved(m);
                }}
              />
              <StaffSection onSaved={onSaved} />
            </>
          ) : (
            <MyAccountSection username={s.data.username} onSaved={onSaved} />
          )}
          {canSettings && shop && (
          <SaveBar
            busy={s.busy}
            dirty={s.dirty}
            blocked={numberChanged && whatsappPin.length !== 4}
            onSave={async () => {
              if (await s.save(numberChanged ? whatsappPin : "")) setWhatsappPin("");
            }}
            onDiscard={() => {
              s.discard();
              setWhatsappPin("");
            }}
          />
          )}
        </>
      )}
    </div>
  );
}

/** A 4-digit PIN box: digits only, number keypad on phones. */
function PinInput({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  return (
    <input
      className="pin-input small"
      type="password"
      inputMode="numeric"
      pattern="[0-9]{4}"
      maxLength={4}
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
    />
  );
}

function AccountSection({ data, pinSet, onSaved }: { data: SettingsData; pinSet: boolean; onSaved: (m: string) => void }) {
  const [username, setUsername] = useState(data.username);
  const [currentPassword, setCurrent] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) return setError("The two new passwords don't match.");
    setBusy(true);
    setError("");
    try {
      await saveAccount({ currentPassword, currentPin, username, newPassword });
      setCurrent("");
      setCurrentPin("");
      setNew("");
      setConfirm("");
      onSaved(newPassword ? "Login updated. Other devices are signed out." : "Username updated.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-section" onSubmit={submit}>
      <div className="section-title">
        <h2>Admin login</h2>
        <p>
          {data.passwordInDatabase
            ? "Change the username or password used to sign in here."
            : "The password is currently the one set in Vercel (ADMIN_PASSWORD). Once you change it here, the new one is used instead."}
        </p>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="form-grid">
        <Field label="Username" required>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </Field>
        <Field label="Current password" required>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        {pinSet && (
          <Field label="PIN" required>
            <PinInput value={currentPin} onChange={setCurrentPin} autoComplete="off" />
          </Field>
        )}
        <Field label="New password" hint="At least 10 characters, not containing the username. Leave empty to keep the current one.">
          <input type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Repeat new password">
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
      </div>
      <button type="submit" className="button primary" disabled={busy || !currentPassword || (pinSet && currentPin.length !== 4)}>
        {busy ? "Updating…" : "Update login"}
      </button>
    </form>
  );
}

/** "Sign out all devices": for a lost phone or a shared computer. */
function DevicesSection({ onSaved }: { onSaved: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="form-section">
      <div className="section-title">
        <h2>Signed-in devices</h2>
        <p>Lost a phone, or signed in on someone else&apos;s computer? Sign out everywhere; this device stays signed in.</p>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <Button
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await signOutAllDevices();
            onSaved("Every other device is signed out.");
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing out…" : "Sign out all other devices"}
      </Button>
    </section>
  );
}

function PinSection({ pinSet, onSaved }: { pinSet: boolean; onSaved: (m: string) => void }) {
  const [currentPassword, setCurrent] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = pinProblem(newPin) ?? (newPin !== confirm ? "The two new PINs don't match." : null);
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      await savePin({ currentPassword, currentPin, newPin });
      setCurrent("");
      setCurrentPin("");
      setNewPin("");
      setConfirm("");
      onSaved(pinSet ? "PIN changed. Other devices are signed out." : "PIN created. It's now asked for at every sign-in.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-section" onSubmit={submit}>
      <div className="section-title">
        <h2>Sign-in PIN</h2>
        <p>
          {pinSet
            ? "After the password, the admin asks for this 4-digit PIN. It's also needed to change the login."
            : "Add a 4-digit PIN as a second step after the password. Recommended: it keeps the admin safe even if the password leaks."}
        </p>
      </div>
      {!pinSet && <div className="info-banner">No PIN yet. Anyone with the password can open the admin.</div>}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="form-grid">
        <Field label="Current password" required>
          <input type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </Field>
        {pinSet ? (
          <Field label="Current PIN" required>
            <PinInput value={currentPin} onChange={setCurrentPin} autoComplete="off" />
          </Field>
        ) : (
          <span aria-hidden />
        )}
        <Field label={pinSet ? "New PIN" : "PIN"} required hint="4 digits. Not 0000, 1234 or similar.">
          <PinInput value={newPin} onChange={setNewPin} autoComplete="new-password" />
        </Field>
        <Field label="Repeat the PIN" required>
          <PinInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </Field>
      </div>
      <button
        type="submit"
        className="button primary"
        disabled={busy || !currentPassword || (pinSet && currentPin.length !== 4) || newPin.length !== 4 || confirm.length !== 4}
      >
        {busy ? "Saving…" : pinSet ? "Change PIN" : "Create PIN"}
      </button>
    </form>
  );
}

/* ---------- Staff: their own password ---------- */

function MyAccountSection({ username, onSaved }: { username: string; onSaved: (m: string) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return setError("The two new passwords don't match.");
    setBusy(true);
    setError("");
    try {
      await changeMyPassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      onSaved("Password changed. Your other devices are signed out.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="form-section" onSubmit={submit}>
      <div className="section-title">
        <h2>My account</h2>
        <p>
          Signed in as <b>{username}</b>. To change your username or access, ask the super admin.
        </p>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="form-grid">
        <Field label="Current password" required>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </Field>
        <span aria-hidden />
        <Field label="New password" required hint="At least 10 characters, not containing your username.">
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Repeat new password" required>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
      </div>
      <button type="submit" className="button primary" disabled={busy || !current || !next || !confirm}>
        {busy ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}

/* ---------- Super admin: staff accounts ---------- */

function PageChecks({ value, onChange }: { value: Page[]; onChange: (pages: Page[]) => void }) {
  return (
    <div className="page-checks" role="group" aria-label="Pages this person can open">
      {PAGES.map((p) => (
        <label key={p}>
          <input
            type="checkbox"
            checked={value.includes(p)}
            onChange={() =>
              onChange(value.includes(p) ? value.filter((x) => x !== p) : PAGES.filter((x) => x === p || value.includes(x)))
            }
          />
          {PAGE_LABELS[p]}
        </label>
      ))}
    </div>
  );
}

function StaffSection({ onSaved }: { onSaved: (m: string) => void }) {
  const [staff, setStaff] = useState<StaffAccount[] | null>(null);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pages, setPages] = useState<Page[]>(STAFF_DEFAULT);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listStaff().then(setStaff, (e) => setError(errorText(e)));
  }, []);

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await job();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const replace = (row: StaffAccount) => setStaff((list) => (list ?? []).map((s) => (s.id === row.id ? row : s)));

  const add = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const row = await createStaff({ username, password, pages });
      setStaff((list) => [...(list ?? []), row].sort((a, b) => a.username.localeCompare(b.username)));
      setUsername("");
      setPassword("");
      setPages(STAFF_DEFAULT);
      onSaved(`Account "${row.username}" created. Give them the username and password.`);
    });
  };

  return (
    <section className="form-section">
      <div className="section-title">
        <h2>Staff accounts</h2>
        <p>
          Staff sign in on this same page with their own username and password, and only see the pages you tick. They
          can never manage staff or change your login, PIN or the WhatsApp number.
        </p>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {!staff && !error && <p className="muted-text">Loading…</p>}
      {staff?.length === 0 && <p className="muted-text">No staff accounts yet.</p>}
      <div className="staff-list">
        {staff?.map((s) => (
          <StaffRow
            key={s.id}
            account={s}
            busy={busy}
            run={run}
            onChange={replace}
            onDeleted={() => setStaff((l) => (l ?? []).filter((x) => x.id !== s.id))}
            onSaved={onSaved}
          />
        ))}
      </div>

      <form className="staff-add" onSubmit={add}>
        <h3>Add a staff member</h3>
        <div className="form-grid">
          <Field label="Username" required hint="3–40 letters, numbers, dots, dashes or underscores.">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              autoComplete="off"
              autoCapitalize="none"
            />
          </Field>
          <Field label="Password" required hint="At least 10 characters. Give it to them privately.">
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
        <span className="field-label">Pages they can open</span>
        <PageChecks value={pages} onChange={setPages} />
        <button type="submit" className="button primary" disabled={busy || !username || !password}>
          {busy ? "Saving…" : "Create account"}
        </button>
      </form>
    </section>
  );
}

function StaffRow({
  account: s,
  busy,
  run,
  onChange,
  onDeleted,
  onSaved,
}: {
  account: StaffAccount;
  busy: boolean;
  run: (job: () => Promise<void>) => void;
  onChange: (row: StaffAccount) => void;
  onDeleted: () => void;
  onSaved: (m: string) => void;
}) {
  const [pages, setPages] = useState(s.pages);
  const [password, setPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const changed = pages.join() !== s.pages.join();
  return (
    <div className={`staff-row ${s.active ? "" : "disabled"}`}>
      <div className="staff-row-head">
        <b>{s.username}</b>
        <span className={`status-badge ${s.active ? "accepted" : ""}`}>{s.active ? "Active" : "Disabled"}</span>
      </div>
      <PageChecks value={pages} onChange={setPages} />
      <div className="staff-row-actions">
        <Button
          variant="secondary"
          disabled={busy || !changed}
          onClick={() =>
            run(async () => {
              onChange(await updateStaff({ id: s.id, pages }));
              onSaved(`Access for "${s.username}" saved. They're signed out and see the new pages next time.`);
            })
          }
        >
          Save access
        </Button>
        <input
          className="staff-password"
          type="text"
          placeholder="New password"
          aria-label={`New password for ${s.username}`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <Button
          variant="secondary"
          disabled={busy || !password}
          onClick={() =>
            run(async () => {
              onChange(await updateStaff({ id: s.id, password }));
              setPassword("");
              onSaved(`New password set for "${s.username}". They're signed out.`);
            })
          }
        >
          Set password
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              onChange(await updateStaff({ id: s.id, active: !s.active }));
              onSaved(s.active ? `"${s.username}" is disabled and signed out.` : `"${s.username}" can sign in again.`);
            })
          }
        >
          {s.active ? "Disable" : "Enable"}
        </Button>
        <Button
          variant={confirmDelete ? "danger" : "ghost"}
          disabled={busy}
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true);
            run(async () => {
              await deleteStaff(s.id);
              onDeleted();
              onSaved(`"${s.username}" deleted.`);
            });
          }}
        >
          {confirmDelete ? "Tap again to delete" : "Delete"}
        </Button>
      </div>
    </div>
  );
}
