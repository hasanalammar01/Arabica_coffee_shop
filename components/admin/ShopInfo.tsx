"use client";

import { useEffect, useState } from "react";
import type { Hours, SiteData } from "@/data/site";
import { normalizeSite } from "@/lib/admin/draft";
import { formatTime, isOpenAt, localTime } from "@/lib/hours";
import { useAdminLanguage } from "./Language";
import { Button, ErrorBanner, Field, FullLogo, Icon, PageHeader } from "./ui";

const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const CONTACT = [
  { key: "phone", label: "Phone", labelAr: "الهاتف", placeholder: "+961 …", type: "tel" },
  { key: "whatsapp", label: "WhatsApp", labelAr: "واتساب", placeholder: "+961 …", type: "tel" },
  { key: "instagram", label: "Instagram", labelAr: "إنستغرام", placeholder: "instagram.com/…", type: "text" },
  {
    key: "email",
    label: "Email",
    labelAr: "البريد الإلكتروني",
    placeholder: "name@example.com",
    type: "email",
  },
] as const;

export function ShopInfo({
  site,
  onPublish,
  setDirty,
}: {
  site: SiteData;
  onPublish: (next: SiteData) => Promise<void>;
  setDirty: (dirty: boolean) => void;
}) {
  const { lang, t } = useAdminLanguage();
  const [form, setForm] = useState(site);
  const [dirty, setLocalDirty] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => localTime(new Date(), site.timeZone));
  const [previewOpen, setPreviewOpen] = useState(() => isOpenAt(site.hours, now.day, now.minute));

  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);

  const update = (patch: Partial<SiteData>) => {
    setForm((f) => ({ ...f, ...patch }));
    setLocalDirty(true);
  };
  const setGroup = (index: number, patch: Partial<Hours>) =>
    update({ hours: form.hours.map((h, i) => (i === index ? { ...h, ...patch } : h)) });

  const today = form.hours.find((h) => h.days.includes(now.day));

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const next = normalizeSite({
        ...form,
        hours: form.hours
          .filter((h) => h.days.length)
          .map((h) => ({ ...h, days: [...h.days].sort((a, b) => a - b) })),
      });
      await onPublish(next);
      setForm(next);
      setLocalDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page shop-page">
      <PageHeader
        title={t("Shop info", "معلومات المقهى")}
        description={t(
          "Contact details and opening hours shown on the public website.",
          "معلومات الاتصال وساعات العمل المعروضة على الموقع العام.",
        )}
      />
      {error && <ErrorBanner message={error} onClose={() => setError("")} />}
      <div className="shop-layout">
        <div className="form-column">
          <section className="form-section">
            <div className="section-title">
              <h2>{t("Contact details", "معلومات الاتصال")}</h2>
              <p>
                {t(
                  "Keep the information guests use to reach Arabica up to date.",
                  "حافظ على تحديث المعلومات التي يستخدمها الزوّار للتواصل مع أرابيكا.",
                )}
              </p>
            </div>
            <Field label={t("Address", "العنوان بالإنجليزية")}>
              <input
                dir="ltr"
                lang="en"
                value={form.address}
                onChange={(e) => update({ address: e.target.value })}
                placeholder={t("Street, area, city", "الشارع، المنطقة، المدينة")}
              />
            </Field>
            <Field
              label={t("Google Maps link", "رابط خرائط Google")}
              hint={t(
                "Paste a link from Google Maps, or type the place name to search for.",
                "ألصق رابطاً من خرائط Google أو اكتب اسم المكان للبحث عنه.",
              )}
            >
              <input
                dir="ltr"
                value={form.mapsQuery}
                onChange={(e) => update({ mapsQuery: e.target.value })}
                placeholder="https://maps.app.goo.gl/…"
              />
            </Field>
            <div className="form-grid">
              {CONTACT.map((c) => (
                <Field key={c.key} label={t(c.label, c.labelAr)}>
                  <input
                    dir="ltr"
                    type={c.type}
                    value={form[c.key]}
                    onChange={(e) => update({ [c.key]: e.target.value })}
                    placeholder={c.placeholder}
                  />
                </Field>
              ))}
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">
              <h2>{t("Opening hours", "ساعات العمل")}</h2>
              <p>
                {t(
                  "If closing time is earlier than opening time, it is treated as after midnight.",
                  "إذا كان وقت الإغلاق أسبق من وقت الفتح، يُعتبر الإغلاق بعد منتصف الليل.",
                )}
              </p>
            </div>
            {form.hours.map((group, index) => (
              <div className="hours-group" key={index}>
                <div className="hours-row">
                  <div className="day-toggles" role="group" aria-label={t("Days", "الأيام")}>
                    {WEEK.map((day) => {
                      const on = group.days.includes(day);
                      return (
                        <button
                          type="button"
                          key={day}
                          aria-pressed={on}
                          className={on ? "selected" : ""}
                          onClick={() =>
                            setGroup(index, {
                              days: on ? group.days.filter((d) => d !== day) : [...group.days, day],
                            })
                          }
                        >
                          {t(DAY[day], DAY_AR[day])}
                        </button>
                      );
                    })}
                  </div>
                  <label>
                    <span>{t("Opens", "يفتح")}</span>
                    <input
                      type="time"
                      dir="ltr"
                      value={group.open}
                      onChange={(e) => setGroup(index, { open: e.target.value })}
                    />
                  </label>
                  <span className="time-dash">{t("to", "إلى")}</span>
                  <label>
                    <span>{t("Closes", "يغلق")}</span>
                    <input
                      type="time"
                      dir="ltr"
                      value={group.close}
                      onChange={(e) => setGroup(index, { close: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className="trash-button"
                    aria-label={t("Remove these hours", "حذف هذه الساعات")}
                    onClick={() => update({ hours: form.hours.filter((_, i) => i !== index) })}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
                {group.close < group.open && (
                  <p className="midnight-note">
                    <Icon name="clock" />
                    {t(
                      `Closes at ${formatTime(group.close, lang)} the next day.`,
                      `يغلق عند ${formatTime(group.close, lang)} من اليوم التالي.`,
                    )}
                  </p>
                )}
              </div>
            ))}
            {!form.hours.length && (
              <p className="field-hint">
                {t(
                  "No hours set. The website shows “Opening hours coming soon.”",
                  "لم تُحدّد ساعات العمل. يعرض الموقع «ساعات العمل قريباً».",
                )}
              </p>
            )}
            <button
              type="button"
              className="add-row"
              onClick={() => update({ hours: [...form.hours, { days: [], open: "08:00", close: "22:00" }] })}
            >
              <Icon name="plus" /> {t("Add another day group", "إضافة مجموعة أيام أخرى")}
            </button>
          </section>
        </div>

        <aside className="shop-preview panel">
          <span>{t("Website preview", "معاينة الموقع")}</span>
          <FullLogo />
          <h2>{t("Visit Arabica", "زوروا أرابيكا")}</h2>
          <p>
            {(lang === "ar" ? form.addressAr.trim() || form.address.trim() : form.address.trim()) ||
              t("Your address will appear here.", "سيظهر عنوانك هنا.")}
          </p>
          <button
            type="button"
            className={`open-badge ${previewOpen ? "" : "closed"}`}
            onClick={() => setPreviewOpen(!previewOpen)}
          >
            <i />
            {t("Preview:", "معاينة:")}{" "}
            {previewOpen ? t("Open now", "مفتوح الآن") : t("Closed now", "مغلق الآن")}
          </button>
          <div>
            <span>{t("Today", "اليوم")}</span>
            <b>
              {today
                ? `${formatTime(today.open, lang)} – ${formatTime(today.close, lang)}`
                : t("Closed", "مغلق")}
            </b>
          </div>
          {/* Preview only: an <a> without href isn't focusable or clickable. */}
          <a className="button secondary" aria-hidden>
            {t("Get directions", "الاتجاهات")}
          </a>
        </aside>
      </div>

      <div className="bottom-actions shop-save">
        <span>
          {busy
            ? t("Publishing…", "جارٍ النشر…")
            : dirty
              ? t("Unsaved changes", "تغييرات غير محفوظة")
              : t("No changes", "لا توجد تغييرات")}
        </span>
        <div>
          <Button
            variant="secondary"
            disabled={!dirty || busy}
            onClick={() => {
              setForm(site);
              setLocalDirty(false);
            }}
          >
            {t("Discard", "تجاهل التغييرات")}
          </Button>
          <Button disabled={!dirty || busy} onClick={save}>
            {busy ? t("Publishing…", "جارٍ النشر…") : t("Publish", "نشر")}
          </Button>
        </div>
      </div>
    </div>
  );
}
