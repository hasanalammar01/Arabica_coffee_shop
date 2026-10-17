// Generates a printable QR code pointing at the menu, with the Arabica logo in the middle:
// public/qr-menu.svg (for print) and public/qr-menu.png (1200px).
// Usage: npm run qr   (uses site.url from data/site.ts, or pass a URL: npm run qr -- https://example.com/menu)
import { readFile, writeFile } from "node:fs/promises";
import QRCode from "qrcode";
import sharp from "sharp";
import { site } from "../data/site.ts";

const url = process.argv[2] ?? `${site.url}/menu`;
const INK = "#2b1d14";

// "H" error correction survives ~30% of the code being covered; the logo badge covers ~6%.
const qr = await QRCode.toString(url, {
  type: "svg",
  errorCorrectionLevel: "H",
  margin: 2,
  color: { dark: INK, light: "#ffffff" },
});
const size = Number(qr.match(/viewBox="0 0 (\d+) \d+"/)[1]);

// The logo mark (viewBox 40 0 800 420), coloured espresso, in an outlined badge. The cleared
// area is snapped to whole modules (the QR's squares) so no square is cut in half.
const logo = await readFile("public/logo-mark.svg", "utf8");
const logoInner = logo.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const odd = (n) => Math.round(n) | 1; // odd module counts keep the badge centred on the grid
const clearW = odd(size * 0.34);
const clearH = odd(clearW * 0.6);
const x0 = (size - clearW) / 2;
const y0 = (size - clearH) / 2;
const pad = 0.6; // modules of white between the code and the outline
const logoW = (clearW - 2 * pad) * 0.78;
const logoH = logoW * (420 / 800);
const badge = `
  <rect x="${x0}" y="${y0}" width="${clearW}" height="${clearH}" fill="#ffffff"/>
  <rect x="${x0 + pad}" y="${y0 + pad}" width="${clearW - 2 * pad}" height="${clearH - 2 * pad}" rx="1.2" fill="#ffffff" stroke="${INK}" stroke-width="0.35"/>
  <svg x="${(size - logoW) / 2}" y="${(size - logoH) / 2}" width="${logoW}" height="${logoH}" viewBox="40 0 800 420" fill="${INK}" color="${INK}">${logoInner}</svg>`;

const svg = qr.replace(/<\/svg>\s*$/, `${badge}</svg>`).replace("<svg ", '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ');
await writeFile("public/qr-menu.svg", svg);
await sharp(Buffer.from(svg), { density: 600 }).resize(1200, 1200).png().toFile("public/qr-menu.png");
console.log(`QR code for ${url} → public/qr-menu.svg, public/qr-menu.png`);
