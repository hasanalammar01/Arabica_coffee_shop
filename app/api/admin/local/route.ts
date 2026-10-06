import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Local editing for `npm run dev`: lets /admin read and write the menu files in this
 * folder without GitHub. Disabled (404) in production builds.
 */
const ALLOWED = /^(data\/(menu|site)\.json|public\/menu\/[a-z0-9-]+\.webp)$/;
const enabled = process.env.NODE_ENV === "development";
const notFound = () => new Response("Not found", { status: 404 });

export async function GET(req: Request) {
  if (!enabled) return notFound();
  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!ALLOWED.test(path) || !path.endsWith(".json")) return new Response("Bad path", { status: 400 });
  return new Response(await readFile(join(process.cwd(), path)), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  if (!enabled) return notFound();
  const { files } = (await req.json()) as { files: { path: string; content: string }[] };
  if (!Array.isArray(files) || files.some((f) => !ALLOWED.test(f.path) || typeof f.content !== "string"))
    return new Response("Bad path", { status: 400 });
  for (const f of files) await writeFile(join(process.cwd(), f.path), Buffer.from(f.content, "base64"));
  return new Response(null, { status: 204 });
}
