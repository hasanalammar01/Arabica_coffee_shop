"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listActivity, type ActivityEntry } from "@/lib/admin/backend";
import { Button, ErrorBanner, PageHeader } from "./ui";

// Failed sign-ins and wrong PINs or codes stand out.
const isWarning = (a: ActivityEntry) => /^(Wrong|Sign-in with an unknown)/.test(a.action);

/** Super admin only: everything done in the admin, newest first (kept 90 days). */
export function ActivityScreen({ timeZone }: { timeZone: string }) {
  const when = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [timeZone],
  );
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [people, setPeople] = useState<string[]>([]);
  const [actor, setActor] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      listActivity(actor).then(
        (list) => {
          setEntries(list);
          setError("");
          // The filter offers everyone seen so far.
          setPeople((known) => [...new Set([...known, ...list.map((e) => e.actor)])].sort());
        },
        (e) => setError(e instanceof Error ? e.message : String(e)),
      ),
    [actor],
  );

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="page narrow-page">
      <PageHeader
        eyebrow="Admin"
        title="Activity"
        description="Everything done in the admin: sign-ins, menu and shop changes, orders, settings and staff accounts. Kept 90 days."
        actions={
          <Button variant="secondary" onClick={load}>
            Refresh
          </Button>
        }
      />
      {error && <ErrorBanner message={error} onClose={() => setError("")} />}
      <label className="field activity-filter">
        <span className="field-label">Show</span>
        <select value={actor} onChange={(e) => setActor(e.target.value)}>
          <option value="">Everyone</option>
          {people.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      {!entries && !error && <p className="muted-text">Loading…</p>}
      {entries?.length === 0 && <p className="muted-text">Nothing recorded yet.</p>}
      {entries && entries.length > 0 && (
        <ol className="activity-list panel">
          {entries.map((e) => (
            <li key={e.id} className={isWarning(e) ? "warning" : ""}>
              <time dateTime={e.at}>{when.format(new Date(e.at))}</time>
              <b>{e.actor}</b>
              <span>{e.action}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
