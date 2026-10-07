import type { ReactNode } from "react";

/**
 * Wraps a menu item. If it has a description ("what's in it"), tapping the item opens
 * a small tab underneath; tapping again closes it. Native <details>, so it works with
 * keyboard and screen readers and without JavaScript.
 */
export function ItemInfo({
  description,
  className = "",
  children,
}: {
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  if (!description) return <div className={className}>{children}</div>;
  return (
    <details className="group/info">
      <summary
        className={`block cursor-pointer list-none rounded-xl transition-colors hover:bg-surface/70 [&::-webkit-details-marker]:hidden ${className}`}
      >
        {children}
      </summary>
      <p className="relative mt-2.5 mb-2 animate-tab rounded-xl bg-surface px-4 py-3 text-sm leading-relaxed text-muted shadow-lift ring-1 ring-line before:absolute before:-top-[7px] before:left-5 before:size-3 before:rotate-45 before:border-t before:border-l before:border-line before:bg-surface">
        {description}
      </p>
    </details>
  );
}

/** Small arrow after an item's name, showing it can be opened. Turns when open. */
export function InfoArrow() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="ml-1.5 inline-block size-4 align-[-3px] text-muted transition-transform duration-200 group-open/info:rotate-180 print:hidden"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
