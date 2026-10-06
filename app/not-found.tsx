import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <p className="text-sm font-medium tracking-widest text-saffron-text uppercase">404</p>
      <h1 className="mt-3 max-w-[16ch] font-display text-hero">This page isn&apos;t on the menu.</h1>
      <p className="mt-5 text-lg text-muted">The link may be old, or the address mistyped.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/menu"
          className="inline-flex min-h-12 items-center rounded-full bg-zaatar px-6 font-medium text-on-zaatar"
        >
          Go to the menu
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-12 items-center rounded-full border border-line px-6 font-medium"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
