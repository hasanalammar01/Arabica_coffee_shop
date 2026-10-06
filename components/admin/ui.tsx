"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import type { Tag } from "@/data/menu";
import type { DraftItem } from "@/lib/admin/draft";

export const TAG_LABELS: Record<Tag, string> = {
  vegan: "Vegan",
  "gluten-free": "Gluten-free",
  spicy: "Spicy",
  new: "New",
  bestseller: "Bestseller",
};

export type IconName =
  | "menu"
  | "sections"
  | "shop"
  | "external"
  | "search"
  | "plus"
  | "more"
  | "check"
  | "chevron"
  | "image"
  | "info"
  | "warning"
  | "eye"
  | "close"
  | "clock"
  | "trash"
  | "github";

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    menu: <path d="M4 6h16M4 12h16M4 18h11" />,
    sections: <path d="M5 5h14v4H5zM5 13h14v6H5z" />,
    shop: (
      <>
        <path d="M4 10h16M6 10v10h12V10M3 10l2-6h14l2 6" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    external: (
      <>
        <path d="M14 4h6v6M20 4l-9 9" />
        <path d="M18 13v6H5V6h6" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="m16 16 4 4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 7 5 5-5 5" />,
    image: (
      <>
        <path d="M8 20h8M9 20l1-5h4l1 5" />
        <path d="M8 5h8l-1 10H9L8 5Z" />
        <path d="M9 8h6" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
    warning: (
      <>
        <path d="m12 3 10 18H2L12 3Z" />
        <path d="M12 9v5M12 18h.01" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    trash: <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />,
    github: (
      <>
        <path d="M15 22v-4c.1-1-.4-2-1-2.5 3 0 6-1.5 6-6A4.6 4.6 0 0 0 18.8 6 4.3 4.3 0 0 0 18.7 2S17.7 1.7 15 3.5a13.4 13.4 0 0 0-7 0C5.3 1.7 4.3 2 4.3 2A4.3 4.3 0 0 0 4.2 6 4.6 4.6 0 0 0 3 9.5c0 4.5 3 6 6 6-.6.5-1 1.4-1 2.5v4" />
        <path d="M8 19c-3 .9-3-1.5-4-2" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export const Logo = () => <span className="logo-mask" aria-label="Arabica" role="img" />;
export const FullLogo = () => <span className="full-logo" role="img" aria-label="Arabica deli-café" />;

export function Button({
  children,
  variant = "primary",
  icon,
  onClick,
  className = "",
  disabled = false,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: IconName;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`button ${variant} ${className}`}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required && <b>Required</b>}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <span className="toggle-row">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`toggle ${checked ? "on" : ""}`}
      >
        <span />
      </button>
    </span>
  );
}

/** Dialog with focus trap, Escape to close and focus returned to the opener. */
export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeOnEscape = useEffectEvent(onClose);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>("button, a, input, select, textarea") ?? [],
      ).filter((el) => !el.hasAttribute("disabled"));
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeOnEscape();
      }
      if (e.key === "Tab") {
        const nodes = focusables();
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">Menu</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
}

/** The item photo on the brown tile, or a beige tile when there is none (or it fails to load). */
export function Thumbnail({ item, name }: { item: Pick<DraftItem, "image" | "preview">; name: string }) {
  const src = item.preview || item.image;
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src)
    return (
      <div className="thumbnail photo">
        {/* eslint-disable-next-line @next/next/no-img-element -- staff previews, incl. local blob: URLs */}
        <img src={src} alt={name} onError={() => setFailed(src)} />
      </div>
    );
  return (
    <div className="thumbnail" role="img" aria-label={`${name || "Item"} has no photo`}>
      <Icon name="image" size={22} />
    </div>
  );
}

export function Tags({ values, addon }: { values: Tag[]; addon?: boolean }) {
  return (
    <div className="tags">
      {addon && <span className="tag addon">Add-on</span>}
      {values.map((tag) => (
        <span className="tag" key={tag}>
          {TAG_LABELS[tag] ?? tag}
        </span>
      ))}
    </div>
  );
}

export const formatLbp = (digits: string) => Number(digits || 0).toLocaleString("en-US");

export function ItemPrice({ item }: { item: DraftItem }) {
  if (item.sizes.length)
    return <>{item.sizes.map((s) => `${s.size} ${formatLbp(s.price)} L.L`).join(" · ")}</>;
  if (!item.price) return <span className="missing">Price missing</span>;
  return (
    <>
      {formatLbp(item.price)} <small className="currency-label">L.L</small>
    </>
  );
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  return (
    <div className="toast" role="status">
      <span>
        <Icon name="check" />
      </span>
      <p>{message}</p>
      <a href="/menu" target="_blank" rel="noreferrer">
        View menu ↗
      </a>
      <button type="button" onClick={onClose} aria-label="Close notification">
        <Icon name="close" />
      </button>
    </div>
  );
}

export function ErrorBanner({
  message,
  onFix,
  onClose,
}: {
  message: string;
  onFix?: () => void;
  onClose: () => void;
}) {
  const lines = message.split("\n").filter(Boolean);
  return (
    <div className="error-banner" role="alert">
      <Icon name="warning" />
      <p>
        <b>Couldn&apos;t publish:</b> {lines[0]}
        {lines.length > 1 && (
          <ul>
            {lines.slice(1).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
      </p>
      {onFix && (
        <button type="button" onClick={onFix}>
          Fix it
        </button>
      )}
      <button type="button" className="dismiss" onClick={onClose} aria-label="Dismiss">
        <Icon name="close" />
      </button>
    </div>
  );
}
