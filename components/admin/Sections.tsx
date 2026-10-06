"use client";

import { useEffect, useState } from "react";
import { newKey, type DraftSection } from "@/lib/admin/draft";
import type { Publish } from "./AdminApp";
import { Button, ErrorBanner, Icon, PageHeader } from "./ui";

type Row = { key: string; name: string; isNew?: boolean };
const rowsOf = (sections: DraftSection[]): Row[] => sections.map((s) => ({ key: s.key, name: s.name }));

export function Sections({
  sections,
  publish,
  setDirty,
}: {
  sections: DraftSection[];
  publish: Publish;
  setDirty: (dirty: boolean) => void;
}) {
  const [rows, setRows] = useState(() => rowsOf(sections));
  const [dirty, setLocalDirty] = useState(false);
  const [blocked, setBlocked] = useState<{ name: string; count: number } | null>(null);
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
  const add = () => change([...rows, { key: newKey(), name: "", isNew: true }]);
  const remove = (row: Row) => {
    const n = count(row.key);
    if (n) setBlocked({ name: row.name, count: n });
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
          items: sections.find((s) => s.key === r.key)?.items ?? [],
        })),
        "Menu: update sections",
      );
      setRows((current) => current.map(({ key, name }) => ({ key, name: name.trim() })));
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
        title="Sections"
        description="Order and rename the sections shown on the public menu."
        actions={
          <Button icon="plus" onClick={add}>
            Add section
          </Button>
        }
      />
      {error && <ErrorBanner message={error} onClose={() => setError("")} />}
      <div className="info-banner">
        <Icon name="info" />A new section stays hidden on the website until it has at least one item.
      </div>
      <section className="panel section-list">
        <div className="section-list-head">
          <span>Section</span>
          <span>Items</span>
          <span>Order</span>
          <span />
        </div>
        {rows.map((row, index) => (
          <div className={`section-row ${row.isNew ? "new-section" : ""}`} key={row.key}>
            <div className="section-name-wrap">
              <input
                aria-label={row.name ? `${row.name} section name` : "New section name"}
                className={attempted && !row.name.trim() ? "error" : ""}
                value={row.name}
                autoFocus={row.isNew && index === rows.length - 1}
                placeholder="New section name"
                onChange={(e) =>
                  change(rows.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r)))
                }
              />
              <small>Renaming a section also changes its link on the website (e.g. /menu#hot-drinks).</small>
            </div>
            <span>{count(row.key)}</span>
            <div>
              <button
                type="button"
                aria-label={`Move ${row.name || "section"} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <Icon name="chevron" />
              </button>
              <button
                type="button"
                aria-label={`Move ${row.name || "section"} down`}
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
              >
                <Icon name="chevron" />
              </button>
            </div>
            <button
              type="button"
              className="trash-button"
              aria-label={`Delete ${row.name || "new section"}`}
              onClick={() => remove(row)}
            >
              <Icon name="trash" />
            </button>
          </div>
        ))}
      </section>
      <button type="button" className="mobile-add-section" onClick={add}>
        <Icon name="plus" /> Add section
      </button>
      {blocked && (
        <div className="blocked-message" role="alert">
          <Icon name="warning" />
          <span>
            <b>Can&apos;t delete {blocked.name}.</b> Move or delete its {blocked.count} items first.
          </span>
          <button type="button" onClick={() => setBlocked(null)} aria-label="Dismiss">
            <Icon name="close" />
          </button>
        </div>
      )}
      <div className="bottom-actions sections-save">
        <span>{busy ? "Publishing…" : dirty ? "Unsaved changes" : "No changes"}</span>
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
