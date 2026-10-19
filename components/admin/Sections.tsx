"use client";

import { useEffect, useState } from "react";
import { newKey, type DraftSection } from "@/lib/admin/draft";
import type { Publish } from "./AdminApp";
import { useAdminLanguage } from "./Language";
import { Button, ErrorBanner, Icon, PageHeader } from "./ui";

type Row = { key: string; name: string; nameAr: string; arDraft: boolean; isNew?: boolean };
const rowsOf = (sections: DraftSection[]): Row[] =>
  sections.map(({ key, name, nameAr, arDraft }) => ({ key, name, nameAr, arDraft }));

export function Sections({
  sections,
  publish,
  setDirty,
}: {
  sections: DraftSection[];
  publish: Publish;
  setDirty: (dirty: boolean) => void;
}) {
  const { lang, t } = useAdminLanguage();
  const [rows, setRows] = useState(() => rowsOf(sections));
  const [dirty, setLocalDirty] = useState(false);
  const [blocked, setBlocked] = useState<{ name: string; nameAr: string; count: number } | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const count = (key: string) => sections.find((s) => s.key === key)?.items.length ?? 0;

  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);

  const change = (next: Row[]) => {
    setRows(next);
    setLocalDirty(true);
  };
  const move = (index: number, offset: number) => {
    const next = [...rows];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    change(next);
  };
  const add = () => change([...rows, { key: newKey(), name: "", nameAr: "", arDraft: false, isNew: true }]);
  const patch = (key: string, p: Partial<Row>) =>
    change(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const remove = (row: Row) => {
    const n = count(row.key);
    if (n) setBlocked({ name: row.name, nameAr: row.nameAr, count: n });
    else change(rows.filter((r) => r.key !== row.key));
  };

  const save = async () => {
    if (rows.some((r) => !r.name.trim())) {
      setAttempted(true);
      setError("Every section needs a name. The website still shows the previous menu.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await publish(
        rows.map((r) => ({
          key: r.key,
          name: r.name.trim(),
          nameAr: r.nameAr.trim(),
          arDraft: r.arDraft,
          items: sections.find((s) => s.key === r.key)?.items ?? [],
        })),
        "Menu: update sections",
      );
      setRows((current) =>
        current.map((r) => ({ ...r, isNew: false, name: r.name.trim(), nameAr: r.nameAr.trim() })),
      );
      setLocalDirty(false);
      setAttempted(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page narrow-page">
      <PageHeader
        title={t("Sections", "الأقسام")}
        description={t(
          "Order and rename the sections shown on the public menu, in English and Arabic.",
          "رتّب الأقسام المعروضة في القائمة العامة وغيّر أسماءها بالإنجليزية والعربية.",
        )}
        actions={
          <Button icon="plus" onClick={add}>
            {t("Add section", "إضافة قسم")}
          </Button>
        }
      />
      {error && <ErrorBanner message={error} onClose={() => setError("")} />}
      <div className="info-banner">
        <Icon name="info" />
        {t(
          "A new section stays hidden on the website until it has at least one item.",
          "يبقى القسم الجديد مخفياً على الموقع حتى يحتوي على صنف واحد على الأقل.",
        )}
      </div>
      <section className="panel section-list">
        <div className="section-list-head">
          <span>{t("Section", "القسم")}</span>
          <span>{t("Items", "الأصناف")}</span>
          <span>{t("Order", "الترتيب")}</span>
          <span />
        </div>
        {rows.map((row, index) => (
          <div className={`section-row ${row.isNew ? "new-section" : ""}`} key={row.key}>
            <div className="section-name-wrap">
              <input
                aria-label={
                  row.name
                    ? t(`${row.name} section name`, `اسم قسم ${row.nameAr || row.name} بالإنجليزية`)
                    : t("New section name", "اسم القسم الجديد بالإنجليزية")
                }
                dir="ltr"
                lang="en"
                className={attempted && !row.name.trim() ? "error" : ""}
                value={row.name}
                autoFocus={row.isNew && index === rows.length - 1}
                placeholder={t("New section name", "اسم القسم الجديد بالإنجليزية")}
                onChange={(e) => patch(row.key, { name: e.target.value })}
              />
              <input
                aria-label={t(
                  `${row.name || "New section"} name in Arabic`,
                  `اسم ${row.nameAr || row.name || "القسم الجديد"} بالعربية`,
                )}
                dir="rtl"
                lang="ar"
                value={row.nameAr}
                placeholder="الاسم بالعربية"
                onChange={(e) => patch(row.key, { nameAr: e.target.value, arDraft: false })}
              />
              {row.arDraft && (
                <small className="draft-note">
                  {t("Arabic is a suggested translation.", "النص العربي ترجمة مقترحة.")}{" "}
                  <button
                    type="button"
                    className="inline-link"
                    onClick={() => patch(row.key, { arDraft: false })}
                  >
                    {t("Mark as checked", "تأكيد المراجعة")}
                  </button>
                </small>
              )}
              <small>
                {t(
                  "Renaming a section also changes its link on the website (e.g. /menu#hot-drinks).",
                  "تغيير اسم القسم يغيّر أيضاً رابطه على الموقع (مثلاً /menu#hot-drinks).",
                )}
              </small>
            </div>
            <span>{count(row.key)}</span>
            <div>
              <button
                type="button"
                aria-label={t(
                  `Move ${row.name || "section"} up`,
                  `نقل ${row.nameAr || row.name || "القسم"} إلى الأعلى`,
                )}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <Icon name="chevron" />
              </button>
              <button
                type="button"
                aria-label={t(
                  `Move ${row.name || "section"} down`,
                  `نقل ${row.nameAr || row.name || "القسم"} إلى الأسفل`,
                )}
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
              >
                <Icon name="chevron" />
              </button>
            </div>
            <button
              type="button"
              className="trash-button"
              aria-label={t(
                `Delete ${row.name || "new section"}`,
                `حذف ${row.nameAr || row.name || "القسم الجديد"}`,
              )}
              onClick={() => remove(row)}
            >
              <Icon name="trash" />
            </button>
          </div>
        ))}
      </section>
      <button type="button" className="mobile-add-section" onClick={add}>
        <Icon name="plus" /> {t("Add section", "إضافة قسم")}
      </button>
      {blocked && (
        <div className="blocked-message" role="alert">
          <Icon name="warning" />
          <span>
            <b>
              {t(
                `Can't delete ${blocked.name}.`,
                `لا يمكن حذف ${lang === "ar" ? blocked.nameAr || blocked.name : blocked.name}.`,
              )}
            </b>{" "}
            {t(
              `Move or delete its ${blocked.count} items first.`,
              `انقل أو احذف الأصناف التابعة له وعددها ${blocked.count} أولاً.`,
            )}
          </span>
          <button type="button" onClick={() => setBlocked(null)} aria-label={t("Dismiss", "إغلاق")}>
            <Icon name="close" />
          </button>
        </div>
      )}
      <div className="bottom-actions sections-save">
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
              setRows(rowsOf(sections));
              setLocalDirty(false);
              setAttempted(false);
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
