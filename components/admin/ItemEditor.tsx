"use client";

import { useEffect, useRef, useState } from "react";
import { TAGS, type Tag } from "@/data/menu";
import { preparePhoto, type DraftItem, type DraftSection } from "@/lib/admin/draft";
import type { Editing } from "./AdminApp";
import {
  Button,
  ErrorBanner,
  Field,
  formatLbp,
  Icon,
  Modal,
  PageHeader,
  TAG_LABELS,
  Tags,
  Thumbnail,
  Toggle,
} from "./ui";

export type Destination = { sectionKey: string } | { newSection: string };

type Props = {
  editing: Editing;
  sections: DraftSection[];
  onBack: () => void;
  onPublish: (item: DraftItem, to: Destination) => Promise<void>;
  onDelete: () => Promise<void>;
  setDirty: (dirty: boolean) => void;
};

export function ItemEditor({ editing, sections, onBack, onPublish, onDelete, setDirty }: Props) {
  const original = editing.item;
  const [item, setItem] = useState(original);
  const [pricing, setPricing] = useState<"single" | "size">(original.sizes.length ? "size" : "single");
  const [sectionKey, setSectionKey] = useState(editing.sectionKey);
  const [newSection, setNewSection] = useState<string | null>(sections.length ? null : "");
  const [choiceText, setChoiceText] = useState("");
  // A duplicate starts with content, so it can be published straight away.
  const [dirty, setLocalDirty] = useState(editing.isNew && original.name !== "");
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);

  const update = (patch: Partial<DraftItem>) => {
    setItem((current) => ({ ...current, ...patch }));
    setLocalDirty(true);
  };

  const sizes = pricing === "size" ? item.sizes : [];
  const sizeInvalid =
    pricing === "size" && (!sizes.length || sizes.some((s) => !s.size.trim() || !Number(s.price)));
  const priceMissing = pricing === "single" && !Number(item.price);

  const problem = !item.name.trim()
    ? "needs a name"
    : newSection !== null && !newSection.trim()
      ? "needs a section name"
      : priceMissing
        ? "needs a price"
        : sizeInvalid
          ? "needs a name and price for every size"
          : "";

  const sectionName =
    newSection !== null
      ? newSection.trim() || "New section"
      : sections.find((s) => s.key === sectionKey)?.name;

  const publish = async () => {
    if (problem) {
      setAttempted(true);
      setError(
        `${sectionName} → ${item.name.trim() || "Untitled item"} ${problem}. The website still shows the previous menu.`,
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const clean: DraftItem = {
        ...item,
        name: item.name.trim(),
        price: pricing === "single" ? item.price : "",
        sizes,
      };
      await onPublish(clean, newSection !== null ? { newSection: newSection.trim() } : { sectionKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const fix = () => {
    if (!item.name.trim()) nameRef.current?.focus();
    else if (pricing === "single") priceRef.current?.focus();
    else document.querySelector<HTMLInputElement>(".size-row.invalid input")?.focus();
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const upload = await preparePhoto(file);
      update({ upload, preview: URL.createObjectURL(upload) });
    } catch {
      setError("This photo couldn't be read. Try a JPG, PNG or WebP image.");
    }
  };

  const addChoice = () => {
    const choice = choiceText.trim();
    if (choice && !item.options.includes(choice)) update({ options: [...item.options, choice] });
    setChoiceText("");
  };

  const toggleTag = (tag: Tag) =>
    update({ tags: item.tags.includes(tag) ? item.tags.filter((t) => t !== tag) : [...item.tags, tag] });

  const setPricingMode = (mode: "single" | "size") => {
    setPricing(mode);
    if (mode === "size" && !item.sizes.length) update({ sizes: [{ size: "", price: "" }] });
    else setLocalDirty(true);
  };

  const back = () => (dirty ? setLeaving(true) : onBack());
  const hasPhoto = Boolean(item.preview || item.image);
  const sizeText = sizes
    .filter((s) => s.size && s.price)
    .map((s) => `${s.size} ${formatLbp(s.price)} L.L`)
    .join(" · ");
  const previewPrice =
    pricing === "single" && item.price ? (
      <>
        {formatLbp(item.price)} <small>L.L</small>
      </>
    ) : (
      sizeText || <small>No price yet</small>
    );

  return (
    <div className="page editor-page">
      <button type="button" className="back-link" onClick={back}>
        ← Menu items
      </button>
      <PageHeader
        title={editing.isNew ? "Add menu item" : `Edit ${original.name}`}
        description="Changes publish directly to the public website."
      />
      {error && (
        <ErrorBanner message={error} onFix={problem ? fix : undefined} onClose={() => setError("")} />
      )}

      <div className="editor-layout">
        <div className="form-column">
          <section className="form-section">
            <div className="section-title">
              <h2>Details</h2>
              <p>What guests see on the menu.</p>
            </div>
            <div className="form-grid">
              <Field label="Name" required>
                <input
                  ref={nameRef}
                  className={attempted && !item.name.trim() ? "error" : ""}
                  value={item.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Item name"
                />
                {attempted && !item.name.trim() && <span className="error-text">Enter a name.</span>}
              </Field>
              {newSection === null ? (
                <Field label="Section" required>
                  <select
                    value={sectionKey}
                    onChange={(e) => {
                      setSectionKey(e.target.value);
                      setLocalDirty(true);
                    }}
                  >
                    {sections.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="inline-link"
                    onClick={() => {
                      setNewSection("");
                      setLocalDirty(true);
                    }}
                  >
                    <Icon name="plus" size={17} /> New section
                  </button>
                </Field>
              ) : (
                <Field label="New section name" required>
                  <input
                    autoFocus
                    className={attempted && !newSection.trim() ? "error" : ""}
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    placeholder="e.g. Breakfast"
                  />
                  {sections.length > 0 && (
                    <button type="button" className="inline-link" onClick={() => setNewSection(null)}>
                      Choose an existing section
                    </button>
                  )}
                </Field>
              )}
            </div>
            <Field
              label="What's in it"
              hint={`Optional · guests see it when they tap the item · ${item.description.length}/140`}
            >
              <textarea
                value={item.description}
                onChange={(e) => update({ description: e.target.value })}
                maxLength={140}
                placeholder="e.g. Double espresso, steamed milk and caramel sauce"
              />
            </Field>
            <div className="upload-row">
              <Thumbnail item={item} name={item.name} />
              <div>
                <b>Photo</b>
                <p>A cut-out photo on a transparent background looks best.</p>
                <div>
                  <input
                    ref={fileRef}
                    className="file-input"
                    type="file"
                    accept="image/png,image/webp,image/jpeg"
                    tabIndex={-1}
                    aria-hidden
                    onChange={(e) => {
                      pickPhoto(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                    {hasPhoto ? "Replace photo" : "Upload photo"}
                  </Button>
                  {hasPhoto && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => update({ image: "", upload: undefined, preview: undefined })}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">
              <h2>Price</h2>
              <p>Lebanese pounds, entered as whole numbers.</p>
            </div>
            <div className="segmented">
              {(["single", "size"] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  aria-pressed={pricing === mode}
                  className={pricing === mode ? "selected" : ""}
                  onClick={() => setPricingMode(mode)}
                >
                  {mode === "single" ? "Single price" : "Prices by size"}
                </button>
              ))}
            </div>
            {pricing === "single" ? (
              <Field label="Price">
                <div className="currency-input">
                  <input
                    ref={priceRef}
                    className={attempted && priceMissing ? "error" : ""}
                    value={item.price}
                    onChange={(e) => update({ price: e.target.value.replace(/\D/g, "") })}
                    inputMode="numeric"
                    placeholder="400000"
                  />
                  <span>L.L</span>
                </div>
                {item.price && <span className="field-hint">Shown as {formatLbp(item.price)} L.L</span>}
              </Field>
            ) : (
              <div className="size-prices">
                <div className="size-head">
                  <span>Size name</span>
                  <span>Price</span>
                  <span />
                </div>
                {item.sizes.map((size, index) => (
                  <div
                    key={index}
                    className={`size-row ${attempted && (!size.size.trim() || !Number(size.price)) ? "invalid" : ""}`}
                  >
                    <input
                      aria-label="Size name"
                      value={size.size}
                      placeholder="Small"
                      onChange={(e) =>
                        update({
                          sizes: item.sizes.map((s, i) => (i === index ? { ...s, size: e.target.value } : s)),
                        })
                      }
                    />
                    <div className="currency-input">
                      <input
                        aria-label={`${size.size || "Size"} price`}
                        value={size.price}
                        placeholder="300000"
                        inputMode="numeric"
                        onChange={(e) =>
                          update({
                            sizes: item.sizes.map((s, i) =>
                              i === index ? { ...s, price: e.target.value.replace(/\D/g, "") } : s,
                            ),
                          })
                        }
                      />
                      <span>L.L</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete ${size.size || "size"}`}
                      onClick={() => update({ sizes: item.sizes.filter((_, i) => i !== index) })}
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="add-row"
                  onClick={() => update({ sizes: [...item.sizes, { size: "", price: "" }] })}
                >
                  <Icon name="plus" /> Add size
                </button>
              </div>
            )}
            {attempted && (priceMissing || sizeInvalid) && (
              <div className="price-error">
                <Icon name="warning" />
                Add a price, or at least one size with a price. Every size needs a name and price.
              </div>
            )}
          </section>

          <section className="form-section">
            <div className="section-title">
              <h2>Choices and tags</h2>
              <p>Add options that do not change the price.</p>
            </div>
            <Field label="Flavours / choices" hint="Choices that don't change the price, e.g. Peach, Lemon.">
              <div className="chip-input">
                {item.options.map((choice) => (
                  <span className="choice-chip" key={choice}>
                    {choice}
                    <button
                      type="button"
                      onClick={() => update({ options: item.options.filter((o) => o !== choice) })}
                      aria-label={`Remove ${choice}`}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </span>
                ))}
                <input
                  value={choiceText}
                  onChange={(e) => setChoiceText(e.target.value)}
                  onBlur={addChoice}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addChoice();
                    }
                  }}
                  placeholder={item.options.length ? "Add another" : "Type a choice and press Enter"}
                />
              </div>
            </Field>
            <Field label="Tags">
              <div className="tag-toggles">
                {TAGS.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    aria-pressed={item.tags.includes(tag)}
                    className={item.tags.includes(tag) ? "selected" : ""}
                    onClick={() => toggleTag(tag)}
                  >
                    {item.tags.includes(tag) && <Icon name="check" size={15} />}
                    {TAG_LABELS[tag]}
                  </button>
                ))}
              </div>
            </Field>
            <div className="addon-setting">
              <div>
                <b>This is an add-on (e.g. Add cheese)</b>
                <p>Shown smaller at the end of its section.</p>
              </div>
              <Toggle
                checked={item.addon}
                onChange={(addon) => update({ addon })}
                label="This item is an add-on"
              />
            </div>
          </section>

          {!editing.isNew && (
            <button type="button" className="delete-item-button" onClick={() => setDeleting(true)}>
              <Icon name="trash" /> Delete item
            </button>
          )}

          <div className="bottom-actions">
            <span>{busy ? "Publishing…" : dirty ? "Unsaved changes" : "No changes"}</span>
            <div>
              <Button variant="secondary" onClick={back} disabled={busy}>
                Discard
              </Button>
              <Button onClick={publish} disabled={!dirty || busy}>
                {busy ? "Publishing…" : "Publish"}
              </Button>
            </div>
          </div>
        </div>

        <aside className="preview-column">
          <div className="preview-sticky">
            <div className="preview-head">
              <span>Live preview</span>
              <a href="/menu" target="_blank" rel="noreferrer">
                <Icon name="eye" /> View menu
              </a>
            </div>
            <div className="live-preview">
              {hasPhoto ? (
                <>
                  <div className="public-photo">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview */}
                    <img src={item.preview || item.image} alt="" />
                  </div>
                  <div className="photo-preview-copy">
                    <h3>{item.name || "Item name"}</h3>
                    <b>{previewPrice}</b>
                  </div>
                </>
              ) : (
                <div className="public-item-line">
                  <h3>{item.name || "Item name"}</h3>
                  <i />
                  <b>{previewPrice}</b>
                </div>
              )}
              {item.options.length > 0 && <p>{item.options.join(" · ")}</p>}
              <Tags values={item.tags} addon={item.addon} />
              {/* Shown open here; on the menu it opens when guests tap the item. */}
              {item.description && <p className="preview-tab">{item.description}</p>}
            </div>
          </div>
        </aside>
      </div>

      {leaving && (
        <Modal onClose={() => setLeaving(false)}>
          <div className="modal-icon">
            <Icon name="warning" />
          </div>
          <h2>Discard changes?</h2>
          <p>Your unpublished edits will be lost.</p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setLeaving(false)}>
              Keep editing
            </Button>
            <Button variant="danger" onClick={onBack}>
              Discard
            </Button>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal onClose={() => !busy && setDeleting(false)}>
          <div className="modal-icon danger">
            <Icon name="trash" />
          </div>
          <h2>Delete {original.name}?</h2>
          <p>It will disappear from the public menu after it&apos;s published.</p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setDeleting(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete();
                } catch (e) {
                  setDeleting(false);
                  setBusy(false);
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              {busy ? "Deleting…" : "Delete and publish"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
