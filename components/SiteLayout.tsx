import { Footer } from "./Footer";
import { Header } from "./Header";

/** Header and footer for the public pages (the admin has its own shell). */
export function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
