import Link from "next/link";
import { site } from "@/data/site";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-24 print:hidden">
      <div className="tile h-3" aria-hidden />
      <div className="bg-zaatar text-on-zaatar">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <Logo className="w-40 text-saffron" />
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-1 text-on-zaatar-muted">
              <li>
                <Link
                  className="inline-flex min-h-11 min-w-11 items-center hover:text-on-zaatar"
                  href="/menu"
                >
                  Menu
                </Link>
              </li>
              <li>
                <Link
                  className="inline-flex min-h-11 min-w-11 items-center hover:text-on-zaatar"
                  href="/about"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  className="inline-flex min-h-11 min-w-11 items-center hover:text-on-zaatar"
                  href="/contact"
                >
                  Hours & location
                </Link>
              </li>
              {site.instagram && (
                <li>
                  <a
                    className="inline-flex min-h-11 min-w-11 items-center hover:text-on-zaatar"
                    href={site.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Instagram
                  </a>
                </li>
              )}
            </ul>
          </nav>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-8 text-sm text-on-zaatar-muted sm:px-6">
          © {new Date().getFullYear()} {site.name}
        </p>
      </div>
    </footer>
  );
}
