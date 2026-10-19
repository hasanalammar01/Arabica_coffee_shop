"use client";

import { useEffect, useRef, useState } from "react";
import { ALLERGENS, AVAILABILITY, TAGS, type Allergen, type Availability, type Tag } from "@/data/menu";
import { preparePhoto, type DraftItem, type DraftModifier, type DraftSection } from "@/lib/admin/draft";
import { t as getDict } from "@/lib/i18n";
import type { Editing } from "./AdminApp";
import { useAdminLanguage } from "./Language";
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

export type Destination = { sectionKey: string } | { newSection: string };

type Props = {
  editing: Editing;
  sections: DraftSection[];
  onBack: () => void;
  onPublish: (item: DraftItem, to: Destination) => Promise<void>;
  onDelete: () => Promise<void>;
  setDirty: (dirty: boolean) => void;
};

/** The three ways guests choose from a group, stored as min/max picks. "any" keeps its "up to". */
type ChooseRule = "one" | "one-optional" | "any";
const RULES: Record<ChooseRule, Pick<DraftModifier, "min" | "max">> = {
  one: { min: "1", max: "1" },
  "one-optional": { min: "0", max: "1" },
  any: { min: "0", max: "" },
};
const chooseRule = (m: DraftModifier): ChooseRule =>
  m.max === "1" ? (Number(m.min || 0) >= 1 ? "one" : "one-optional") : "any";

export function ItemEditor({ editing, sections, onBack, onPublish, onDelete, setDirty }: Props) {
  const { lang, t } = useAdminLanguage();
  const dict = getDict(lang);
  const displayName = (entry: { name: string; nameAr: string }) =>
    lang === "ar" && entry.nameAr ? entry.nameAr : entry.name;
  const availabilityLabels: Record<Availability, string> = {
    available: t("Available", "متوفر"),
    soldout: t("Sold out", "نفد"),
    hidden: t("Hidden from website", "مخفي عن الموقع"),
  };
  const original = editing.item;
  const [item, setItem] = useState(original);
  const [pricing, setPricing] = useState<"single" | "size">(original.sizes.length ? "size" : "single");
  const [sectionKey, setSectionKey] = useState(editing.sectionKey);
  const [newSection, setNewSection] = useState<string | null>(sections.length ? null : "");
  const [choiceText, setChoiceText] = useState("");
  // A duplicate starts with content, so it can be published straight away.
  const [dirty, setLocalDirty] = useState(editing.isNew && original.name !== "");
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<string | { en: string; ar: string }>("");
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

  // Other items that already have order options, to copy them in one step.
  const copySources = sections
    .flatMap((s) => s.items)
    .filter((i) => i.key !== item.key && i.modifiers.length > 0);

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
    ? { en: "needs a name", ar: "يحتاج إلى اسم" }
    : newSection !== null && !newSection.trim()
      ? { en: "needs a section name", ar: "يحتاج إلى اسم قسم" }
      : priceMissing
        ? { en: "needs a price", ar: "يحتاج إلى سعر" }
        : sizeInvalid
          ? { en: "needs a name and price for every size", ar: "يحتاج إلى اسم وسعر لكل حجم" }
          : modifierInvalid
            ? {
                en: "has an order option without a name or choices",
                ar: "يحتوي على خيار طلب بلا اسم أو اختيارات",
              }
            : null;

  const selectedSection = sections.find((s) => s.key === sectionKey);

  const publish = async () => {
    if (problem) {
      setAttempted(true);
      const sectionEn =
        newSection !== null ? newSection.trim() || "New section" : selectedSection?.name || "Section";
      const sectionAr =
        newSection !== null
          ? newSection.trim() || "قسم جديد"
          : selectedSection?.nameAr || selectedSection?.name || "القسم";
      setError({
        en: `${sectionEn} → ${item.name.trim() || "Untitled item"} ${problem.en}. The website still shows the previous menu.`,
        ar: `${sectionAr} → ${item.nameAr.trim() || item.name.trim() || "صنف بلا اسم"} ${problem.ar}. لا يزال الموقع يعرض القائمة السابقة.`,
      });
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
    else
      document
        .querySelector<HTMLInputElement>(".size-row.invalid input, .modifier-group input.error")
        ?.focus();
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const upload = await preparePhoto(file);
      update({ upload, preview: URL.createObjectURL(upload) });
    } catch {
      setError({
        en: "This photo couldn't be read. Try a JPG, PNG or WebP image.",
        ar: "تعذّرت قراءة الصورة. جرّب صورة بصيغة JPG أو PNG أو WebP.",
      });
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
    update({
      allergens: item.allergens.includes(a) ? item.allergens.filter((x) => x !== a) : [...item.allergens, a],
    });
  const setModifier = (index: number, patch: Partial<DraftModifier>) =>
    update({ modifiers: item.modifiers.map((m, i) => (i === index ? { ...m, ...patch } : m)) });

  const setPricingMode = (mode: "single" | "size") => {
    setPricing(mode);
    if (mode === "size" && !item.sizes.length) update({ sizes: [{ size: "", sizeAr: "", price: "" }] });
    else setLocalDirty(true);
  };

  const back = () => (dirty ? setLeaving(true) : onBack());
  const hasPhoto = Boolean(item.preview || item.image);
  const previewDescription = lang === "ar" ? item.descriptionAr || item.description : item.description;
  const previewIngredients = lang === "ar" ? item.ingredientsAr || item.ingredients : item.ingredients;
  const sizeText = sizes
    .filter((s) => s.size && s.price)
    .map((s) => `${lang === "ar" ? s.sizeAr || s.size : s.size} ${formatLbp(s.price)} ${t("L.L", "ل.ل")}`)
    .join(" · ");
  const previewPrice =
    pricing === "single" && item.price ? (
      <>
        {formatLbp(item.price)} <small>{t("L.L", "ل.ل")}</small>
      </>
    ) : (
      sizeText || <small>{t("No price yet", "لم يُضف سعر بعد")}</small>
    );

  return (
    <div className="page editor-page">
      <button type="button" className="back-link" onClick={back}>
        {t("← Menu items", "→ أصناف القائمة")}
      </button>
      <PageHeader
        title={
          editing.isNew
            ? t("Add menu item", "إضافة صنف")
            : t(`Edit ${displayName(original)}`, `تعديل ${displayName(original)}`)
        }
        description={t(
          "Changes publish directly to the public website.",
          "تُنشر التغييرات مباشرةً على الموقع العام.",
        )}
      />
      {error && (
        <ErrorBanner
          message={typeof error === "string" ? error : t(error.en, error.ar)}
          onFix={problem ? fix : undefined}
          onClose={() => setError("")}
        />
      )}

      <div className="editor-layout">
        <div className="form-column">
          <section className="form-section">
            <div className="section-title">
              <h2>{t("Availability", "التوفر")}</h2>
              <p>
                {t(
                  "Sold out keeps the item on the menu, greyed out. Hidden takes it off the website without deleting it.",
                  "يبقى الصنف النافد في القائمة بلون باهت. ويُزال الصنف المخفي من الموقع دون حذفه.",
                )}
              </p>
            </div>
            <div className="segmented" role="group" aria-label={t("Availability", "التوفر")}>
              {AVAILABILITY.map((a) => (
                <button
                  type="button"
                  key={a}
                  aria-pressed={item.availability === a}
                  className={item.availability === a ? "selected" : ""}
                  onClick={() => update({ availability: a })}
                >
                  {availabilityLabels[a]}
                </button>
              ))}
            </div>
            <div className="addon-setting">
              <div>
                <b>{t("Feature on the home page", "إبراز على الصفحة الرئيسية")}</b>
                <p>
                  {t(
                    "Shown under “Signature picks”. Choose a few of the café's best items.",
                    "يظهر ضمن «أصنافنا المميزة». اختر بعضاً من أفضل أصناف المقهى.",
                  )}
                </p>
              </div>
              <Toggle
                checked={item.signature}
                onChange={(signature) => update({ signature })}
                label={t("Feature this item on the home page", "إبراز هذا الصنف على الصفحة الرئيسية")}
              />
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">
              <h2>{t("Details", "التفاصيل")}</h2>
              <p>{t("What guests see on the menu.", "ما يراه الزبائن في القائمة.")}</p>
            </div>
            <div className="form-grid">
              <Field label={t("Name", "الاسم بالإنجليزية")} required>
                <input
                  dir="ltr"
                  lang="en"
                  ref={nameRef}
                  className={attempted && !item.name.trim() ? "error" : ""}
                  value={item.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder={t("Item name", "اسم الصنف بالإنجليزية")}
                />
                {attempted && !item.name.trim() && (
                  <span className="error-text">{t("Enter a name.", "أدخل اسماً.")}</span>
                )}
              </Field>
              {newSection === null ? (
                <Field label={t("Section", "القسم")} required>
                  <select
                    value={sectionKey}
                    onChange={(e) => {
                      setSectionKey(e.target.value);
                      setLocalDirty(true);
                    }}
                  >
                    {sections.map((s) => (
                      <option key={s.key} value={s.key}>
                        {displayName(s)}
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
                    <Icon name="plus" size={17} /> {t("New section", "قسم جديد")}
                  </button>
                </Field>
              ) : (
                <Field label={t("New section name", "اسم القسم الجديد بالإنجليزية")} required>
                  <input
                    dir="ltr"
                    lang="en"
                    autoFocus
                    className={attempted && !newSection.trim() ? "error" : ""}
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    placeholder={t("e.g. Breakfast", "مثلاً: Breakfast")}
                  />
                  {sections.length > 0 && (
                    <button type="button" className="inline-link" onClick={() => setNewSection(null)}>
                      {t("Choose an existing section", "اختيار قسم موجود")}
                    </button>
                  )}
                </Field>
              )}
            </div>
            <Field
              label={t("Name in Arabic", "الاسم بالعربية")}
              hint={
                item.arDraft
                  ? t(
                      "Suggested translation. Check it before relying on it.",
                      "ترجمة مقترحة. راجعها قبل اعتمادها.",
                    )
                  : t(
                      "Shown on the Arabic menu. Empty shows the English name.",
                      "يظهر في القائمة العربية. إذا تركته فارغاً، يظهر الاسم الإنجليزي.",
                    )
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
                  <Icon name="check" size={17} /> {t("The Arabic name is correct", "الاسم العربي صحيح")}
                </button>
              )}
            </Field>
            <Field
              label={t("What's in it", "وصف الصنف بالإنجليزية")}
              hint={t(
                `Optional · guests see it when they tap the item · ${item.description.length}/140`,
                `اختياري · يراه الزبائن عند الضغط على الصنف · ${item.description.length}/140`,
              )}
            >
              <textarea
                dir="ltr"
                lang="en"
                value={item.description}
                onChange={(e) => update({ description: e.target.value })}
                maxLength={140}
                placeholder={t(
                  "e.g. Double espresso, steamed milk and caramel sauce",
                  "مثلاً بالإنجليزية: Double espresso, steamed milk and caramel sauce",
                )}
              />
            </Field>
            <Field
              label={t("What's in it, in Arabic", "وصف الصنف بالعربية")}
              hint={t(
                `Optional · ${item.descriptionAr.length}/140`,
                `اختياري · ${item.descriptionAr.length}/140`,
              )}
            >
              <textarea
                dir="rtl"
                lang="ar"
                value={item.descriptionAr}
                onChange={(e) => update({ descriptionAr: e.target.value })}
                maxLength={140}
              />
            </Field>
            <div className="upload-row">
              <Thumbnail item={item} name={displayName(item)} />
              <div>
                <b>{t("Photo", "الصورة")}</b>
                <p>
                  {t(
                    "A cut-out photo on a transparent background looks best.",
                    "تبدو الصورة المقصوصة على خلفية شفافة أفضل.",
                  )}
                </p>
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
                    {hasPhoto ? t("Replace photo", "استبدال الصورة") : t("Upload photo", "رفع صورة")}
                  </Button>
                  {hasPhoto && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => update({ image: "", upload: undefined, preview: undefined })}
                    >
                      {t("Remove", "إزالة")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">
              <h2>{t("Price", "السعر")}</h2>
              <p>{t("Lebanese pounds, entered as whole numbers.", "بالليرة اللبنانية، بأعداد صحيحة.")}</p>
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
                  {mode === "single"
                    ? t("Single price", "سعر موحّد")
                    : t("Prices by size", "أسعار حسب الحجم")}
                </button>
              ))}
            </div>
            {pricing === "single" ? (
              <Field label={t("Price", "السعر")}>
                <div className="currency-input">
                  <input
                    dir="ltr"
                    ref={priceRef}
                    className={attempted && priceMissing ? "error" : ""}
                    value={item.price}
                    onChange={(e) => update({ price: e.target.value.replace(/\D/g, "") })}
                    inputMode="numeric"
                    placeholder="400000"
                  />
                  <span>{t("L.L", "ل.ل")}</span>
                </div>
                {item.price && (
                  <span className="field-hint">
                    {t(`Shown as ${formatLbp(item.price)} L.L`, `يظهر كالتالي: ${formatLbp(item.price)} ل.ل`)}
                  </span>
                )}
              </Field>
            ) : (
              <div className="size-prices">
                <div className="size-head">
                  <span>{t("Size name", "اسم الحجم بالإنجليزية")}</span>
                  <span>{t("In Arabic", "بالعربية")}</span>
                  <span>{t("Price", "السعر")}</span>
                  <span />
                </div>
                {item.sizes.map((size, index) => (
                  <div
                    key={index}
                    className={`size-row ${attempted && (!size.size.trim() || !Number(size.price)) ? "invalid" : ""}`}
                  >
                    <input
                      dir="ltr"
                      lang="en"
                      aria-label={t("Size name", "اسم الحجم بالإنجليزية")}
                      value={size.size}
                      placeholder={t("Small", "Small (صغير)")}
                      onChange={(e) =>
                        update({
                          sizes: item.sizes.map((s, i) => (i === index ? { ...s, size: e.target.value } : s)),
                        })
                      }
                    />
                    <input
                      aria-label={t(
                        `${size.size || "Size"} name in Arabic`,
                        `اسم ${size.sizeAr || size.size || "الحجم"} بالعربية`,
                      )}
                      dir="rtl"
                      lang="ar"
                      value={size.sizeAr}
                      placeholder="صغير"
                      onChange={(e) =>
                        update({
                          sizes: item.sizes.map((s, i) =>
                            i === index ? { ...s, sizeAr: e.target.value } : s,
                          ),
                        })
                      }
                    />
                    <div className="currency-input">
                      <input
                        dir="ltr"
                        aria-label={t(
                          `${size.size || "Size"} price`,
                          `سعر ${size.sizeAr || size.size || "الحجم"}`,
                        )}
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
                      <span>{t("L.L", "ل.ل")}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={t(
                        `Delete ${size.size || "size"}`,
                        `حذف ${size.sizeAr || size.size || "الحجم"}`,
                      )}
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
                  <Icon name="plus" /> {t("Add size", "إضافة حجم")}
                </button>
              </div>
            )}
            {attempted && (priceMissing || sizeInvalid) && (
              <div className="price-error">
                <Icon name="warning" />
                {t(
                  "Add a price, or at least one size with a price. Every size needs a name and price.",
                  "أضف سعراً، أو حجماً واحداً على الأقل بسعر. يحتاج كل حجم إلى اسم وسعر.",
                )}
              </div>
            )}
          </section>

          <section className="form-section">
            <div className="section-title">
              <h2>{t("Choices and tags", "الاختيارات والتصنيفات")}</h2>
              <p>
                {t(
                  "Add options that do not change the price. Guests see them when they tap the item.",
                  "أضف اختيارات لا تغيّر السعر. يراها الزبائن عند الضغط على الصنف.",
                )}
              </p>
            </div>
            <Field
              label={t("Flavours / choices", "النكهات / الاختيارات بالإنجليزية")}
              hint={t(
                "Choices that don't change the price, e.g. Peach, Lemon.",
                "اختيارات لا تغيّر السعر، مثل الخوخ والليمون.",
              )}
            >
              <div className="chip-input">
                {item.options.map((choice) => (
                  <span className="choice-chip" key={choice}>
                    <span dir="ltr" lang="en">
                      {choice}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const n = item.options.indexOf(choice);
                        update({
                          options: item.options.filter((_, i) => i !== n),
                          optionsAr: item.optionsAr.filter((_, i) => i !== n),
                        });
                      }}
                      aria-label={t(`Remove ${choice}`, `إزالة ${choice}`)}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </span>
                ))}
                <input
                  dir="ltr"
                  lang="en"
                  value={choiceText}
                  onChange={(e) => setChoiceText(e.target.value)}
                  onBlur={addChoice}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addChoice();
                    }
                  }}
                  placeholder={
                    item.options.length
                      ? t("Add another", "أضف اختياراً آخر")
                      : t("Type a choice and press Enter", "اكتب اختياراً بالإنجليزية واضغط Enter")
                  }
                />
              </div>
            </Field>
            {item.options.length > 0 && (
              <Field
                label={t("Choices in Arabic", "الاختيارات بالعربية")}
                hint={t(
                  "Optional. Empty ones show in English on the Arabic menu.",
                  "اختياري. تظهر الاختيارات الفارغة بالإنجليزية في القائمة العربية.",
                )}
              >
                <div className="choice-ar-list">
                  {item.options.map((choice, n) => (
                    <label key={choice}>
                      <span dir="ltr" lang="en">
                        {choice}
                      </span>
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
            <Field
              label={t("Tags", "التصنيفات")}
              hint={t(
                "Only tick dietary tags the café has confirmed.",
                "اختر التصنيفات الغذائية التي أكدها المقهى فقط.",
              )}
            >
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
                    {dict.tags[tag]}
                  </button>
                ))}
              </div>
            </Field>
            <div className="addon-setting">
              <div>
                <b>{t("This is an add-on (e.g. Add cheese)", "هذا الصنف إضافة (مثلاً: إضافة جبنة)")}</b>
                <p>{t("Shown smaller at the end of its section.", "يظهر بحجم أصغر في نهاية القسم.")}</p>
              </div>
              <Toggle
                checked={item.addon}
                onChange={(addon) => update({ addon })}
                label={t("This item is an add-on", "هذا الصنف إضافة")}
              />
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">
              <h2>{t("Allergens", "مسببات الحساسية")}</h2>
              <p>
                {t(
                  "Guests see these when they tap the item. Leave them empty until the café confirms them.",
                  "يراها الزبائن عند الضغط على الصنف. اتركها فارغة حتى يؤكدها المقهى.",
                )}
              </p>
            </div>
            {/* "What's in it" replaces Ingredients; shown only so older items can still be edited or cleared. */}
            {(original.ingredients || original.ingredientsAr) && (
              <>
                <Field
                  label={t("Ingredients", "المكونات بالإنجليزية")}
                  hint={t(
                    "Older field · better to move this into What's in it and clear it",
                    "حقل قديم · يُفضّل نقل محتواه إلى وصف الصنف ثم مسحه",
                  )}
                >
                  <textarea
                    dir="ltr"
                    lang="en"
                    value={item.ingredients}
                    onChange={(e) => update({ ingredients: e.target.value })}
                    maxLength={300}
                  />
                </Field>
                <Field
                  label={t("Ingredients in Arabic", "المكونات بالعربية")}
                  hint={t("Older field", "حقل قديم")}
                >
                  <textarea
                    dir="rtl"
                    lang="ar"
                    value={item.ingredientsAr}
                    onChange={(e) => update({ ingredientsAr: e.target.value })}
                    maxLength={300}
                  />
                </Field>
              </>
            )}
            <Field label={t("Contains (allergens)", "يحتوي على (مسببات الحساسية)")}>
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
                    {dict.allergens[a]}
                  </button>
                ))}
              </div>
            </Field>
          </section>

          <section className="form-section">
            <div className="section-title">
              <h2>{t("Order options", "خيارات الطلب")}</h2>
              <p>
                {t(
                  "Choices like Nestlé (with / without) or the number of presses (1, 1½, 2). Guests see them as a list in the item's details and choose when ordering online. A price is added to the item price.",
                  "اختيارات مثل نستله (مع / بدون) أو عدد الضغطات (1، 1½، 2). تظهر كقائمة في تفاصيل الصنف ويختار منها الزبائن عند الطلب عبر الموقع. يُضاف سعر الاختيار إلى سعر الصنف.",
                )}
              </p>
            </div>
            {copySources.length > 0 && (
              <Field
                label={t("Copy choices from another item", "نسخ الاختيارات من صنف آخر")}
                hint={t(
                  "Replaces this item's order options with a copy.",
                  "يستبدل خيارات طلب هذا الصنف بنسخة من الصنف المختار.",
                )}
              >
                <select
                  value=""
                  onChange={(e) => {
                    const source = copySources.find((i) => i.key === e.target.value);
                    if (source) update({ modifiers: structuredClone(source.modifiers) });
                  }}
                >
                  <option value="">{t("Choose an item…", "اختر صنفاً…")}</option>
                  {copySources.map((i) => (
                    <option key={i.key} value={i.key}>
                      {displayName(i)} ({i.modifiers.map(displayName).join(t(", ", "، "))})
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {item.modifiers.map((m, mi) => (
              <fieldset className="modifier-group" key={mi}>
                <legend className="sr-only">{t(`Option group ${mi + 1}`, `مجموعة خيارات ${mi + 1}`)}</legend>
                <div className="size-row">
                  <input
                    dir="ltr"
                    lang="en"
                    aria-label={t("Option group name", "اسم مجموعة الخيارات بالإنجليزية")}
                    className={attempted && !m.name.trim() ? "error" : ""}
                    value={m.name}
                    placeholder={t("e.g. Milk", "مثلاً: Milk")}
                    onChange={(e) => setModifier(mi, { name: e.target.value })}
                  />
                  <input
                    aria-label={t("Option group name in Arabic", "اسم مجموعة الخيارات بالعربية")}
                    dir="rtl"
                    lang="ar"
                    value={m.nameAr}
                    placeholder="الحليب"
                    onChange={(e) => setModifier(mi, { nameAr: e.target.value })}
                  />
                  <span />
                  <button
                    type="button"
                    aria-label={t(
                      `Delete ${m.name || "option group"}`,
                      `حذف ${displayName(m) || "مجموعة الخيارات"}`,
                    )}
                    onClick={() => update({ modifiers: item.modifiers.filter((_, i) => i !== mi) })}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
                <div className="modifier-rules">
                  <label>
                    {t("How guests choose", "طريقة اختيار الزبائن")}
                    <select
                      value={chooseRule(m)}
                      onChange={(e) => setModifier(mi, RULES[e.target.value as ChooseRule])}
                    >
                      <option value="one">{t("Pick one (required)", "اختيار واحد (مطلوب)")}</option>
                      <option value="one-optional">
                        {t("Pick one (optional)", "اختيار واحد (اختياري)")}
                      </option>
                      <option value="any">{t("Pick any", "اختيارات متعددة")}</option>
                    </select>
                  </label>
                  {chooseRule(m) === "any" && (
                    <label>
                      {t("up to", "حتى")}
                      <input
                        dir="ltr"
                        inputMode="numeric"
                        value={m.max}
                        placeholder={t("no limit", "بلا حد")}
                        onChange={(e) => setModifier(mi, { max: e.target.value.replace(/\D/g, "") })}
                      />
                    </label>
                  )}
                </div>
                {chooseRule(m) === "one" && (
                  <p className="field-hint">
                    {t(
                      "The first choice is pre-selected for guests, so put the usual one first.",
                      "يُحدَّد الاختيار الأول تلقائياً للزبائن، لذا ضع الاختيار المعتاد أولاً.",
                    )}
                  </p>
                )}
                {m.choices.map((c, ci) => {
                  const setChoice = (patch: Partial<DraftModifier["choices"][number]>) =>
                    setModifier(mi, {
                      choices: m.choices.map((x, i) => (i === ci ? { ...x, ...patch } : x)),
                    });
                  return (
                    <div className={`size-row ${attempted && !c.name.trim() ? "invalid" : ""}`} key={ci}>
                      <input
                        dir="ltr"
                        lang="en"
                        aria-label={t("Choice", "الاختيار بالإنجليزية")}
                        value={c.name}
                        placeholder={t("e.g. Oat milk", "مثلاً: Oat milk")}
                        onChange={(e) => setChoice({ name: e.target.value })}
                      />
                      <input
                        aria-label={t("Choice in Arabic", "الاختيار بالعربية")}
                        dir="rtl"
                        lang="ar"
                        value={c.nameAr}
                        placeholder="حليب الشوفان"
                        onChange={(e) => setChoice({ nameAr: e.target.value })}
                      />
                      <div className="currency-input">
                        <input
                          dir="ltr"
                          aria-label={t(
                            `${c.name || "Choice"} extra price`,
                            `السعر الإضافي لـ${displayName(c) || "الاختيار"}`,
                          )}
                          inputMode="numeric"
                          value={c.price}
                          placeholder="0"
                          onChange={(e) => setChoice({ price: e.target.value.replace(/\D/g, "") })}
                        />
                        <span>{t("L.L", "ل.ل")}</span>
                      </div>
                      <button
                        type="button"
                        aria-label={t(`Delete ${c.name || "choice"}`, `حذف ${displayName(c) || "الاختيار"}`)}
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
                  onClick={() =>
                    setModifier(mi, { choices: [...m.choices, { name: "", nameAr: "", price: "" }] })
                  }
                >
                  <Icon name="plus" /> {t("Add choice", "إضافة اختيار")}
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
                    { name: "", nameAr: "", ...RULES.one, choices: [{ name: "", nameAr: "", price: "" }] },
                  ],
                })
              }
            >
              <Icon name="plus" /> {t("Add option group", "إضافة مجموعة خيارات")}
            </button>
            {attempted && modifierInvalid && (
              <div className="price-error">
                <Icon name="warning" />
                {t(
                  "Every option group needs a name and at least one named choice.",
                  "تحتاج كل مجموعة خيارات إلى اسم واختيار واحد مُسمّى على الأقل.",
                )}
              </div>
            )}
          </section>

          {!editing.isNew && (
            <button type="button" className="delete-item-button" onClick={() => setDeleting(true)}>
              <Icon name="trash" /> {t("Delete item", "حذف الصنف")}
            </button>
          )}

          <div className="bottom-actions">
            <span>
              {busy
                ? t("Publishing…", "جارٍ النشر…")
                : dirty
                  ? t("Unsaved changes", "تغييرات غير محفوظة")
                  : t("No changes", "لا توجد تغييرات")}
            </span>
            <div>
              <Button variant="secondary" onClick={back} disabled={busy}>
                {t("Discard", "تجاهل")}
              </Button>
              <Button onClick={publish} disabled={!dirty || busy}>
                {busy ? t("Publishing…", "جارٍ النشر…") : t("Publish", "نشر")}
              </Button>
            </div>
          </div>
        </div>

        <aside className="preview-column">
          <div className="preview-sticky">
            <div className="preview-head">
              <span>{t("Live preview", "معاينة مباشرة")}</span>
              <a href={lang === "ar" ? "/ar/menu" : "/menu"} target="_blank" rel="noreferrer">
                <Icon name="eye" /> {t("View menu", "عرض القائمة")}
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
                    <h3>{displayName(item) || t("Item name", "اسم الصنف")}</h3>
                    <b>{previewPrice}</b>
                  </div>
                </>
              ) : (
                <div className="public-item-line">
                  <h3>{displayName(item) || t("Item name", "اسم الصنف")}</h3>
                  <i />
                  <b>{previewPrice}</b>
                </div>
              )}
              <Tags values={item.tags} addon={item.addon} />
              {item.availability !== "available" && (
                <p className={`preview-status ${item.availability}`}>
                  {availabilityLabels[item.availability]}
                </p>
              )}
              {/* Shown open here; on the menu it opens when guests tap the item. */}
              {(previewDescription ||
                item.options.length > 0 ||
                previewIngredients ||
                item.allergens.length > 0) && (
                <div className="preview-tab">
                  {previewDescription && <p>{previewDescription}</p>}
                  {item.options.length > 0 && (
                    <p>
                      <b>{t("Choose from", "اختر من")}</b>
                      {item.options
                        .map((option, index) => (lang === "ar" ? item.optionsAr[index] || option : option))
                        .join(" · ")}
                    </p>
                  )}
                  {previewIngredients && (
                    <p>
                      <b>{t("Ingredients", "المكونات")}</b>
                      {previewIngredients}
                    </p>
                  )}
                  {item.allergens.length > 0 && (
                    <p>
                      <b>{t("Contains", "يحتوي على")}</b>
                      {item.allergens.map((a) => dict.allergens[a]).join(t(", ", "، "))}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {leaving && (
        <Modal onClose={() => setLeaving(false)}>
          <div className="modal-icon">
            <Icon name="warning" />
          </div>
          <h2>{t("Discard changes?", "تجاهل التغييرات؟")}</h2>
          <p>{t("Your unpublished edits will be lost.", "ستفقد التعديلات التي لم تُنشر.")}</p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setLeaving(false)}>
              {t("Keep editing", "متابعة التعديل")}
            </Button>
            <Button variant="danger" onClick={onBack}>
              {t("Discard", "تجاهل")}
            </Button>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal onClose={() => !busy && setDeleting(false)}>
          <div className="modal-icon danger">
            <Icon name="trash" />
          </div>
          <h2>{t(`Delete ${displayName(original)}?`, `حذف ${displayName(original)}؟`)}</h2>
          <p>
            {t(
              "It will disappear from the public menu after it's published.",
              "سيختفي من القائمة العامة بعد النشر.",
            )}
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setDeleting(false)} disabled={busy}>
              {t("Cancel", "إلغاء")}
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
              {busy ? t("Deleting…", "جارٍ الحذف…") : t("Delete and publish", "حذف ونشر")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
