import { SiteLayout } from "@/components/SiteLayout";
import { isLang } from "@/lib/i18n";

export default async function Layout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  return <SiteLayout lang={isLang(lang) ? lang : "en"}>{children}</SiteLayout>;
}
