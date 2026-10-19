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
import { credentialsPdf } from "@/lib/admin/credentials-pdf";
import { generatePassword } from "@/lib/admin/password";
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
import { useAdminLanguage } from "./Language";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Loads the settings once; `update` edits the draft, `save` stores it. */
function useShopSettings(setDirty: (d: boolean) => void, onSaved: (message: string) => void) {
  const { t } = useAdminLanguage();
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
      onSaved(
        t(
          "Saved. The website uses the new settings right away.",
          "تم الحفظ. يستخدم الموقع الإعدادات الجديدة فورًا.",
        ),
      );
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
  const { t } = useAdminLanguage();
  return (
    <div className="bottom-actions">
      <span>
        {busy
          ? t("Saving…", "جارٍ الحفظ…")
          : dirty
            ? t("Unsaved changes", "تغييرات غير محفوظة")
            : t("No changes", "لا توجد تغييرات")}
      </span>
      <div>
        <Button variant="secondary" disabled={!dirty || busy} onClick={onDiscard}>
          {t("Discard", "تجاهل")}
        </Button>
        <Button disabled={!dirty || busy || blocked} onClick={onSave}>
          {busy ? t("Saving…", "جارٍ الحفظ…") : t("Save", "حفظ")}
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

export function PaymentsScreen({
  setDirty,
  onSaved,
}: {
  setDirty: (d: boolean) => void;
  onSaved: (m: string) => void;
}) {
  const { lang, t } = useAdminLanguage();
  const s = useShopSettings(setDirty, onSaved);
  const KIND_HINT: Record<PaymentKind, string> = {
    cash: t(
      "Customers pay in cash when they receive the order. Nothing else to fill in.",
      "يدفع العملاء نقدًا عند استلام الطلب. لا حاجة إلى تفاصيل إضافية.",
    ),
    whish: t(
      "Customers send the total to this Whish number, then you check it arrived.",
      "يرسل العملاء المبلغ إلى رقم ويش هذا، ثم تتحقق من وصوله.",
    ),
    card: t(
      "The driver (or the counter) takes the card on a card machine. Never type card numbers or CVVs here.",
      "يستقبل السائق أو موظف الصندوق الدفع عبر جهاز البطاقات. لا تُدخل أرقام البطاقات أو رموز الأمان هنا.",
    ),
    bank: t(
      "Customers transfer the total to this account. Only receiving details: never share passwords or card numbers.",
      "يحوّل العملاء المبلغ إلى هذا الحساب. أدخل بيانات الاستلام فقط، ولا تشارك كلمات المرور أو أرقام البطاقات.",
    ),
    other: t(
      "For anything else (OMT, a wallet…). Write exactly what customers should do.",
      "للطرق الأخرى مثل OMT أو المحافظ الإلكترونية. وضّح للعملاء الخطوات المطلوبة.",
    ),
  };
  const FIELD_LABEL: Partial<Record<keyof PaymentMethod, string>> = {
    phone: t("Whish phone number", "رقم هاتف ويش"),
    accountName: t("Account name", "اسم الحساب"),
    cards: t("Accepted cards", "البطاقات المقبولة"),
    bank: t("Bank name", "اسم المصرف"),
    iban: t("IBAN or account number", "رقم الحساب أو IBAN"),
    details: t("Instructions", "التعليمات"),
  };
  const PLACEHOLDER: Partial<Record<keyof PaymentMethod, string>> = {
    phone: t("e.g. 03 123 456", "مثال: 03 123 456"),
    accountName: t("Name on the account", "الاسم المسجّل على الحساب"),
    cards: t("e.g. Visa, Mastercard", "مثال: Visa، Mastercard"),
    bank: t("e.g. Bank Audi", "مثال: بنك عوده"),
    iban: t("e.g. LB62 0999 0000 0001 0019 0122 9114", "مثال: LB62 0999 0000 0001 0019 0122 9114"),
    details: t("e.g. Send the total by OMT to …", "مثال: أرسل المبلغ عبر OMT إلى …"),
  };
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
        eyebrow={t("Online orders", "الطلبات الإلكترونية")}
        title={t("Payment methods", "طرق الدفع")}
        description={t(
          "Choose how customers can pay, and fill in the details each method needs.",
          "اختر طرق الدفع المتاحة للعملاء وأدخل التفاصيل المطلوبة لكل طريقة.",
        )}
      />
      {s.error && <ErrorBanner message={s.error} onClose={() => s.setError("")} />}
      {!s.shop && !s.error && <p className="muted-text">{t("Loading…", "جارٍ التحميل…")}</p>}
      {s.shop && (
        <>
          {!methods.some(paymentReady) && (
            <div className="info-banner">
              {t(
                "Turn on at least one complete method, or customers can't place orders.",
                "فعّل طريقة دفع مكتملة واحدة على الأقل ليتمكن العملاء من إرسال الطلبات.",
              )}
            </div>
          )}
          {methods.map((m, i) => {
            const missing = REQUIRED_FIELDS[m.kind].filter((f) => !String(m[f]).trim());
            return (
              <section key={m.id} className="form-section payment-method">
                <SettingRow
                  title={
                    (lang === "ar" ? m.nameAr || m.name : m.name) ||
                    t("New payment method", "طريقة دفع جديدة")
                  }
                  toggle={
                    <Toggle
                      checked={m.enabled}
                      onChange={(enabled) => edit(i, { enabled })}
                      label={t(`Offer ${m.name}`, `إتاحة ${m.nameAr || m.name}`)}
                    />
                  }
                >
                  {!m.enabled
                    ? t("Hidden from customers.", "مخفية عن العملاء.")
                    : missing.length
                      ? t(
                          `Hidden from customers until you fill in: ${missing.map((f) => FIELD_LABEL[f]).join(", ")}.`,
                          `مخفية عن العملاء حتى تُكمل: ${missing.map((f) => FIELD_LABEL[f]).join("، ")}.`,
                        )
                      : t("Customers can choose this when ordering.", "يمكن للعملاء اختيارها عند الطلب.")}
                </SettingRow>
                <Field label={t("Type", "النوع")} hint={KIND_HINT[m.kind]}>
                  <select value={m.kind} onChange={(e) => changeKind(i, e.target.value as PaymentKind)}>
                    {PAYMENT_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t(KIND_LABEL[k], KIND_NAME_AR[k] || "أخرى")}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="form-grid">
                  <Field label={t("Name customers see", "الاسم الظاهر للعملاء")} required>
                    <input
                      dir="ltr"
                      value={m.name}
                      onChange={(e) => edit(i, { name: e.target.value })}
                      placeholder={t("e.g. Whish Money", "مثال: Whish Money")}
                    />
                  </Field>
                  <Field label={t("Name in Arabic", "الاسم بالعربية")}>
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
                  label={
                    m.kind === "other"
                      ? t("Instructions for customers", "تعليمات للعملاء")
                      : t("Extra note (optional)", "ملاحظة إضافية (اختياري)")
                  }
                  required={m.kind === "other"}
                  hint={
                    m.kind === "other"
                      ? undefined
                      : t(
                          "e.g. Send a screenshot of the transfer on WhatsApp.",
                          "مثال: أرسل لقطة شاشة للحوالة عبر واتساب.",
                        )
                  }
                >
                  <textarea
                    rows={2}
                    dir="ltr"
                    value={m.details}
                    onChange={(e) => edit(i, { details: e.target.value })}
                    placeholder={m.kind === "other" ? PLACEHOLDER.details : undefined}
                  />
                </Field>
                <Field
                  label={
                    m.kind === "other"
                      ? t("Instructions in Arabic", "التعليمات بالعربية")
                      : t("Extra note in Arabic", "ملاحظة إضافية بالعربية")
                  }
                >
                  <textarea
                    rows={2}
                    dir="rtl"
                    value={m.detailsAr}
                    onChange={(e) => edit(i, { detailsAr: e.target.value })}
                  />
                </Field>
                <button
                  type="button"
                  className="delete-item-button"
                  onClick={() => s.update({ payments: methods.filter((_, j) => j !== i) })}
                >
                  <Icon name="trash" /> {t("Remove this method", "إزالة هذه الطريقة")}
                </button>
              </section>
            );
          })}
          <button
            type="button"
            className="add-row"
            onClick={() => s.update({ payments: [...methods, blankMethod()] })}
          >
            <Icon name="plus" /> {t("Add a payment method", "إضافة طريقة دفع")}
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
  const { t, localizeError } = useAdminLanguage();
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
    pinSet &&
    Boolean(s.shop && saved) &&
    (s.shop!.whatsapp.phone !== saved!.phone || s.shop!.whatsapp.apiKey !== saved!.apiKey);
  const [testing, setTesting] = useState<"whatsapp" | "email" | null>(null);
  const [testResult, setTestResult] = useState("");

  const test = async (channel: "whatsapp" | "email") => {
    setTesting(channel);
    setTestResult("");
    try {
      await testNotification(channel);
      setTestResult(
        channel === "whatsapp"
          ? t("Test sent. Check WhatsApp on that phone.", "تم إرسال الاختبار. تحقق من واتساب على ذلك الهاتف.")
          : t(
              "Test sent. Check the inbox (and spam).",
              "تم إرسال الاختبار. تحقق من البريد الوارد والبريد غير المرغوب فيه.",
            ),
      );
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
        eyebrow={t("Admin", "الإدارة")}
        title={t("Settings", "الإعدادات")}
        description={
          canSettings
            ? t(
                "Online orders, notifications and your login.",
                "الطلبات الإلكترونية والإشعارات وبيانات دخولك.",
              )
            : t("Your login.", "بيانات دخولك.")
        }
      />
      {s.error && <ErrorBanner message={s.error} onClose={() => s.setError("")} />}
      {!s.data && !s.error && <p className="muted-text">{t("Loading…", "جارٍ التحميل…")}</p>}
      {s.data && (
        <>
          {canSettings && shop && (
            <>
              <section className="form-section">
                <div className="section-title">
                  <h2>{t("Online orders", "الطلبات الإلكترونية")}</h2>
                  <p>
                    {t(
                      "When on, customers see an Add button on the menu and can order during opening hours.",
                      "عند التفعيل، يظهر زر إضافة في القائمة ويمكن للعملاء الطلب خلال ساعات العمل.",
                    )}
                  </p>
                </div>
                <SettingRow
                  title={t("Accept online orders", "استقبال الطلبات الإلكترونية")}
                  toggle={
                    <Toggle
                      checked={shop.ordersEnabled}
                      onChange={(ordersEnabled) => s.update({ ordersEnabled })}
                      label={t("Accept online orders", "استقبال الطلبات الإلكترونية")}
                    />
                  }
                >
                  {shop.ordersEnabled
                    ? t("On: the menu takes orders.", "مفعّل: تستقبل القائمة الطلبات.")
                    : t("Off: the menu is view-only.", "متوقف: القائمة للعرض فقط.")}
                </SettingRow>
                {shop.ordersEnabled && !shop.payments.some((p) => p.enabled) && (
                  <div className="info-banner">
                    {t(
                      "No payment method is turned on, so customers can't finish an order yet.",
                      "لم تُفعّل أي طريقة دفع، لذلك لا يمكن للعملاء إتمام الطلب بعد.",
                    )}
                  </div>
                )}
              </section>

              <section className="form-section">
                <div className="section-title">
                  <h2>{t("Notifications", "الإشعارات")}</h2>
                  <p>
                    {t(
                      "Get a message for every new order. Save before sending a test.",
                      "تلقَّ إشعارًا لكل طلب جديد. احفظ التغييرات قبل إرسال اختبار.",
                    )}
                  </p>
                </div>
                <SettingRow
                  title={t("WhatsApp", "واتساب")}
                  toggle={
                    <Toggle
                      checked={shop.whatsapp.enabled}
                      onChange={(enabled) => s.update({ whatsapp: { ...shop.whatsapp, enabled } })}
                      label={t("WhatsApp notifications", "إشعارات واتساب")}
                    />
                  }
                >
                  {t(
                    "Free, through CallMeBot. One-time setup: follow the steps on",
                    "مجانًا عبر CallMeBot. للإعداد مرة واحدة، اتبع الخطوات على",
                  )}{" "}
                  <a
                    href="https://www.callmebot.com/blog/free-api-whatsapp-messages/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    callmebot.com
                  </a>{" "}
                  {t(
                    "from the phone that should get the orders, then paste the key it sends you below. This number also receives the code if the sign-in PIN is forgotten.",
                    "من الهاتف المخصّص لاستقبال الطلبات، ثم ألصق المفتاح الذي يصلك أدناه. يستقبل هذا الرقم أيضًا رمز الاستعادة عند نسيان رمز PIN.",
                  )}
                </SettingRow>
                <div className="form-grid">
                  <Field
                    label={t("Phone number", "رقم الهاتف")}
                    hint={t(
                      "With country code, e.g. +961 71 123 456",
                      "مع رمز الدولة، مثال: ‎+961 71 123 456",
                    )}
                  >
                    <input
                      type="tel"
                      dir="ltr"
                      value={shop.whatsapp.phone}
                      onChange={(e) => s.update({ whatsapp: { ...shop.whatsapp, phone: e.target.value } })}
                      placeholder="+961 …"
                      disabled={!isAdmin}
                      title={
                        isAdmin
                          ? undefined
                          : t(
                              "Only the super admin can change this number.",
                              "يمكن للمسؤول الرئيسي فقط تغيير هذا الرقم.",
                            )
                      }
                    />
                  </Field>
                  {isAdmin ? (
                    <Field label={t("CallMeBot key", "مفتاح CallMeBot")}>
                      <input
                        dir="ltr"
                        value={shop.whatsapp.apiKey}
                        onChange={(e) => s.update({ whatsapp: { ...shop.whatsapp, apiKey: e.target.value } })}
                        autoComplete="off"
                      />
                    </Field>
                  ) : (
                    <p className="field-hint">
                      {t(
                        "Only the super admin can change the WhatsApp number and key.",
                        "يمكن للمسؤول الرئيسي فقط تغيير رقم واتساب والمفتاح.",
                      )}
                    </p>
                  )}
                  {numberChanged && (
                    <Field
                      label={t("Your PIN", "رمز PIN الخاص بك")}
                      required
                      hint={t(
                        "Needed to change the number or key, which receive PIN reset codes.",
                        "مطلوب لتغيير الرقم أو المفتاح المستخدمَين لاستقبال رموز إعادة تعيين PIN.",
                      )}
                    >
                      <PinInput value={whatsappPin} onChange={setWhatsappPin} autoComplete="off" />
                    </Field>
                  )}
                </div>
                <Button
                  variant="secondary"
                  disabled={s.dirty || testing !== null}
                  onClick={() => test("whatsapp")}
                >
                  {testing === "whatsapp"
                    ? t("Sending…", "جارٍ الإرسال…")
                    : t("Send a test WhatsApp", "إرسال اختبار عبر واتساب")}
                </Button>

                <hr />
                <SettingRow
                  title={t("Email", "البريد الإلكتروني")}
                  toggle={
                    <Toggle
                      checked={shop.email.enabled}
                      onChange={(enabled) => s.update({ email: { ...shop.email, enabled } })}
                      label={t("Email notifications", "إشعارات البريد الإلكتروني")}
                    />
                  }
                >
                  {s.data.emailReady
                    ? t(
                        "Each new order is emailed to this address.",
                        "يُرسل كل طلب جديد إلى عنوان البريد هذا.",
                      )
                    : t(
                        "Email isn't connected yet: add RESEND_API_KEY in Vercel (see README), then redeploy.",
                        "البريد الإلكتروني غير متصل بعد: أضف RESEND_API_KEY في Vercel (راجع README)، ثم أعد النشر.",
                      )}
                </SettingRow>
                <Field label={t("Email address", "عنوان البريد الإلكتروني")}>
                  <input
                    type="email"
                    dir="ltr"
                    value={shop.email.address}
                    onChange={(e) => s.update({ email: { ...shop.email, address: e.target.value } })}
                    placeholder="name@example.com"
                  />
                </Field>
                <Button
                  variant="secondary"
                  disabled={s.dirty || testing !== null}
                  onClick={() => test("email")}
                >
                  {testing === "email"
                    ? t("Sending…", "جارٍ الإرسال…")
                    : t("Send a test email", "إرسال بريد اختباري")}
                </Button>
                {testResult && (
                  <p className="field-hint" role="status">
                    {localizeError(testResult)}
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
function PinInput({
  value,
  onChange,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <input
      className="pin-input small"
      type="password"
      dir="ltr"
      inputMode="numeric"
      pattern="[0-9]{4}"
      maxLength={4}
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
    />
  );
}

function AccountSection({
  data,
  pinSet,
  onSaved,
}: {
  data: SettingsData;
  pinSet: boolean;
  onSaved: (m: string) => void;
}) {
  const { t, localizeError } = useAdminLanguage();
  const [username, setUsername] = useState(data.username);
  const [currentPassword, setCurrent] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm)
      return setError(t("The two new passwords don't match.", "كلمتا المرور الجديدتان غير متطابقتين."));
    setBusy(true);
    setError("");
    try {
      await saveAccount({ currentPassword, currentPin, username, newPassword });
      setCurrent("");
      setCurrentPin("");
      setNew("");
      setConfirm("");
      onSaved(
        newPassword
          ? t(
              "Login updated. Other devices are signed out.",
              "تم تحديث بيانات الدخول وتسجيل خروج الأجهزة الأخرى.",
            )
          : t("Username updated.", "تم تحديث اسم المستخدم."),
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-section" onSubmit={submit}>
      <div className="section-title">
        <h2>{t("Admin login", "تسجيل دخول المسؤول")}</h2>
        <p>
          {data.passwordInDatabase
            ? t(
                "Change the username or password used to sign in here.",
                "غيّر اسم المستخدم أو كلمة المرور المستخدمة لتسجيل الدخول هنا.",
              )
            : t(
                "The password is currently the one set in Vercel (ADMIN_PASSWORD). Once you change it here, the new one is used instead.",
                "تُستخدم حاليًا كلمة المرور المحددة في Vercel ‏(ADMIN_PASSWORD). عند تغييرها هنا، ستُستخدم كلمة المرور الجديدة.",
              )}
        </p>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {localizeError(error)}
        </p>
      )}
      <div className="form-grid">
        <Field label={t("Username", "اسم المستخدم")} required>
          <input
            dir="ltr"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </Field>
        <Field label={t("Current password", "كلمة المرور الحالية")} required>
          <input
            type="password"
            dir="ltr"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        {pinSet && (
          <Field label={t("PIN", "رمز PIN")} required>
            <PinInput value={currentPin} onChange={setCurrentPin} autoComplete="off" />
          </Field>
        )}
        <Field
          label={t("New password", "كلمة مرور جديدة")}
          hint={t(
            "At least 10 characters, not containing the username. Leave empty to keep the current one.",
            "10 أحرف على الأقل، دون اسم المستخدم. اتركه فارغًا للإبقاء على كلمة المرور الحالية.",
          )}
        >
          <input
            type="password"
            dir="ltr"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label={t("Repeat new password", "تأكيد كلمة المرور الجديدة")}>
          <input
            type="password"
            dir="ltr"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </div>
      <button
        type="submit"
        className="button primary"
        disabled={busy || !currentPassword || (pinSet && currentPin.length !== 4)}
      >
        {busy ? t("Updating…", "جارٍ التحديث…") : t("Update login", "تحديث بيانات الدخول")}
      </button>
    </form>
  );
}

/** "Sign out all devices": for a lost phone or a shared computer. */
function DevicesSection({ onSaved }: { onSaved: (m: string) => void }) {
  const { t, localizeError } = useAdminLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="form-section">
      <div className="section-title">
        <h2>{t("Signed-in devices", "الأجهزة المسجّل دخولها")}</h2>
        <p>
          {t(
            "Lost a phone, or signed in on someone else's computer? Sign out everywhere; this device stays signed in.",
            "فقدت هاتفك أو سجّلت الدخول على جهاز شخص آخر؟ سجّل خروج الأجهزة الأخرى، وسيبقى هذا الجهاز مسجّلًا.",
          )}
        </p>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {localizeError(error)}
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
            onSaved(t("Every other device is signed out.", "تم تسجيل خروج جميع الأجهزة الأخرى."));
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? t("Signing out…", "جارٍ تسجيل الخروج…")
          : t("Sign out all other devices", "تسجيل خروج جميع الأجهزة الأخرى")}
      </Button>
    </section>
  );
}

function PinSection({ pinSet, onSaved }: { pinSet: boolean; onSaved: (m: string) => void }) {
  const { t, localizeError } = useAdminLanguage();
  const [currentPassword, setCurrent] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem =
      pinProblem(newPin) ??
      (newPin !== confirm ? t("The two new PINs don't match.", "رمزا PIN الجديدان غير متطابقين.") : null);
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      await savePin({ currentPassword, currentPin, newPin });
      setCurrent("");
      setCurrentPin("");
      setNewPin("");
      setConfirm("");
      onSaved(
        pinSet
          ? t("PIN changed. Other devices are signed out.", "تم تغيير رمز PIN وتسجيل خروج الأجهزة الأخرى.")
          : t(
              "PIN created. It's now asked for at every sign-in.",
              "تم إنشاء رمز PIN. سيُطلب عند كل تسجيل دخول.",
            ),
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-section" onSubmit={submit}>
      <div className="section-title">
        <h2>{t("Sign-in PIN", "رمز PIN لتسجيل الدخول")}</h2>
        <p>
          {pinSet
            ? t(
                "After the password, the admin asks for this 4-digit PIN. It's also needed to change the login.",
                "يُطلب رمز PIN المكوّن من 4 أرقام بعد كلمة المرور. وهو مطلوب أيضًا لتغيير بيانات الدخول.",
              )
            : t(
                "Add a 4-digit PIN as a second step after the password. Recommended: it keeps the admin safe even if the password leaks.",
                "أضف رمز PIN من 4 أرقام كخطوة ثانية بعد كلمة المرور. يُنصح به لحماية لوحة الإدارة حتى عند تسرّب كلمة المرور.",
              )}
        </p>
      </div>
      {!pinSet && (
        <div className="info-banner">
          {t(
            "No PIN yet. Anyone with the password can open the admin.",
            "لم يُضف رمز PIN بعد. يمكن لأي شخص لديه كلمة المرور فتح لوحة الإدارة.",
          )}
        </div>
      )}
      {error && (
        <p className="error-text" role="alert">
          {localizeError(error)}
        </p>
      )}
      <div className="form-grid">
        <Field label={t("Current password", "كلمة المرور الحالية")} required>
          <input
            type="password"
            dir="ltr"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        {pinSet ? (
          <Field label={t("Current PIN", "رمز PIN الحالي")} required>
            <PinInput value={currentPin} onChange={setCurrentPin} autoComplete="off" />
          </Field>
        ) : (
          <span aria-hidden />
        )}
        <Field
          label={pinSet ? t("New PIN", "رمز PIN الجديد") : t("PIN", "رمز PIN")}
          required
          hint={t("4 digits. Not 0000, 1234 or similar.", "4 أرقام. تجنّب 0000 أو 1234 وما شابه.")}
        >
          <PinInput value={newPin} onChange={setNewPin} autoComplete="new-password" />
        </Field>
        <Field label={t("Repeat the PIN", "تأكيد رمز PIN")} required>
          <PinInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </Field>
      </div>
      <button
        type="submit"
        className="button primary"
        disabled={
          busy ||
          !currentPassword ||
          (pinSet && currentPin.length !== 4) ||
          newPin.length !== 4 ||
          confirm.length !== 4
        }
      >
        {busy
          ? t("Saving…", "جارٍ الحفظ…")
          : pinSet
            ? t("Change PIN", "تغيير رمز PIN")
            : t("Create PIN", "إنشاء رمز PIN")}
      </button>
    </form>
  );
}

/* ---------- Staff: their own password ---------- */

function MyAccountSection({ username, onSaved }: { username: string; onSaved: (m: string) => void }) {
  const { t, localizeError } = useAdminLanguage();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm)
      return setError(t("The two new passwords don't match.", "كلمتا المرور الجديدتان غير متطابقتين."));
    setBusy(true);
    setError("");
    try {
      await changeMyPassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      onSaved(
        t(
          "Password changed. Your other devices are signed out.",
          "تم تغيير كلمة المرور وتسجيل خروج أجهزتك الأخرى.",
        ),
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="form-section" onSubmit={submit}>
      <div className="section-title">
        <h2>{t("My account", "حسابي")}</h2>
        <p>
          {t("Signed in as", "مسجّل الدخول باسم")} <b dir="ltr">{username}</b>
          {t(
            ". To change your username or access, ask the super admin.",
            ". لتغيير اسم المستخدم أو الصلاحيات، تواصل مع المسؤول الرئيسي.",
          )}
        </p>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {localizeError(error)}
        </p>
      )}
      <div className="form-grid">
        <Field label={t("Current password", "كلمة المرور الحالية")} required>
          <input
            type="password"
            dir="ltr"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <span aria-hidden />
        <Field
          label={t("New password", "كلمة مرور جديدة")}
          required
          hint={t(
            "At least 10 characters, not containing your username.",
            "10 أحرف على الأقل، دون اسم المستخدم الخاص بك.",
          )}
        >
          <input
            type="password"
            dir="ltr"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label={t("Repeat new password", "تأكيد كلمة المرور الجديدة")} required>
          <input
            type="password"
            dir="ltr"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </div>
      <button type="submit" className="button primary" disabled={busy || !current || !next || !confirm}>
        {busy ? t("Saving…", "جارٍ الحفظ…") : t("Change password", "تغيير كلمة المرور")}
      </button>
    </form>
  );
}

/* ---------- Super admin: staff accounts ---------- */

function PageChecks({ value, onChange }: { value: Page[]; onChange: (pages: Page[]) => void }) {
  const { t } = useAdminLanguage();
  return (
    <div
      className="page-checks"
      role="group"
      aria-label={t("Pages this person can open", "الصفحات المتاحة لهذا الشخص")}
    >
      {PAGES.map((p) => (
        <label key={p}>
          <input
            type="checkbox"
            checked={value.includes(p)}
            onChange={() =>
              onChange(
                value.includes(p)
                  ? value.filter((x) => x !== p)
                  : PAGES.filter((x) => x === p || value.includes(x)),
              )
            }
          />
          {t(
            PAGE_LABELS[p],
            {
              items: "أصناف القائمة",
              sections: "الأقسام",
              shop: "معلومات المتجر",
              orders: "الطلبات",
              stats: "الإحصاءات",
              payments: "طرق الدفع",
              settings: "الإعدادات",
            }[p],
          )}
        </label>
      ))}
    </div>
  );
}

type NewCredentials = { username: string; password: string; pages: Page[] };

/** Saves the sign-in details as a one-page PDF (made in this browser; nothing is uploaded). */
function downloadCredentials(c: NewCredentials) {
  const pdf = credentialsPdf({
    username: c.username,
    password: c.password,
    signInUrl: `${location.origin}/admin`,
    pages: c.pages.map((p) => PAGE_LABELS[p]),
    date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
  });
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `arabica-staff-${c.username}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Shown once after creating an account or setting a password: the server can't show it again. */
function CredentialsCard({ creds, onClose }: { creds: NewCredentials; onClose: () => void }) {
  const { t } = useAdminLanguage();
  return (
    <div className="credentials-card" role="status">
      <p>
        <b>{t(`Sign-in details for ${creds.username}`, `بيانات الدخول لـ ${creds.username}`)}</b>
        {t(
          " — shown only now. Download the PDF and give it to them privately.",
          " — تظهر الآن فقط. نزّل ملف PDF وسلّمه لصاحبه بشكل خاص.",
        )}
      </p>
      <dl>
        <dt>{t("Username", "اسم المستخدم")}</dt>
        <dd dir="ltr">{creds.username}</dd>
        <dt>{t("Password", "كلمة المرور")}</dt>
        <dd dir="ltr">{creds.password}</dd>
      </dl>
      <div>
        <Button onClick={() => downloadCredentials(creds)}>{t("Download PDF", "تنزيل PDF")}</Button>
        <Button variant="ghost" onClick={onClose}>
          {t("Done", "تم")}
        </Button>
      </div>
    </div>
  );
}

const ago = (iso: string, locale: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  if (minutes < 60) return relative.format(-Math.max(1, minutes), "minute");
  if (minutes < 60 * 24) return relative.format(-Math.round(minutes / 60), "hour");
  return relative.format(-Math.round(minutes / (60 * 24)), "day");
};

function presence(s: StaffAccount, t: (english: string, arabic: string) => string, locale: string) {
  if (s.online) return { online: true, text: t("Online now", "متصل الآن") };
  if (s.lastSignout && (!s.lastSeen || s.lastSignout >= s.lastSeen))
    return {
      online: false,
      text: t(`Signed out ${ago(s.lastSignout, locale)}`, `تم تسجيل الخروج ${ago(s.lastSignout, locale)}`),
    };
  if (s.lastSeen)
    return {
      online: false,
      text: t(`Last seen ${ago(s.lastSeen, locale)}`, `آخر ظهور ${ago(s.lastSeen, locale)}`),
    };
  return { online: false, text: t("Never signed in", "لم يسجّل الدخول بعد") };
}

function StaffSection({ onSaved }: { onSaved: (m: string) => void }) {
  const { t, localizeError } = useAdminLanguage();
  const [staff, setStaff] = useState<StaffAccount[] | null>(null);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(generatePassword);
  const [pages, setPages] = useState<Page[]>(STAFF_DEFAULT);
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<NewCredentials | null>(null);

  // Refreshed every minute so "Online now" stays current.
  useEffect(() => {
    const load = () => listStaff().then(setStaff, (e) => setError(errorText(e)));
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
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
  // Updates keep the presence fields the list already had.
  const replace = (row: StaffAccount) =>
    setStaff((list) => (list ?? []).map((s) => (s.id === row.id ? { ...s, ...row } : s)));

  const add = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const row = await createStaff({ username, password, pages });
      setStaff((list) => [...(list ?? []), row].sort((a, b) => a.username.localeCompare(b.username)));
      setCreds({ username: row.username, password, pages: row.pages });
      setUsername("");
      setPassword(generatePassword());
      setPages(STAFF_DEFAULT);
      onSaved(
        t(
          `Account "${row.username}" created. Download the PDF with their sign-in details.`,
          `تم إنشاء الحساب "${row.username}". نزّل ملف PDF الذي يحتوي على بيانات الدخول.`,
        ),
      );
    });
  };

  return (
    <section className="form-section">
      <div className="section-title">
        <h2>{t("Staff accounts", "حسابات الموظفين")}</h2>
        <p>
          {t(
            "Staff sign in on this same page with their own username and password, and only see the pages you tick. They can never manage staff or change your login, PIN or the WhatsApp number.",
            "يسجّل الموظفون الدخول من هذه الصفحة باستخدام اسم المستخدم وكلمة المرور الخاصين بهم، ويرون الصفحات التي تحددها فقط. لا يمكنهم إدارة الموظفين أو تغيير بيانات دخولك أو رمز PIN أو رقم واتساب.",
          )}
        </p>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {localizeError(error)}
        </p>
      )}
      {creds && <CredentialsCard creds={creds} onClose={() => setCreds(null)} />}
      {!staff && !error && <p className="muted-text">{t("Loading…", "جارٍ التحميل…")}</p>}
      {staff?.length === 0 && (
        <p className="muted-text">{t("No staff accounts yet.", "لا توجد حسابات موظفين بعد.")}</p>
      )}
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
            onCredentials={setCreds}
          />
        ))}
      </div>

      <form className="staff-add" onSubmit={add}>
        <h3>{t("Add a staff member", "إضافة موظف")}</h3>
        <div className="form-grid">
          <Field
            label={t("Username", "اسم المستخدم")}
            required
            hint={t(
              "3–40 letters, numbers, dots, dashes or underscores.",
              "من 3 إلى 40 حرفًا أو رقمًا أو نقطة أو شرطة أو شرطة سفلية.",
            )}
          >
            <input
              dir="ltr"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              autoComplete="off"
              autoCapitalize="none"
            />
          </Field>
          <Field
            label={t("Password", "كلمة المرور")}
            required
            hint={t(
              "Made for you; you can also type your own (10+ characters).",
              "أُنشئت لك تلقائيًا؛ يمكنك كتابة كلمة مرور من اختيارك (10 أحرف على الأقل).",
            )}
          >
            <input
              type="text"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>
        <button type="button" className="inline-link" onClick={() => setPassword(generatePassword())}>
          {t("Generate another password", "إنشاء كلمة مرور أخرى")}
        </button>
        <span className="field-label">{t("Pages they can open", "الصفحات المتاحة لهم")}</span>
        <PageChecks value={pages} onChange={setPages} />
        <button type="submit" className="button primary" disabled={busy || !username || !password}>
          {busy ? t("Saving…", "جارٍ الحفظ…") : t("Create account", "إنشاء حساب")}
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
  onCredentials,
}: {
  account: StaffAccount;
  busy: boolean;
  run: (job: () => Promise<void>) => void;
  onChange: (row: StaffAccount) => void;
  onDeleted: () => void;
  onSaved: (m: string) => void;
  onCredentials: (c: NewCredentials) => void;
}) {
  const { t, locale } = useAdminLanguage();
  const [pages, setPages] = useState(s.pages);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = presence(s, t, locale);
  const changed = pages.join() !== s.pages.join();
  return (
    <div className={`staff-row ${s.active ? "" : "disabled"}`}>
      <div className="staff-row-head">
        <b>{s.username}</b>
        <span className={`status-badge ${s.active ? "accepted" : ""}`}>
          {s.active ? t("Active", "نشط") : t("Stopped", "متوقف")}
        </span>
        <span className={`presence ${status.online ? "online" : ""}`}>{status.text}</span>
      </div>
      <PageChecks value={pages} onChange={setPages} />
      <div className="staff-row-actions">
        <Button
          variant="secondary"
          disabled={busy || !changed}
          onClick={() =>
            run(async () => {
              onChange(await updateStaff({ id: s.id, pages }));
              onSaved(
                t(
                  `Access for "${s.username}" saved. They're signed out and see the new pages next time.`,
                  `تم حفظ صلاحيات "${s.username}" وتسجيل خروجه. ستظهر الصفحات الجديدة عند دخوله مجددًا.`,
                ),
              );
            })
          }
        >
          {t("Save access", "حفظ الصلاحيات")}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const password = generatePassword();
              onChange(await updateStaff({ id: s.id, password }));
              onCredentials({ username: s.username, password, pages: s.pages });
              onSaved(
                t(
                  `New password set for "${s.username}". They're signed out. Download the PDF above.`,
                  `تم تعيين كلمة مرور جديدة لـ "${s.username}" وتسجيل خروجه. نزّل ملف PDF أعلاه.`,
                ),
              );
            })
          }
        >
          {t("New password + PDF", "كلمة مرور جديدة + PDF")}
        </Button>
        <Button
          variant="secondary"
          disabled={
            busy || !s.active || !(s.online || (s.lastSeen && (!s.lastSignout || s.lastSeen > s.lastSignout)))
          }
          onClick={() =>
            run(async () => {
              onChange({
                ...(await updateStaff({ id: s.id, signOut: true })),
                online: false,
                lastSignout: new Date().toISOString(),
              });
              onSaved(
                t(
                  `"${s.username}" is signed out. They can sign in again with their password.`,
                  `تم تسجيل خروج "${s.username}". يمكنه الدخول مجددًا بكلمة المرور الخاصة به.`,
                ),
              );
            })
          }
        >
          {t("Sign out now", "تسجيل الخروج الآن")}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              onChange({ ...(await updateStaff({ id: s.id, active: !s.active })), online: false });
              onSaved(
                s.active
                  ? t(
                      `"${s.username}" is stopped and signed out. They can't sign in until you restart the account.`,
                      `تم إيقاف "${s.username}" وتسجيل خروجه. لا يمكنه الدخول حتى تعيد تفعيل الحساب.`,
                    )
                  : t(`"${s.username}" can sign in again.`, `يمكن لـ "${s.username}" الدخول مجددًا.`),
              );
            })
          }
        >
          {s.active ? t("Stop account", "إيقاف الحساب") : t("Restart account", "إعادة تفعيل الحساب")}
        </Button>
        <Button
          variant={confirmDelete ? "danger" : "ghost"}
          disabled={busy}
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true);
            run(async () => {
              await deleteStaff(s.id);
              onDeleted();
              onSaved(t(`"${s.username}" deleted.`, `تم حذف "${s.username}".`));
            });
          }}
        >
          {confirmDelete ? t("Tap again to delete", "اضغط مرة أخرى للحذف") : t("Delete", "حذف")}
        </Button>
      </div>
    </div>
  );
}
