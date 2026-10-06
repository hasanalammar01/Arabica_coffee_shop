"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { emptyItem, newKey, type DraftItem, type DraftSection } from "@/lib/admin/draft";
import type { Editing, Publish } from "./AdminApp";
import { Button, ErrorBanner, Icon, ItemPrice, Modal, PageHeader, Tags, Thumbnail } from "./ui";

type Props = {
  sections: DraftSection[];
  publish: Publish;
  onEdit: (e: Editing) => void;
  onDelete: (item: DraftItem, from: DraftSection[]) => Promise<void>;
  setDirty: (dirty: boolean) => void;
};

export function MenuItems({ sections, publish, onEdit, onDelete, setDirty }: Props) {
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
    .map((s) => ({ section: s, items: s.items.filter((i) => !q || i.name.toLowerCase().includes(q)) }))
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
      item: { ...item, key: newKey(), name },
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
      <b>{s.name}</b>
      <span>{count === s.items.length ? `${count} items` : `${count} of ${s.items.length}`}</span>
    </div>
  );

  const actions = (item: DraftItem, section: DraftSection) => {
    const index = section.items.indexOf(item);
    return (
      <ActionMenu
        name={item.name}
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
        title="Menu items"
        description="Edit the food and drinks shown on the public website."
        actions={
          <Button icon="plus" onClick={() => onEdit(newItem(shown, filter))}>
            Add item
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
              placeholder="Search menu items"
              aria-label="Search menu items"
            />
          </label>
          <select aria-label="Filter by section" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All sections</option>
            {shown.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="list-meta">
          <span>
            <b>{total}</b> items in {shown.length} sections
          </span>
        </div>
        {groups.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="price-heading">Price</th>
                    <th>Tags</th>
                    <th>
                      <span className="sr-only">Actions</span>
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
                              <Thumbnail item={item} name={item.name} />
                              <span>
                                <button
                                  type="button"
                                  className="item-name-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    open(item, section);
                                  }}
                                >
                                  {item.name}
                                </button>
                                {item.options.length > 0 && <small>{item.options.join(" · ")}</small>}
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
                      <Thumbnail item={item} name={item.name} />
                      <div className="card-copy">
                        <button
                          type="button"
                          className="item-name-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            open(item, section);
                          }}
                        >
                          {item.name}
                        </button>
                        {item.options.length > 0 && (
                          <small className="card-choices">{item.options.join(" · ")}</small>
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
            <h2>No items match &apos;{query}&apos;.</h2>
            <p>Clear the search to see all menu items.</p>
            <Button variant="secondary" onClick={() => setQuery("")}>
              Clear search
            </Button>
          </div>
        )}
      </section>

      {pending && (
        <div className="bottom-actions list-save">
          <span>Unsaved order changes</span>
          <div>
            <Button variant="secondary" onClick={() => setPending(null)} disabled={busy}>
              Discard
            </Button>
            <Button onClick={() => run(() => publish(pending, "Menu: reorder items"))} disabled={busy}>
              {busy ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`mobile-fab ${pending ? "raised" : ""}`}
        onClick={() => onEdit(newItem(shown, filter))}
      >
        <Icon name="plus" /> Add item
      </button>

      {toDelete && (
        <Modal onClose={() => !busy && setToDelete(null)}>
          <div className="modal-icon danger">
            <Icon name="trash" />
          </div>
          <h2>Delete {toDelete.name}?</h2>
          <p>It will disappear from the public menu after it&apos;s published.</p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setToDelete(null)} disabled={busy}>
              Cancel
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
              {busy ? "Deleting…" : "Delete and publish"}
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
        aria-label={`Actions for ${name}`}
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
            aria-label="Close actions"
            onClick={() => setOpen(false)}
          />
          <div className="menu-popover">
            <button type="button" ref={first} onClick={act(onEdit)}>
              Edit
            </button>
            <button type="button" disabled={!canUp} onClick={act(() => onMove(-1))}>
              Move up
            </button>
            <button type="button" disabled={!canDown} onClick={act(() => onMove(1))}>
              Move down
            </button>
            <button type="button" onClick={act(onDuplicate)}>
              Duplicate
            </button>
            <button type="button" className="delete-action" onClick={act(onDelete)}>
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
