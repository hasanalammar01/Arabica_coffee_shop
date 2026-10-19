import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { PhotoError, prepareMenuPhoto } from "./blob.ts";

test("uploaded WebP photos are decoded and limited to menu image dimensions", async () => {
  const input = await sharp({ create: { width: 1200, height: 600, channels: 3, background: "#4a3426" } }).webp().toBuffer();
  const output = await prepareMenuPhoto(input);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 800);
  assert.equal(metadata.height, 400);
});

test("valid WebP headers do not allow corrupt image bodies to be published", async () => {
  const input = await sharp({ create: { width: 32, height: 32, channels: 3, background: "red" } }).webp().toBuffer();
  const corrupt = Buffer.from(input);
  corrupt.fill(255, 30);
  assert.equal((await sharp(corrupt).metadata()).format, "webp");
  await assert.rejects(prepareMenuPhoto(corrupt), (error: unknown) => error instanceof PhotoError && error.status === 400);
});

test("other image formats and oversized uploads are rejected", async () => {
  const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(prepareMenuPhoto(png), /valid WebP/);
  await assert.rejects(prepareMenuPhoto(Buffer.alloc(2_000_001)), /too large/);
});
