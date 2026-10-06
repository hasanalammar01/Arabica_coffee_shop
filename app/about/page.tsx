import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import brownies from "@/public/menu/brownies.webp";
import cappuccino from "@/public/menu/cappuccino.webp";

export const metadata: Metadata = {
  title: "About",
  description: "Arabica is a deli-café serving coffee, shakes, smoothies, saj, desserts and shisha.",
  alternates: { canonical: "/about" },
};

// TODO: replace the copy below with the owner's own story (who, since when, where the coffee comes from).
export default function About() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-14">
      <h1 className="max-w-[16ch] font-display text-hero">Coffee, saj and a table to stay at.</h1>

      <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-16">
        <div className="space-y-5 text-lg text-muted">
          <p>
            Arabica is a deli-café. The coffee bar runs from a 90,000 L.L espresso to a caramel macchiato,
            with iced lattes, freddos and frappés when it&apos;s warm out.
          </p>
          <p>
            The blender handles shakes and smoothies, from mango passion to cotton candy. Five tea blends make
            up the special tea, from Spanish white peach and ginger to Oregon spearmint.
          </p>
          <p>
            On the saj: zaatar, cheese, labneh with makdous, bandoura and basal, turkey and cheese, or Nutella
            with banana. Brownies, cheesecake and custard after, and shisha for anyone staying the evening.
          </p>
          <Link
            href="/menu"
            className="inline-flex min-h-12 items-center rounded-full bg-zaatar px-6 font-medium text-on-zaatar hover:bg-ink"
          >
            See the full menu
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 self-start">
          {[
            { src: cappuccino, alt: "A cappuccino dusted with cocoa" },
            { src: brownies, alt: "Two squares of chocolate brownie" },
          ].map((p, i) => (
            <div
              key={p.alt}
              className={`tile flex aspect-[3/4] items-end rounded-card p-5 shadow-lift ${i ? "mt-12" : ""}`}
            >
              <Image
                src={p.src}
                alt={p.alt}
                sizes="(min-width: 768px) 25vw, 45vw"
                className="h-auto w-full drop-shadow-[0_14px_14px_rgb(0_0_0/0.35)]"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
