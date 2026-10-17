"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  getSettings,
  saveAccount,
  saveShopSettings,
  testNotification,
  type SettingsData,
} from "@/lib/admin/backend";
import type { PaymentMethod, ShopSettings } from "@/lib/orders-core";
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
  const save = async () => {
    if (!shop) return;
    setBusy(true);
    setError("");
    try {
      const saved = await saveShopSettings(shop);
      setShop(saved);
      setData((d) => (d ? { ...d, shop: saved } : d));
      setLocalDirty(false);
      onSaved("Saved. The website uses the new settings right away.");
    } catch (e) {
      setError(errorText(e));
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

function SaveBar({ busy, dirty, onSave, onDiscard }: { busy: boolean; dirty: boolean; onSave: () => void; onDiscard: () => void }) {
  return (
    <div className="bottom-actions">
      <span>{busy ? "Saving…" : dirty ? "Unsaved changes" : "No changes"}</span>
      <div>
        <Button variant="secondary" disabled={!dirty || busy} onClick={onDiscard}>
          Discard
        </Button>
        <Button disabled={!dirty || busy} onClick={onSave}>
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

export function PaymentsScreen({ setDirty, onSaved }: { setDirty: (d: boolean) => void; onSaved: (m: string) => void }) {
  const s = useShopSettings(setDirty, onSaved);
  const methods = s.shop?.payments ?? [];
  const edit = (index: number, patch: Partial<PaymentMethod>) =>
    s.update({ payments: methods.map((m, i) => (i === index ? { ...m, ...patch } : m)) });

  return (
    <div className="page narrow-page">
      <PageHeader
        eyebrow="Online orders"
        title="Payment methods"
        description="Choose how customers can pay, and what they need to know for each method."
      />
      {s.error && <ErrorBanner message={s.error} onClose={() => s.setError("")} />}
      {!s.shop && !s.error && <p className="muted-text">Loading…</p>}
      {s.shop && (
        <>
          {!methods.some((m) => m.enabled) && (
            <div className="info-banner">Turn on at least one method, or customers can&apos;t place orders.</div>
          )}
          {methods.map((m, i) => (
            <section key={m.id} className="form-section payment-method">
              <SettingRow
                title={m.name || "New payment method"}
                toggle={<Toggle checked={m.enabled} onChange={(enabled) => edit(i, { enabled })} label={`Offer ${m.name}`} />}
              >
                {m.enabled ? "Customers can choose this when ordering." : "Hidden from customers."}
              </SettingRow>
              <div className="form-grid">
                <Field label="Name" required>
                  <input value={m.name} onChange={(e) => edit(i, { name: e.target.value })} placeholder="e.g. Whish Money" />
                </Field>
                <Field label="Name in Arabic">
                  <input dir="rtl" value={m.nameAr} onChange={(e) => edit(i, { nameAr: e.target.value })} />
                </Field>
              </div>
              <Field label="Instructions for customers" hint="Shown when they pick this method, e.g. the Whish number to send to.">
                <textarea
                  rows={2}
                  value={m.details}
                  onChange={(e) => edit(i, { details: e.target.value })}
                  placeholder="e.g. Send the total to Whish 03 123 456 and add your name."
                />
              </Field>
              <Field label="Instructions in Arabic">
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
          ))}
          <button
            type="button"
            className="add-row"
            onClick={() =>
              s.update({
                payments: [
                  ...methods,
                  { id: crypto.randomUUID().slice(0, 8), name: "", nameAr: "", details: "", detailsAr: "", enabled: true },
                ],
              })
            }
          >
            <Icon name="plus" /> Add a payment method
          </button>
          <SaveBar busy={s.busy} dirty={s.dirty} onSave={s.save} onDiscard={s.discard} />
        </>
      )}
    </div>
  );
}

/* ---------- Settings ---------- */

export function SettingsScreen({ setDirty, onSaved }: { setDirty: (d: boolean) => void; onSaved: (m: string) => void }) {
  const s = useShopSettings(setDirty, onSaved);
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
      <PageHeader eyebrow="Admin" title="Settings" description="Online orders, notifications and your admin login." />
      {s.error && <ErrorBanner message={s.error} onClose={() => s.setError("")} />}
      {!shop && !s.error && <p className="muted-text">Loading…</p>}
      {shop && s.data && (
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
              from the phone that should get the orders, then paste the key it sends you below.
            </SettingRow>
            <div className="form-grid">
              <Field label="Phone number" hint="With country code, e.g. +961 71 123 456">
                <input
                  type="tel"
                  value={shop.whatsapp.phone}
                  onChange={(e) => s.update({ whatsapp: { ...shop.whatsapp, phone: e.target.value } })}
                  placeholder="+961 …"
                />
              </Field>
              <Field label="CallMeBot key">
                <input
                  value={shop.whatsapp.apiKey}
                  onChange={(e) => s.update({ whatsapp: { ...shop.whatsapp, apiKey: e.target.value } })}
                  autoComplete="off"
                />
              </Field>
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

          <AccountSection data={s.data} onSaved={onSaved} />
          <SaveBar busy={s.busy} dirty={s.dirty} onSave={s.save} onDiscard={s.discard} />
        </>
      )}
    </div>
  );
}

function AccountSection({ data, onSaved }: { data: SettingsData; onSaved: (m: string) => void }) {
  const [username, setUsername] = useState(data.username);
  const [currentPassword, setCurrent] = useState("");
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
      await saveAccount({ currentPassword, username, newPassword });
      setCurrent("");
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
        <Field label="New password" hint="At least 8 characters. Leave empty to keep the current one.">
          <input type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Repeat new password">
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
      </div>
      <button type="submit" className="button primary" disabled={busy || !currentPassword}>
        {busy ? "Updating…" : "Update login"}
      </button>
    </form>
  );
}
