/**
 * Server-side check of a file the admin publishes (base64 content), whatever the browser did:
 * photos must really be WebP images and data files valid JSON objects. Returns a message for
 * staff, or null when the file is acceptable.
 */
export function publishProblem(path: string, base64: string): string | null {
  const bytes = Buffer.from(base64, "base64");
  if (path.endsWith(".webp")) {
    // RIFF....WEBP: the container signature every WebP file starts with.
    const ok = bytes.length > 12 && bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP";
    return ok ? null : "That photo isn't a valid image. Choose the photo again.";
  }
  if (path.endsWith(".json")) {
    try {
      const value = JSON.parse(bytes.toString("utf8"));
      if (value && typeof value === "object" && !Array.isArray(value)) return null;
    } catch {
      // falls through
    }
    return "The menu data couldn't be read. Reload the admin and try again.";
  }
  return "That file can't be published.";
}
