import { del, put } from "@vercel/blob";
import sharp from "sharp";
import { isBlobImage } from "./images.ts";

export class PhotoError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Decode the entire upload: a valid header alone does not prove the image is usable. */
export async function prepareMenuPhoto(bytes: Buffer): Promise<Buffer> {
  if (bytes.length > 2_000_000) throw new PhotoError(400, "That photo is too large. Choose a smaller photo.");
  try {
    const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (metadata.format !== "webp" || !metadata.width || !metadata.height) throw new Error("Invalid WebP");
    return await image.rotate()
      .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer();
  } catch {
    throw new PhotoError(400, "That photo isn't a valid WebP image. Choose the photo again.");
  }
}

/** Server-side only: the SDK uses the connected store's OIDC credentials on Vercel. */
export async function uploadMenuPhoto(path: string, bytes: Buffer): Promise<{ url: string }> {
  if (!/^public\/menu\/[a-z0-9-]+\.webp$/.test(path)) throw new PhotoError(400, "That photo can't be uploaded.");
  const image = await prepareMenuPhoto(bytes);
  try {
    const blob = await put(path.slice("public/".length), image, {
      access: "public",
      addRandomSuffix: true,
      contentType: "image/webp",
    });
    if (!isBlobImage(blob.url)) throw new Error("Unsupported image URL");
    return { url: blob.url };
  } catch {
    throw new PhotoError(503, "Photo storage is unavailable. Check the Blob connection and redeploy if it was just connected.");
  }
}

/** Only unused uploads from this publish may be removed; never delete existing menu photos. */
export async function deleteMenuPhotos(urls: string[]): Promise<void> {
  if (urls.length && urls.every(isBlobImage)) await del(urls);
}
