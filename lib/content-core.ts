import type { MenuCategoryData } from "../data/menu.ts";
import { withDefaults, type SiteData } from "../data/site.ts";
import { buildMenu } from "./menu-core.ts";
import { isSiteImage } from "./images.ts";

export type ContentPath = "data/menu.json" | "data/site.json";
export type MenuDocument = { categories: MenuCategoryData[] };

export const CONFLICT =
  "Someone else published changes since you opened the admin. Reload the page to get the latest version, then make your change again.";

/** A safe error to show in the admin; database/network errors stay on the server. */
export class ContentError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const object = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);
const time = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const date = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(`${v}T12:00:00Z`)) &&
  new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;

function invalid(message: string): never {
  throw new ContentError(400, message);
}

/** Validate all fields used at runtime, before accepting a new shop document. */
export function validateSite(value: unknown): SiteData {
  if (!object(value)) return invalid("Shop information must be a JSON object.");
  const strings = [
    "name",
    "nameAr",
    "url",
    "timeZone",
    "description",
    "descriptionAr",
    "address",
    "addressAr",
    "mapsQuery",
    "phone",
    "whatsapp",
    "email",
    "instagram",
  ] as const;
  for (const key of strings)
    if (value[key] !== undefined && typeof value[key] !== "string")
      invalid(`Shop information: ${key} must be text.`);
  const next = withDefaults(value as Partial<SiteData>);
  if (!next.name.trim()) invalid("Shop information needs a name.");
  try {
    const url = new URL(next.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
  } catch {
    invalid("Shop information needs a valid website URL.");
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: next.timeZone }).format();
  } catch {
    invalid("Shop information needs a valid time zone.");
  }
  if (!Array.isArray(next.hours)) invalid("Opening hours must be a list.");
  for (const h of next.hours) {
    if (
      !object(h) ||
      !Array.isArray(h.days) ||
      !h.days.length ||
      !h.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) ||
      new Set(h.days).size !== h.days.length ||
      !time(h.open) ||
      !time(h.close)
    )
      invalid("Opening hours need valid days and times (HH:MM).");
  }
  if (!Array.isArray(next.specialHours)) invalid("Special hours must be a list.");
  for (const h of next.specialHours) {
    if (
      !object(h) ||
      !date(h.from) ||
      (h.to !== undefined && (!date(h.to) || h.to < h.from)) ||
      typeof h.closed !== "boolean" ||
      (!h.closed && (!time(h.open) || !time(h.close))) ||
      (h.note !== undefined && typeof h.note !== "string") ||
      (h.noteAr !== undefined && typeof h.noteAr !== "string")
    )
      invalid("Special hours need valid dates and opening times.");
  }
  if (value.story !== undefined && !object(value.story)) invalid("The shop story must be an object.");
  for (const key of ["title", "titleAr", "body", "bodyAr"] as const)
    if (typeof next.story[key] !== "string") invalid("The shop story must contain text.");
  if (!Array.isArray(next.gallery)) invalid("Shop photos must be a list.");
  for (const photo of next.gallery) {
    if (
      !object(photo) ||
      typeof photo.src !== "string" ||
      !isSiteImage(photo.src) ||
      typeof photo.alt !== "string" ||
      (photo.altAr !== undefined && typeof photo.altAr !== "string")
    )
      invalid("Each shop photo needs an allowed photo URL and alternative text.");
  }
  return next;
}

export function parseContent(path: ContentPath, text: string): MenuDocument | SiteData {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return invalid("The menu data couldn't be read. Reload the admin and try again.");
  }
  if (path === "data/site.json") return validateSite(value);
  if (!object(value) || !Array.isArray(value.categories)) invalid("The menu needs a list of categories.");
  try {
    buildMenu(value.categories as MenuCategoryData[]);
  } catch (e) {
    const message =
      e instanceof Error && e.message.startsWith("data/menu.json is invalid:")
        ? e.message
        : "The menu contains invalid items or sections.";
    return invalid(message);
  }
  return { categories: value.categories as MenuCategoryData[] };
}

/** Photo fields only: a string in a description must not authorize an upload. */
export function imageReferences(path: ContentPath, value: MenuDocument | SiteData): Set<string> {
  return new Set(
    path === "data/menu.json"
      ? (value as MenuDocument).categories.flatMap((c) =>
          Array.isArray(c.items)
            ? c.items.map((i) => i.image).filter((v): v is string => typeof v === "string" && Boolean(v))
            : [],
        )
      : (value as SiteData).gallery.map((p) => p.src),
  );
}

/** Replace only photo fields, preserving text that happens to equal a photo path. */
export function replaceImageReferences(path: ContentPath, value: MenuDocument | SiteData, images: Record<string, string>) {
  const next = structuredClone(value);
  if (path === "data/menu.json") {
    for (const category of (next as MenuDocument).categories)
      if (Array.isArray(category.items))
        for (const item of category.items)
          if (typeof item.image === "string" && Object.hasOwn(images, item.image)) item.image = images[item.image];
  } else {
    for (const photo of (next as SiteData).gallery)
      if (Object.hasOwn(images, photo.src)) photo.src = images[photo.src];
  }
  return next;
}

/** Missing versions are also conflicts: a blind overwrite would lose someone else's work. */
export function requireVersions(
  paths: ContentPath[],
  base: Record<string, string>,
  current: Record<string, string>,
) {
  for (const path of paths)
    if (!base[path] || base[path] !== current[path]) throw new ContentError(409, CONFLICT);
}
