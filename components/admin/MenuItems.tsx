"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { emptyItem, newKey, type DraftItem, type DraftSection } from "@/lib/admin/draft";
import type { Editing, Publish } from "./AdminApp";
import { useAdminLanguage } from "./Language";
import { Button, ErrorBanner, Icon, ItemPrice, Modal, PageHeader, Tags, Thumbnail } from "./ui";

type Props = {
  sections: DraftSection[];
  publish: Publish;
  onEdit: (e: Editing) => void;
  onDelete: (item: DraftItem, from: DraftSection[]) => Promise<void>;
  setDirty: (dirty: boolean) => void;
};

export function MenuItems({ sections, publish, onEdit, onDelete, setDirty }: Props) {
  const { lang, t } = useAdminLanguage();
  const displayName = (entry: { name: string; nameAr: string }) =>
    lang === "ar" && entry.nameAr ? entry.nameAr : entry.name;
  const displayOptions = (item: DraftItem) =>
    item.options
      .map((option, index) => (lang === "ar" ? item.optionsAr[index] || option : option))
      .join(" · ");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  // Reordering is kept here until "Publish", so several moves make one change.
  const [pending, setPending] = useState<DraftSection[] | null>(null);
  const [toDelete, setToDelete] = useState<DraftItem | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const shown = pending ?? sections;
  const total = shown.reduce((n, s) => n + s.items.length, 0);

  useEffect(() => {
    setDirty(pending !== null);
  }, [pending, setDirty]);

  const q = query.trim().toLowerCase();
  const groups = shown
    .filter((s) => filter === "all" || s.key === filter)
    .map((s) => ({
      section: s,
      items: s.items.filter(
        (i) => !q || i.name.toLowerCase().includes(q) || i.nameAr.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.items.length);

  const move = (sectionKey: string, index: number, offset: number) =>
    setPending(
      shown.map((s) => {
        if (s.key !== sectionKey) return s;
        const items = [...s.items];
        [items[index], items[index + offset]] = [items[index + offset], items[index]];
        return { ...s, items };
      }),
    );

  const duplicate = (item: DraftItem, section: DraftSection) => {
    const names = new Set(shown.flatMap((s) => s.items.map((i) => i.name)));
    let name = `${item.name} (copy)`;
    for (let n = 2; names.has(name); n++) name = `${item.name} (copy ${n})`;
    onEdit({
      item: { ...item, key: newKey(), id: "", name },
      sectionKey: section.key,
      isNew: true,
      afterKey: item.key,
    });
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const heading = (s: DraftSection, count: number) => (
    <div className="group-heading">
      <b>{displayName(s)}</b>
      <span>
        {count === s.items.length
          ? t(`${count} items`, `${count} صنف`)
          : t(`${count} of ${s.items.length}`, `${count} من ${s.items.length}`)}
      </span>
    </div>
  );

  const actions = (item: DraftItem, section: DraftSection) => {
    const index = section.items.indexOf(item);
    return (
      <ActionMenu
        name={displayName(item)}
        canUp={!q && index > 0}
        canDown={!q && index < section.items.length - 1}
        onEdit={() => onEdit({ item, sectionKey: section.key, isNew: false })}
        onMove={(offset) => move(section.key, index, offset)}
        onDuplicate={() => duplicate(item, section)}
        onDelete={() => setToDelete(item)}
      />
    );
  };

  const open = (item: DraftItem, section: DraftSection) =>
    onEdit({ item, sectionKey: section.key, isNew: false });

  return (
    <div className="page">
      <PageHeader
        title={t("Menu items", "أصناف القائمة")}
        description={t(
          "Edit the food and drinks shown on the public website.",
          "عدّل المأكولات والمشروبات المعروضة على الموقع.",
        )}
        actions={
          <Button icon="plus" onClick={() => onEdit(newItem(shown, filter))}>
            {t("Add item", "إضافة صنف")}
          </Button>
        }
      />
      {error && <ErrorBanner message={error} onClose={() => setError("")} />}
      <section className="panel list-panel">
        <div className="toolbar">
          <label className="search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search menu items", "البحث في أصناف القائمة")}
              aria-label={t("Search menu items", "البحث في أصناف القائمة")}
            />
          </label>
          <select
            aria-label={t("Filter by section", "التصفية حسب القسم")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">{t("All sections", "جميع الأقسام")}</option>
            {shown.map((s) => (
              <option key={s.key} value={s.key}>
                {displayName(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="list-meta">
          <span>
            <b>{total}</b> {t(`items in ${shown.length} sections`, `صنف في ${shown.length} قسم`)}
          </span>
        </div>
        {groups.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("Item", "الصنف")}</th>
                    <th className="price-heading">{t("Price", "السعر")}</th>
                    <th>{t("Tags", "التصنيفات")}</th>
                    <th>
                      <span className="sr-only">{t("Actions", "الإجراءات")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(({ section, items }) => (
                    <Fragment key={section.key}>
                      <tr className="group-row">
                        <td colSpan={4}>{heading(section, items.length)}</td>
                      </tr>
                      {items.map((item) => (
                        <tr key={item.key} onClick={() => open(item, section)}>
                          <td>
                            <div className="item-cell">
                              <Thumbnail item={item} name={displayName(item)} />
                              <span>
                                <button
                                  type="button"
                                  className="item-name-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    open(item, section);
                                  }}
                                >
                                  {displayName(item)}
                                </button>
                                {item.options.length > 0 && <small>{displayOptions(item)}</small>}
                              </span>
                            </div>
                          </td>
                          <td className="table-price">
                            <ItemPrice item={item} />
                          </td>
                          <td>
                            <Tags values={item.tags} addon={item.addon} />
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>{actions(item, section)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-list">
              {groups.map(({ section, items }) => (
                <div className="item-group" key={section.key}>
                  {heading(section, items.length)}
                  {items.map((item) => (
                    <article className="item-card" key={item.key} onClick={() => open(item, section)}>
                      <Thumbnail item={item} name={displayName(item)} />
                      <div className="card-copy">
                        <button
                          type="button"
                          className="item-name-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            open(item, section);
                          }}
                        >
                          {displayName(item)}
                        </button>
                        {item.options.length > 0 && (
                          <small className="card-choices">{displayOptions(item)}</small>
                        )}
                        <b>
                          <ItemPrice item={item} />
                        </b>
                        <Tags values={item.tags} addon={item.addon} />
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>{actions(item, section)}</div>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div>
              <Icon name="search" />
            </div>
            <h2>{t(`No items match '${query}'.`, `لا توجد أصناف تطابق «${query}».`)}</h2>
            <p>{t("Clear the search to see all menu items.", "امسح البحث لعرض جميع أصناف القائمة.")}</p>
            <Button variant="secondary" onClick={() => setQuery("")}>
              {t("Clear search", "مسح البحث")}
            </Button>
          </div>
        )}
      </section>

      {pending && (
        <div className="bottom-actions list-save">
          <span>{t("Unsaved order changes", "تغييرات غير محفوظة في الترتيب")}</span>
          <div>
            <Button variant="secondary" onClick={() => setPending(null)} disabled={busy}>
              {t("Discard", "تجاهل")}
            </Button>
            <Button onClick={() => run(() => publish(pending, "Menu: reorder items"))} disabled={busy}>
              {busy ? t("Publishing…", "جارٍ النشر…") : t("Publish", "نشر")}
            </Button>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`mobile-fab ${pending ? "raised" : ""}`}
        onClick={() => onEdit(newItem(shown, filter))}
      >
        <Icon name="plus" /> {t("Add item", "إضافة صنف")}
      </button>

      {toDelete && (
        <Modal onClose={() => !busy && setToDelete(null)}>
          <div className="modal-icon danger">
            <Icon name="trash" />
          </div>
          <h2>{t(`Delete ${displayName(toDelete)}?`, `حذف ${displayName(toDelete)}؟`)}</h2>
          <p>
            {t(
              "It will disappear from the public menu after it's published.",
              "سيختفي من القائمة العامة بعد النشر.",
            )}
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setToDelete(null)} disabled={busy}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await onDelete(toDelete, shown);
                  setToDelete(null);
                })
              }
            >
              {busy ? t("Deleting…", "جارٍ الحذف…") : t("Delete and publish", "حذف ونشر")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** A blank item in the filtered section, or the first one. */
function newItem(sections: DraftSection[], filter: string): Editing {
  const section = sections.find((s) => s.key === filter) ?? sections[0];
  return {
    item: emptyItem(),
    sectionKey: section?.key ?? "",
    isNew: true,
  };
}

function ActionMenu({
  name,
  canUp,
  canDown,
  onEdit,
  onMove,
  onDuplicate,
  onDelete,
}: {
  name: string;
  canUp: boolean;
  canDown: boolean;
  onEdit: () => void;
  onMove: (offset: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useAdminLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const outside = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="action-menu" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="icon-button"
        aria-label={t(`Actions for ${name}`, `إجراءات ${name}`)}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="more" />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="menu-sheet-scrim"
            aria-label={t("Close actions", "إغلاق الإجراءات")}
            onClick={() => setOpen(false)}
          />
          <div className="menu-popover">
            <button type="button" ref={first} onClick={act(onEdit)}>
              {t("Edit", "تعديل")}
            </button>
            <button type="button" disabled={!canUp} onClick={act(() => onMove(-1))}>
              {t("Move up", "نقل للأعلى")}
            </button>
            <button type="button" disabled={!canDown} onClick={act(() => onMove(1))}>
              {t("Move down", "نقل للأسفل")}
            </button>
            <button type="button" onClick={act(onDuplicate)}>
              {t("Duplicate", "إنشاء نسخة")}
            </button>
            <button type="button" className="delete-action" onClick={act(onDelete)}>
              {t("Delete", "حذف")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
