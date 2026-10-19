import type { Metadata, Viewport } from "next";
import { fontVars } from "../fonts";
import "../globals.css";
import "./admin.css";

export const metadata: Metadata = {
  title: "Arabica admin",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f6f0e7" };

/** The admin is its own root layout: English only, no public header or footer. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`admin-root ${fontVars}`}>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <div className="admin flex-1">{children}</div>
      </body>
    </html>
  );
}
