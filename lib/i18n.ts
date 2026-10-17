/**
 * Interface text in English and Arabic. Arabic must have every key English has
 * (TypeScript checks it). Shop content (menu, story, address) is translated in the
 * admin, not here.
 */
import type { Allergen, Tag } from "../data/menu.ts";

export const LANGS = ["en", "ar"] as const;
export type Lang = (typeof LANGS)[number];
export const isLang = (v: string): v is Lang => (LANGS as readonly string[]).includes(v);
export const dir = (lang: Lang) => (lang === "ar" ? "rtl" : "ltr");

/** English URLs have no prefix (/menu); Arabic ones do (/ar/menu). */
export const href = (lang: Lang, path: string) =>
  lang === "en" ? path : path === "/" ? "/ar" : `/ar${path}`;

/** Canonical URL plus the other language's version, for page metadata. */
export const alternates = (lang: Lang, path: string) => ({
  canonical: href(lang, path),
  languages: { en: path, ar: href("ar", path), "x-default": path },
});

/** The Arabic field when the page is Arabic and it's filled in, otherwise English. */
export const pick = (lang: Lang, en: string, ar?: string | null) => (lang === "ar" && ar?.trim() ? ar : en);

const en = {
  langName: "English",
  otherLang: "العربية",
  skip: "Skip to content",
  nav: { home: "Home", menu: "Menu", about: "About", visit: "Visit", main: "Main", footer: "Footer" },
  footer: { hoursLocation: "Hours & location", instagram: "Instagram" },
  home: {
    headline: "Coffee at the counter, saj off the griddle.",
    sub: "Espresso and iced lattes, shakes and smoothies, saj, desserts and shisha.",
    viewMenu: "View the menu",
    findUs: "Find us",
    onTheMenu: "On the menu",
    items: (n: number) => `${n} ${n === 1 ? "item" : "items"}`,
    from: "from",
    signature: "Signature picks",
    moreAbout: "More about us",
    gallery: "Inside Arabica",
    hoursAndLocation: "Hours and location",
  },
  about: { title: "Our story", seeMenu: "See the full menu", photos: "Photos" },
  visit: {
    title: "Hours & location",
    description: "Opening hours, directions and contact details.",
    hours: "Hours",
    findUs: "Find us",
    openNow: "Open now",
    closedNow: "Closed now",
    hoursSoon: "Opening hours will be added soon.",
    contactSoon: "The address and phone number will be added soon. Until then, visit us at the café.",
    call: "Call us",
    whatsapp: "WhatsApp",
    directions: "Get directions",
    email: "Email",
    instagram: "Instagram",
    map: "Map showing Arabica",
    closedToday: "Closed today",
    specialToday: "Special hours today",
    upcoming: "Upcoming changes",
    closed: "Closed",
  },
  menu: {
    title: "Menu",
    description: "Hot and cold drinks, shakes, smoothies, saj, desserts and shisha, with prices.",
    prices: "Prices in Lebanese pounds (L.L).",
    print: "Print or save as PDF",
    search: "Search the menu",
    searchPlaceholder: "Search: latte, mango, labneh…",
    filterBy: "Filter by",
    categories: "Menu categories",
    nothing: (q: string) => `Nothing matches “${q}”.`,
    showAll: "Show the full menu",
    soldOut: "Sold out",
    details: "Details",
    ingredients: "Ingredients",
    allergens: "Contains",
    tags: "Tags",
    printedOn: (d: string) => `Prices as of ${d}`,
    printTitle: "Arabica menu",
    printHint: "Use your browser's Print dialog and choose “Save as PDF” to download.",
    printNow: "Print / Save as PDF",
    back: "Back to the menu",
  },
  tags: {
    vegetarian: "Vegetarian",
    vegan: "Vegan",
    "gluten-free": "Gluten-free",
    "dairy-free": "Dairy-free",
    spicy: "Spicy",
    new: "New",
    bestseller: "Bestseller",
  } satisfies Record<Tag, string>,
  allergens: {
    gluten: "Gluten",
    dairy: "Dairy",
    eggs: "Eggs",
    nuts: "Tree nuts",
    peanuts: "Peanuts",
    soy: "Soy",
    sesame: "Sesame",
    fish: "Fish",
    shellfish: "Shellfish",
    mustard: "Mustard",
    celery: "Celery",
    sulphites: "Sulphites",
  } satisfies Record<Allergen, string>,
  notFound: {
    title: "This page isn't on the menu.",
    body: "The link may be old, or the address mistyped.",
    toMenu: "Go to the menu",
    home: "Home",
  },
  error: {
    title: "This page didn't load.",
    body: "Check your connection, then try again.",
    retry: "Try again",
  },
  loading: "Loading",
};

export type Dict = typeof en;

const ar: Dict = {
  langName: "العربية",
  otherLang: "English",
  skip: "تخطَّ إلى المحتوى",
  nav: {
    home: "الرئيسية",
    menu: "القائمة",
    about: "من نحن",
    visit: "زورونا",
    main: "الرئيسية",
    footer: "التذييل",
  },
  footer: { hoursLocation: "الدوام والموقع", instagram: "إنستغرام" },
  home: {
    headline: "قهوة على الكاونتر، وصاج طازج.",
    sub: "إسبريسو وآيس لاتيه، ميلك شيك وسموذي، صاج، حلويات وأراكيل.",
    viewMenu: "تصفّح القائمة",
    findUs: "موقعنا",
    onTheMenu: "على القائمة",
    items: (n: number) => (n === 1 ? "صنف واحد" : n === 2 ? "صنفان" : n <= 10 ? `${n} أصناف` : `${n} صنفًا`),
    from: "ابتداءً من",
    signature: "أصنافنا المميّزة",
    moreAbout: "المزيد عنّا",
    gallery: "داخل أرابيكا",
    hoursAndLocation: "الدوام والموقع",
  },
  about: { title: "قصّتنا", seeMenu: "القائمة الكاملة", photos: "صور" },
  visit: {
    title: "الدوام والموقع",
    description: "ساعات العمل والاتجاهات ووسائل التواصل.",
    hours: "الدوام",
    findUs: "موقعنا",
    openNow: "مفتوح الآن",
    closedNow: "مغلق الآن",
    hoursSoon: "ستُضاف ساعات الدوام قريبًا.",
    contactSoon: "سيُضاف العنوان ورقم الهاتف قريبًا. حتى ذلك الحين، يسعدنا استقبالكم في المقهى.",
    call: "اتصل بنا",
    whatsapp: "واتساب",
    directions: "الاتجاهات",
    email: "البريد الإلكتروني",
    instagram: "إنستغرام",
    map: "خريطة موقع أرابيكا",
    closedToday: "مغلق اليوم",
    specialToday: "دوام خاص اليوم",
    upcoming: "تغييرات قادمة",
    closed: "مغلق",
  },
  menu: {
    title: "القائمة",
    description: "مشروبات ساخنة وباردة، ميلك شيك، سموذي، صاج، حلويات وأراكيل، مع الأسعار.",
    prices: "الأسعار بالليرة اللبنانية (ل.ل).",
    print: "اطبع أو احفظ PDF",
    search: "ابحث في القائمة",
    searchPlaceholder: "ابحث: لاتيه، مانغو، لبنة…",
    filterBy: "تصفية حسب",
    categories: "أقسام القائمة",
    nothing: (q: string) => `لا نتائج لـ «${q}».`,
    showAll: "اعرض القائمة كاملة",
    soldOut: "نفد",
    details: "التفاصيل",
    ingredients: "المكوّنات",
    allergens: "يحتوي على",
    tags: "تصنيفات",
    printedOn: (d: string) => `الأسعار بتاريخ ${d}`,
    printTitle: "قائمة أرابيكا",
    printHint: "استخدم نافذة الطباعة في المتصفّح واختر «حفظ بصيغة PDF» للتنزيل.",
    printNow: "اطبع / احفظ PDF",
    back: "العودة إلى القائمة",
  },
  tags: {
    vegetarian: "نباتي",
    vegan: "نباتي صرف",
    "gluten-free": "خالٍ من الغلوتين",
    "dairy-free": "خالٍ من الألبان",
    spicy: "حار",
    new: "جديد",
    bestseller: "الأكثر طلبًا",
  },
  allergens: {
    gluten: "غلوتين",
    dairy: "ألبان",
    eggs: "بيض",
    nuts: "مكسّرات",
    peanuts: "فول سوداني",
    soy: "صويا",
    sesame: "سمسم",
    fish: "سمك",
    shellfish: "قشريات",
    mustard: "خردل",
    celery: "كرفس",
    sulphites: "كبريتيت",
  },
  notFound: {
    title: "هذه الصفحة ليست على القائمة.",
    body: "قد يكون الرابط قديمًا أو العنوان غير صحيح.",
    toMenu: "إلى القائمة",
    home: "الرئيسية",
  },
  error: { title: "تعذّر تحميل الصفحة.", body: "تحقّق من الاتصال ثم حاول مجددًا.", retry: "حاول مجددًا" },
  loading: "جارٍ التحميل",
};

export const dictionaries: Record<Lang, Dict> = { en, ar };
export const t = (lang: Lang) => dictionaries[lang];
