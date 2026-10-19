import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { AdminLanguageProvider } from "@/components/admin/Language";
import { ADMIN_LANGUAGE_COOKIE } from "@/lib/admin/language";
import { fontVars } from "../fonts";
import "../globals.css";
import "./admin.css";

export const metadata: Metadata = {
  title: "Arabica admin",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f6f0e7" };

/** The admin has its own language preference and root layout. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const lang = (await cookies()).get(ADMIN_LANGUAGE_COOKIE)?.value === "ar" ? "ar" : "en";
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className={`admin-root ${fontVars}`}>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <AdminLanguageProvider initialLang={lang}>
          <div className="admin flex-1">{children}</div>
        </AdminLanguageProvider>
      </body>
    </html>
  );
}
