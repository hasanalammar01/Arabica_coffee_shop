"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6" role="alert">
      <h1 className="font-display text-title">This page didn&apos;t load.</h1>
      <p className="mt-4 text-lg text-muted">Check your connection, then try again.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-12 rounded-full bg-zaatar px-6 font-medium text-on-zaatar"
        >
          Try again
        </button>
        <Link
          href="/menu"
          className="inline-flex min-h-12 items-center rounded-full border border-line px-6 font-medium"
        >
          Go to the menu
        </Link>
      </div>
    </div>
  );
}
