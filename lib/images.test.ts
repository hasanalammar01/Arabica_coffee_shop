import assert from "node:assert/strict";
import { test } from "node:test";
import { isBlobImage, isSiteImage } from "./images.ts";

test("menu photos accept existing assets and public Blob URLs", () => {
  assert.equal(isSiteImage("/menu/iced-latte.webp"), true);
  assert.equal(isSiteImage("/photos/cafe.jpg"), true);
  assert.equal(isSiteImage("https://store-123.public.blob.vercel-storage.com/menu/latte-Ab12.webp"), true);
  assert.equal(isBlobImage("/menu/iced-latte.webp"), false);
});

test("remote photo URLs reject arbitrary origins, executable content and credentials", () => {
  for (const src of [
    "https://example.com/menu/latte.webp",
    "https://store.public.blob.vercel-storage.com.evil.test/menu/latte.webp",
    "https://store.private.blob.vercel-storage.com/menu/latte.webp",
    "http://store.public.blob.vercel-storage.com/menu/latte.webp",
    "https://user:password@store.public.blob.vercel-storage.com/menu/latte.webp",
    "https://store.public.blob.vercel-storage.com/menu/latte.svg",
    "https://store.public.blob.vercel-storage.com/menu/latte.webp?download=1",
    "https://store.public.blob.vercel-storage.com/menu/latte.webp#photo",
    "https://store.public.blob.vercel-storage.com/files/latte.webp",
    "//store.public.blob.vercel-storage.com/menu/latte.webp",
    "/menu/../secret.webp",
    "data:image/svg+xml,<svg/>",
  ]) assert.equal(isSiteImage(src), false, src);
});
