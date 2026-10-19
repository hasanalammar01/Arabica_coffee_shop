import type { Metadata } from "next";
import { Checkout } from "@/components/order/Checkout";
import { alternates, isLang, t, type Lang } from "@/lib/i18n";
import { getMenu, publicMenu } from "@/lib/menu";

export async function generateMetadata({ params }: PageProps<"/[lang]/order">): Promise<Metadata> {
  const { lang: l } = await params;
  const lang: Lang = isLang(l) ? l : "en";
  const d = t(lang).order;
  return {
    title: d.title,
    description: d.description,
    alternates: alternates(lang, "/order"),
    robots: { index: false },
  };
}

export default async function OrderPage({ params }: PageProps<"/[lang]/order">) {
  const { lang: l } = await params;
  const lang: Lang = isLang(l) ? l : "en";
  return <Checkout menu={publicMenu(await getMenu())} lang={lang} />;
}
