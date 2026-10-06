/**
 * The Arabica logotype, extracted from the original menu PDF (public/logo*.svg).
 * Drawn as a CSS mask so it takes the current text colour and stays a cached file.
 */
const VARIANTS = {
  full: { src: "/logo.svg", ratio: "880 / 590", label: "Arabica deli-café" },
  mark: { src: "/logo-mark.svg", ratio: "800 / 420", label: "Arabica" },
};

export function Logo({
  variant = "full",
  className = "",
}: {
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  const v = VARIANTS[variant];
  return (
    <span
      role="img"
      aria-label={v.label}
      className={`inline-block bg-current ${className}`}
      style={{
        aspectRatio: v.ratio,
        mask: `url(${v.src}) center / contain no-repeat`,
        WebkitMask: `url(${v.src}) center / contain no-repeat`,
      }}
    />
  );
}
