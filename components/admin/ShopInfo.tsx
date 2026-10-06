"use client";

import { useEffect, useState } from "react";
import type { Hours, SiteData } from "@/data/site";
import { normalizeSite } from "@/lib/admin/draft";
import { formatTime, isOpenAt, localTime } from "@/lib/hours";
import { Button, ErrorBanner, Field, FullLogo, Icon, PageHeader } from "./ui";

const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CONTACT = [
  { key: "phone", label: "Phone", placeholder: "+961 …", type: "tel" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "+961 …", type: "tel" },
  { key: "instagram", label: "Instagram", placeholder: "instagram.com/…", type: "text" },
  { key: "email", label: "Email", placeholder: "name@example.com", type: "email" },
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
        title="Shop info"
        description="Contact details and opening hours shown on the public website."
      />
      {error && <ErrorBanner message={error} onClose={() => setError("")} />}
      <div className="shop-layout">
        <div className="form-column">
          <section className="form-section">
            <div className="section-title">
              <h2>Contact details</h2>
              <p>Keep the information guests use to reach Arabica up to date.</p>
            </div>
            <Field label="Address">
              <input
                value={form.address}
                onChange={(e) => update({ address: e.target.value })}
                placeholder="Street, area, city"
              />
            </Field>
            <Field
              label="Google Maps link"
              hint="Paste a link from Google Maps, or type the place name to search for."
            >
              <input
                value={form.mapsQuery}
                onChange={(e) => update({ mapsQuery: e.target.value })}
                placeholder="https://maps.app.goo.gl/…"
              />
            </Field>
            <div className="form-grid">
              {CONTACT.map((c) => (
                <Field key={c.key} label={c.label}>
                  <input
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
              <h2>Opening hours</h2>
              <p>If closing time is earlier than opening time, it is treated as after midnight.</p>
            </div>
            {form.hours.map((group, index) => (
              <div className="hours-group" key={index}>
                <div className="hours-row">
                  <div className="day-toggles" role="group" aria-label="Days">
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
                          {DAY[day]}
                        </button>
                      );
                    })}
                  </div>
                  <label>
                    <span>Opens</span>
                    <input
                      type="time"
                      value={group.open}
                      onChange={(e) => setGroup(index, { open: e.target.value })}
                    />
                  </label>
                  <span className="time-dash">to</span>
                  <label>
                    <span>Closes</span>
                    <input
                      type="time"
                      value={group.close}
                      onChange={(e) => setGroup(index, { close: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className="trash-button"
                    aria-label="Remove these hours"
                    onClick={() => update({ hours: form.hours.filter((_, i) => i !== index) })}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
                {group.close < group.open && (
                  <p className="midnight-note">
                    <Icon name="clock" />
                    Closes at {formatTime(group.close)} the next day.
                  </p>
                )}
              </div>
            ))}
            {!form.hours.length && (
              <p className="field-hint">No hours set. The website shows “Opening hours coming soon.”</p>
            )}
            <button
              type="button"
              className="add-row"
              onClick={() => update({ hours: [...form.hours, { days: [], open: "08:00", close: "22:00" }] })}
            >
              <Icon name="plus" /> Add another day group
            </button>
          </section>
        </div>

        <aside className="shop-preview panel">
          <span>Website preview</span>
          <FullLogo />
          <h2>Visit Arabica</h2>
          <p>{form.address.trim() || "Your address will appear here."}</p>
          <button
            type="button"
            className={`open-badge ${previewOpen ? "" : "closed"}`}
            onClick={() => setPreviewOpen(!previewOpen)}
          >
            <i />
            Preview: {previewOpen ? "Open now" : "Closed now"}
          </button>
          <div>
            <span>Today</span>
            <b>{today ? `${formatTime(today.open)} – ${formatTime(today.close)}` : "Closed"}</b>
          </div>
          {/* Preview only: an <a> without href isn't focusable or clickable. */}
          <a className="button secondary" aria-hidden>
            Get directions
          </a>
        </aside>
      </div>

      <div className="bottom-actions shop-save">
        <span>{busy ? "Publishing…" : dirty ? "Unsaved changes" : "No changes"}</span>
        <div>
          <Button
            variant="secondary"
            disabled={!dirty || busy}
            onClick={() => {
              setForm(site);
              setLocalDirty(false);
            }}
          >
            Discard
          </Button>
          <Button disabled={!dirty || busy} onClick={save}>
            {busy ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>
    </div>
  );
}
