/**
 * The address if it's a real http(s) web link, otherwise "". Links shown on the site from shop
 * data go through this, so a "javascript:" or "data:" value can never become a clickable link
 * (the data is edited in the admin, so it isn't fully trusted at render).
 */
export function safeHttpUrl(value: string | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}
