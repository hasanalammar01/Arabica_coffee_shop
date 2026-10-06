import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Price } from "@/components/Price";
import { Visit } from "@/components/Visit";
import type { MenuItem } from "@/data/menu";
import { getMenu } from "@/lib/menu";
import caramelFrappe from "@/public/menu/caramel-frappe.webp";
import espresso from "@/public/menu/espresso.webp";
import mixBerries from "@/public/menu/smoothie-mix-berries.webp";
import icedLatte from "@/public/menu/iced-latte.webp";
import strawberry from "@/public/menu/shake-strawberry.webp";

const SHELF: { src: StaticImageData; alt: string }[] = [
  { src: espresso, alt: "Espresso" },
  { src: icedLatte, alt: "Iced latte" },
  { src: strawberry, alt: "Strawberry shake" },
  { src: caramelFrappe, alt: "Caramel frappé" },
  { src: mixBerries, alt: "Mix berries smoothie" },
];

const lowest = (items: MenuItem[]) => Math.min(...items.flatMap((i) => i.prices.map(([, p]) => p)));

export default function Home() {
  const menu = getMenu();

  return (
    <>
      <section className="tile text-on-espresso">
        <div className="mx-auto grid max-w-6xl gap-x-12 px-4 pt-12 sm:px-6 lg:grid-cols-2 lg:pt-20">
          <Logo className="w-48 animate-rise text-crema sm:w-60 lg:col-start-2 lg:row-start-1 lg:w-full lg:max-w-md lg:self-center lg:justify-self-end" />
          <div className="mt-8 lg:col-start-1 lg:row-start-1 lg:mt-0">
            <h1 className="max-w-[14ch] animate-rise font-display text-hero [animation-delay:80ms]">
              Coffee at the counter, saj off the griddle.
            </h1>
            <p className="mt-5 max-w-md animate-rise text-lg text-on-espresso-muted [animation-delay:160ms]">
              Espresso and iced lattes, shakes and smoothies, saj, desserts and shisha.
            </p>
            <div className="mt-8 flex animate-rise flex-wrap gap-3 [animation-delay:240ms]">
              <Link
                href="/menu"
                className="inline-flex min-h-12 items-center rounded-full bg-crema px-6 font-medium text-ink transition-colors hover:bg-on-espresso"
              >
                View the menu
              </Link>
              <Link
                href="/contact"
                className="inline-flex min-h-12 items-center rounded-full border border-on-espresso/40 px-6 font-medium transition-colors hover:border-on-espresso"
              >
                Find us
              </Link>
            </div>
          </div>

          {/* The shelf: drinks standing on a beige rail. */}
          <div className="mt-12 lg:col-span-2 lg:mt-16" aria-hidden>
            <div className="flex items-end justify-center gap-1 sm:gap-4 lg:justify-between lg:px-8">
              {SHELF.map((d, i) => (
                <Image
                  key={d.alt}
                  src={d.src}
                  alt=""
                  priority
                  sizes="(min-width: 1024px) 168px, 19vw"
                  style={{ animationDelay: `${300 + i * 90}ms` }}
                  className="h-auto w-[19%] max-w-32 animate-rise drop-shadow-[0_18px_16px_rgb(0_0_0/0.45)] lg:max-w-42"
                />
              ))}
            </div>
            <div className="h-1.5 rounded-full bg-crema" />
            <div className="h-10 lg:h-14" />
          </div>
        </div>
      </section>

      <section aria-labelledby="on-the-menu" className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
        <h2 id="on-the-menu" className="font-display text-title">
          On the menu
        </h2>
        <ul className="mt-8 border-t-2 border-ink">
          {menu.map((c) => (
            <li key={c.id} className="border-b border-line">
              <Link
                href={`/menu#${c.id}`}
                className="group flex min-h-16 items-center gap-4 py-4 transition-colors hover:text-caramel"
              >
                <span className="font-display text-2xl sm:text-3xl">{c.name}</span>
                <span className="hidden text-sm text-muted sm:inline">{c.items.length} items</span>
                <span className="ml-auto text-right text-sm text-muted">
                  from <Price prices={[["", lowest(c.items)]]} className="text-ink" />
                </span>
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* TODO: replace with the owner's own story once provided. */}
      <section className="mx-auto grid max-w-6xl gap-6 px-4 pt-24 sm:px-6 md:grid-cols-[1fr_1.4fr] md:gap-16">
        <h2 className="font-display text-title">A deli-café, all day long</h2>
        <div className="space-y-4 text-lg text-muted">
          <p>
            Arabica pours espresso, cappuccino and caramel macchiato, and on warm days iced lattes, frappés
            and homemade iced tea.
          </p>
          <p>
            From the saj come zaatar, labneh and makdous, turkey and cheese, or Nutella and banana. Stay for a
            brownie, a cheesecake, or a shisha.
          </p>
          <Link
            href="/about"
            className="inline-flex min-h-11 items-center font-medium text-caramel underline-offset-4 hover:underline"
          >
            More about us
          </Link>
        </div>
      </section>

      <section aria-label="Hours and location" className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <Visit />
      </section>
    </>
  );
}
