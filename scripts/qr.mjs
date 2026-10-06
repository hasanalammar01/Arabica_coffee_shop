// Generates a printable QR code pointing at the menu: public/qr-menu.svg and public/qr-menu.png.
// Usage: npm run qr   (uses site.url from data/site.ts, or pass a URL: npm run qr -- https://example.com/menu)
import { writeFile } from "node:fs/promises";
import QRCode from "qrcode";
import { site } from "../data/site.ts";

const url = process.argv[2] ?? `${site.url}/menu`;
const opts = { errorCorrectionLevel: "M", margin: 2, color: { dark: "#2b1d14", light: "#ffffff" } };

await writeFile("public/qr-menu.svg", await QRCode.toString(url, { ...opts, type: "svg" }));
await QRCode.toFile("public/qr-menu.png", url, { ...opts, width: 1200 });
console.log(`QR code for ${url} → public/qr-menu.svg, public/qr-menu.png`);
