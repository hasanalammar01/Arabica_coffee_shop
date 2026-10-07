import { NextResponse, type NextRequest } from "next/server";
import { isSignedIn, sameOrigin } from "@/lib/admin/auth";
import { ALLOWED, mode, publish, readText, StoreError } from "@/lib/admin/store";

const text = (message: string, status: number) => new NextResponse(message, { status });

const NOT_SET_UP =
  "The admin isn't connected to GitHub yet. Add GITHUB_TOKEN in Vercel (see README), then redeploy.";
const MAX_FILE = 3_000_000; // base64 characters, about 2 MB

const fail = (e: unknown) =>
  e instanceof StoreError ? text(e.message, e.status) : text("Something went wrong. Try again.", 500);

/** Read data/menu.json or data/site.json (latest version, not the deployed copy). */
export async function GET(req: NextRequest) {
  if (!isSignedIn(req)) return text("Your session ended. Sign in again.", 401);
  if (!mode()) return text(NOT_SET_UP, 503);
  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!ALLOWED.test(path) || !path.endsWith(".json")) return text("That file can't be read here.", 400);
  try {
    return NextResponse.json(await readText(path), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

/** Publish: { message, files: [{ path, content (base64) }], base: { path: version } }. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return text("Not allowed.", 403);
  if (!isSignedIn(req)) return text("Your session ended. Sign in again, then publish.", 401);
  if (!mode()) return text(NOT_SET_UP, 503);

  const body = (await req.json().catch(() => null)) as {
    message?: unknown;
    files?: { path?: unknown; content?: unknown }[];
    base?: Record<string, unknown>;
  } | null;
  const files = Array.isArray(body?.files) ? body.files : [];
  const valid =
    typeof body?.message === "string" &&
    body.message.length <= 200 &&
    files.length > 0 &&
    files.length <= 10 &&
    files.every(
      (f) =>
        typeof f.path === "string" &&
        ALLOWED.test(f.path) &&
        typeof f.content === "string" &&
        f.content.length <= MAX_FILE,
    );
  if (!valid) return text("That change can't be published.", 400);

  const base = Object.fromEntries(
    Object.entries(body?.base ?? {}).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
  try {
    const versions = await publish(
      files as { path: string; content: string }[],
      `${body!.message as string} (via menu admin)`,
      base,
    );
    return NextResponse.json({ versions });
  } catch (e) {
    return fail(e);
  }
}
