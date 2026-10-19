import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { uploadMenuPhoto, deleteMenuPhotos, prepareMenuPhoto, PhotoError } from "../blob.ts";
import { readContent, saveContent } from "../content-store.ts";
import {
  ContentError,
  CONFLICT,
  imageReferences,
  replaceImageReferences,
  parseContent,
  requireVersions,
  type ContentPath,
} from "../content-core.ts";

/** Only content documents and freshly uploaded menu photos may be published. */
export const ALLOWED = /^(data\/(menu|site)\.json|public\/menu\/[a-z0-9-]+\.webp)$/;
export { CONFLICT };
export class StoreError extends ContentError {}

export type Mode = "database" | "local";
export const mode = (): Mode | null =>
  process.env.DATABASE_URL ? "database" : process.env.NODE_ENV === "development" ? "local" : null;

export async function readText(path: string): Promise<{ text: string; sha: string }> {
  if (path !== "data/menu.json" && path !== "data/site.json")
    throw new StoreError(400, "That file can't be read here.");
  const content = await readContent(path);
  parseContent(path, content.text);
  return content;
}

/** Preserve the editor's file contract while storing documents in Neon and new photos in Blob. */
export async function publish(
  files: { path: string; content: string }[],
  _message: string,
  base: Record<string, string>,
): Promise<{ versions: Record<string, string>; images: Record<string, string> }> {
  if (new Set(files.map((f) => f.path)).size !== files.length || files.some((f) => !ALLOWED.test(f.path)))
    throw new StoreError(400, "That change can't be published.");
  const docs = files
    .filter(
      (f): f is { path: ContentPath; content: string } =>
        f.path === "data/menu.json" || f.path === "data/site.json",
    )
    .map((f) => ({ path: f.path, content: Buffer.from(f.content, "base64").toString("utf8") }));
  if (!docs.length) throw new StoreError(400, "There is no menu or shop information to publish.");
  const references = new Set<string>();
  for (const f of docs)
    for (const image of imageReferences(f.path, parseContent(f.path, f.content))) references.add(image);
  const photos = files.filter((f) => f.path.endsWith(".webp"));
  for (const photo of photos)
    if (!references.has(photo.path.slice("public".length)))
      throw new StoreError(400, "An uploaded photo isn't used by this menu change.");
  // Check before uploading, then check again inside the atomic database update.
  const current = Object.fromEntries(
    await Promise.all(docs.map(async (f) => [f.path, (await readText(f.path)).sha])),
  );
  requireVersions(
    docs.map((f) => f.path),
    base,
    current,
  );
  if (mode() === "local") {
    const checked = await Promise.all(
      files.map(async (f) => {
        const bytes = Buffer.from(f.content, "base64");
        try {
          return { path: f.path, bytes: f.path.endsWith(".webp") ? await prepareMenuPhoto(bytes) : bytes };
        } catch (e) {
          if (e instanceof PhotoError) throw new StoreError(e.status, e.message);
          throw e;
        }
      }),
    );
    for (const f of checked) await writeFile(join(/*turbopackIgnore: true*/ process.cwd(), f.path), f.bytes);
    const versions = Object.fromEntries(
      await Promise.all(docs.map(async (f) => [f.path, (await readText(f.path)).sha])),
    );
    return { versions, images: {} };
  }
  const images: Record<string, string> = {};
  let saving = false;
  try {
    for (const photo of photos) {
      let url: string;
      try {
        ({ url } = await uploadMenuPhoto(photo.path, Buffer.from(photo.content, "base64")));
      } catch (e) {
        if (e instanceof PhotoError) throw new StoreError(e.status, e.message);
        throw new StoreError(
          503,
          "The photo couldn't be saved. Check the photo and the Vercel Blob connection, then try again.",
        );
      }
      images[photo.path.slice("public".length)] = url;
    }
    const updated = docs.map((f) => ({
      path: f.path,
      content: JSON.stringify(replaceImageReferences(f.path, parseContent(f.path, f.content), images)),
    }));
    // Validate replaced Blob URLs before submitting a write to the database.
    for (const f of updated) parseContent(f.path, f.content);
    saving = true;
    return { versions: await saveContent(updated, base), images };
  } catch (e) {
    // A network error during a database write can mean it committed; keep those images.
    if (!saving || (e instanceof ContentError && (e.status === 400 || e.status === 409)))
      await deleteMenuPhotos(Object.values(images)).catch(() => undefined);
    throw e;
  }
}
