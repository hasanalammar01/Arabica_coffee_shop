import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Menu admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin flex-1">{children}</div>;
}
