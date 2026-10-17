"use client";

import { useEffect, useRef, useState } from "react";
import { ALLERGENS, AVAILABILITY, TAGS, type Allergen, type Availability, type Tag } from "@/data/menu";
import { preparePhoto, type DraftItem, type DraftModifier, type DraftSection } from "@/lib/admin/draft";
import { t } from "@/lib/i18n";
import type { Editing } from "./AdminApp";
import {
  Button,
  ErrorBanner,
  Field,
  formatLbp,
  Icon,
  Modal,
  PageHeader,
  Tags,
  Thumbnail,
  Toggle,
} from "./ui";

const AVAILABILITY_LABELS: Record<Availability, string> = {
  available: "Available",
  soldout: "Sold out",
  hidden: "Hidden from website",
};

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
  const modifierInvalid = item.modifiers.some(
    (m) =>
      !m.name.trim() ||
      !m.choices.length ||
      m.choices.some((c) => !c.name.trim()) ||
      (m.max !== "" && Number(m.min || 0) > Number(m.max)),
  );

  const problem = !item.name.trim()
    ? "needs a name"
    : newSection !== null && !newSection.trim()
      ? "needs a section name"
      : priceMissing
        ? "needs a price"
        : sizeInvalid
          ? "needs a name and price for every size"
          : modifierInvalid
            ? "has an order option without a name or choices"
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
    else if (priceMissing) priceRef.current?.focus();
    else document.querySelector<HTMLInputElement>(".size-row.invalid input, .modifier-group input.error")?.focus();
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
  const toggleAllergen = (a: Allergen) =>
    update({ allergens: item.allergens.includes(a) ? item.allergens.filter((x) => x !== a) : [...item.allergens, a] });
  const setModifier = (index: number, patch: Partial<DraftModifier>) =>
    update({ modifiers: item.modifiers.map((m, i) => (i === index ? { ...m, ...patch } : m)) });

  const setPricingMode = (mode: "single" | "size") => {
    setPricing(mode);
    if (mode === "size" && !item.sizes.length) update({ sizes: [{ size: "", sizeAr: "", price: "" }] });
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
              <h2>Availability</h2>
              <p>
                Sold out keeps the item on the menu, greyed out. Hidden takes it off the website without deleting
                it.
              </p>
            </div>
            <div className="segmented" role="group" aria-label="Availability">
              {AVAILABILITY.map((a) => (
                <button
                  type="button"
                  key={a}
                  aria-pressed={item.availability === a}
                  className={item.availability === a ? "selected" : ""}
                  onClick={() => update({ availability: a })}
                >
                  {AVAILABILITY_LABELS[a]}
                </button>
              ))}
            </div>
            <div className="addon-setting">
              <div>
                <b>Feature on the home page</b>
                <p>Shown under “Signature picks”. Choose a few of the café&apos;s best items.</p>
              </div>
              <Toggle
                checked={item.signature}
                onChange={(signature) => update({ signature })}
                label="Feature this item on the home page"
              />
            </div>
          </section>

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
              label="Name in Arabic"
              hint={
                item.arDraft
                  ? "Suggested translation. Check it before relying on it."
                  : "Shown on the Arabic menu. Empty shows the English name."
              }
            >
              <input
                dir="rtl"
                lang="ar"
                value={item.nameAr}
                onChange={(e) => update({ nameAr: e.target.value, arDraft: false })}
                placeholder="الاسم بالعربية"
              />
              {item.arDraft && (
                <button type="button" className="inline-link" onClick={() => update({ arDraft: false })}>
                  <Icon name="check" size={17} /> The Arabic name is correct
                </button>
              )}
            </Field>
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
            <Field label="What's in it, in Arabic" hint={`Optional · ${item.descriptionAr.length}/140`}>
              <textarea
                dir="rtl"
                lang="ar"
                value={item.descriptionAr}
                onChange={(e) => update({ descriptionAr: e.target.value })}
                maxLength={140}
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
                  <span>In Arabic</span>
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
                    <input
                      aria-label={`${size.size || "Size"} name in Arabic`}
                      dir="rtl"
                      lang="ar"
                      value={size.sizeAr}
                      placeholder="صغير"
                      onChange={(e) =>
                        update({
                          sizes: item.sizes.map((s, i) => (i === index ? { ...s, sizeAr: e.target.value } : s)),
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
                  onClick={() => update({ sizes: [...item.sizes, { size: "", sizeAr: "", price: "" }] })}
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
                      onClick={() => {
                        const n = item.options.indexOf(choice);
                        update({
                          options: item.options.filter((_, i) => i !== n),
                          optionsAr: item.optionsAr.filter((_, i) => i !== n),
                        });
                      }}
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
            {item.options.length > 0 && (
              <Field label="Choices in Arabic" hint="Optional. Empty ones show in English on the Arabic menu.">
                <div className="choice-ar-list">
                  {item.options.map((choice, n) => (
                    <label key={choice}>
                      <span>{choice}</span>
                      <input
                        dir="rtl"
                        lang="ar"
                        value={item.optionsAr[n] ?? ""}
                        onChange={(e) => {
                          const optionsAr = item.options.map((_, i) => item.optionsAr[i] ?? "");
                          optionsAr[n] = e.target.value;
                          update({ optionsAr });
                        }}
                      />
                    </label>
                  ))}
                </div>
              </Field>
            )}
            <Field label="Tags" hint="Only tick dietary tags the café has confirmed.">
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
                    {t("en").tags[tag]}
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

          <section className="form-section">
            <div className="section-title">
              <h2>Ingredients and allergens</h2>
              <p>Guests see these when they tap the item. Leave them empty until the café confirms them.</p>
            </div>
            <Field label="Ingredients" hint="Optional">
              <textarea
                value={item.ingredients}
                onChange={(e) => update({ ingredients: e.target.value })}
                maxLength={300}
                placeholder="e.g. Espresso, milk, caramel syrup"
              />
            </Field>
            <Field label="Ingredients in Arabic" hint="Optional">
              <textarea
                dir="rtl"
                lang="ar"
                value={item.ingredientsAr}
                onChange={(e) => update({ ingredientsAr: e.target.value })}
                maxLength={300}
              />
            </Field>
            <Field label="Contains (allergens)">
              <div className="tag-toggles">
                {ALLERGENS.map((a) => (
                  <button
                    type="button"
                    key={a}
                    aria-pressed={item.allergens.includes(a)}
                    className={item.allergens.includes(a) ? "selected" : ""}
                    onClick={() => toggleAllergen(a)}
                  >
                    {item.allergens.includes(a) && <Icon name="check" size={15} />}
                    {t("en").allergens[a]}
                  </button>
                ))}
              </div>
            </Field>
          </section>

          <section className="form-section">
            <div className="section-title">
              <h2>Order options</h2>
              <p>
                Choices guests make when ordering online, such as milk or an extra shot. Used only when online
                ordering is on. A price is added to the item price.
              </p>
            </div>
            {item.modifiers.map((m, mi) => (
              <fieldset className="modifier-group" key={mi}>
                <legend className="sr-only">Option group {mi + 1}</legend>
                <div className="size-row">
                  <input
                    aria-label="Option group name"
                    className={attempted && !m.name.trim() ? "error" : ""}
                    value={m.name}
                    placeholder="e.g. Milk"
                    onChange={(e) => setModifier(mi, { name: e.target.value })}
                  />
                  <input
                    aria-label="Option group name in Arabic"
                    dir="rtl"
                    lang="ar"
                    value={m.nameAr}
                    placeholder="الحليب"
                    onChange={(e) => setModifier(mi, { nameAr: e.target.value })}
                  />
                  <span />
                  <button
                    type="button"
                    aria-label={`Delete ${m.name || "option group"}`}
                    onClick={() => update({ modifiers: item.modifiers.filter((_, i) => i !== mi) })}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
                <div className="modifier-rules">
                  <label>
                    Guests pick at least
                    <input
                      inputMode="numeric"
                      value={m.min}
                      placeholder="0"
                      onChange={(e) => setModifier(mi, { min: e.target.value.replace(/\D/g, "") })}
                    />
                  </label>
                  <label>
                    and at most
                    <input
                      inputMode="numeric"
                      value={m.max}
                      placeholder="1"
                      onChange={(e) => setModifier(mi, { max: e.target.value.replace(/\D/g, "") })}
                    />
                  </label>
                </div>
                {m.choices.map((c, ci) => {
                  const setChoice = (patch: Partial<DraftModifier["choices"][number]>) =>
                    setModifier(mi, { choices: m.choices.map((x, i) => (i === ci ? { ...x, ...patch } : x)) });
                  return (
                    <div className={`size-row ${attempted && !c.name.trim() ? "invalid" : ""}`} key={ci}>
                      <input
                        aria-label="Choice"
                        value={c.name}
                        placeholder="e.g. Oat milk"
                        onChange={(e) => setChoice({ name: e.target.value })}
                      />
                      <input
                        aria-label="Choice in Arabic"
                        dir="rtl"
                        lang="ar"
                        value={c.nameAr}
                        placeholder="حليب الشوفان"
                        onChange={(e) => setChoice({ nameAr: e.target.value })}
                      />
                      <div className="currency-input">
                        <input
                          aria-label={`${c.name || "Choice"} extra price`}
                          inputMode="numeric"
                          value={c.price}
                          placeholder="0"
                          onChange={(e) => setChoice({ price: e.target.value.replace(/\D/g, "") })}
                        />
                        <span>L.L</span>
                      </div>
                      <button
                        type="button"
                        aria-label={`Delete ${c.name || "choice"}`}
                        onClick={() => setModifier(mi, { choices: m.choices.filter((_, i) => i !== ci) })}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="add-row"
                  onClick={() => setModifier(mi, { choices: [...m.choices, { name: "", nameAr: "", price: "" }] })}
                >
                  <Icon name="plus" /> Add choice
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              className="add-row"
              onClick={() =>
                update({
                  modifiers: [
                    ...item.modifiers,
                    { name: "", nameAr: "", min: "0", max: "1", choices: [{ name: "", nameAr: "", price: "" }] },
                  ],
                })
              }
            >
              <Icon name="plus" /> Add option group
            </button>
            {attempted && modifierInvalid && (
              <div className="price-error">
                <Icon name="warning" />
                Every option group needs a name and at least one named choice. “At least” can&apos;t be more than
                “at most”.
              </div>
            )}
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
              {item.availability !== "available" && (
                <p className={`preview-status ${item.availability}`}>{AVAILABILITY_LABELS[item.availability]}</p>
              )}
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
