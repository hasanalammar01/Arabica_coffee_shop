"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

type DisclosureGroup = {
  openId: string | null;
  toggle: (id: string) => void;
  close: (id: string) => void;
  seen: RefObject<Set<string>>;
};

const Group = createContext<DisclosureGroup | null>(null);

/** Share the open item and first-view history across cards, rows and search results. */
export function ItemInfoGroup({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const toggle = useCallback((id: string) => setOpenId((current) => (current === id ? null : id)), []);
  const close = useCallback((id: string) => setOpenId((current) => (current === id ? null : current)), []);
  const value = useMemo(() => ({ openId, toggle, close, seen }), [openId, toggle, close, seen]);

  return <Group value={value}>{children}</Group>;
}

export function ItemDisclosure({
  itemId,
  label,
  details,
  className,
  children,
}: {
  itemId: string;
  label: string;
  details: ReactNode;
  className: string;
  children: ReactNode;
}) {
  const group = useContext(Group);
  const [localOpen, setLocalOpen] = useState(false);
  const localSeen = useRef(new Set<string>());
  const seen = group?.seen ?? localSeen;
  const close = group?.close;
  const expanded = group ? group.openId === itemId : localOpen;
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => () => close?.(itemId), [close, itemId]);

  useEffect(() => {
    const element = root.current;
    if (!element || seen.current.has(itemId) || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
        seen.current.add(itemId);
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          element.dataset.attention = "true";
        }
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    // A tall photo can enter before its hint does; pulse when customers can see the hint.
    observer.observe(element.querySelector(".item-info-hint") ?? element);
    return () => observer.disconnect();
  }, [itemId, seen]);

  return (
    <div ref={root} className="item-info" data-expanded={expanded}>
      <div className={`item-info-trigger relative rounded-xl ${className}`}>
        {children}
        {/* A separate, full-size button preserves the headings and lists inside the card. */}
        <button
          id={`${id}-trigger`}
          type="button"
          className="item-info-button absolute inset-0 z-10 w-full cursor-pointer rounded-xl"
          aria-label={label}
          aria-expanded={expanded}
          aria-controls={`${id}-panel`}
          onClick={() => (group ? group.toggle(itemId) : setLocalOpen((current) => !current))}
        />
      </div>
      {/* Keep both states mounted so CSS can reverse smoothly during repeated taps. */}
      <div id={`${id}-panel`} className="item-info-reveal" aria-hidden={!expanded} inert={!expanded}>
        <div className="min-h-0 overflow-hidden">
          <div className="my-2 space-y-3 rounded-xl border border-line bg-surface/70 px-4 py-3 text-sm leading-relaxed text-muted">
            {details}
          </div>
        </div>
      </div>
    </div>
  );
}
