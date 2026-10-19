import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { guard } from "@/lib/admin/guard";
import { canPublish } from "@/lib/admin/permissions";
import { ALLOWED, mode, publish, readText } from "@/lib/admin/store";
import { ContentError } from "@/lib/content-core";
import { publishProblem } from "@/lib/admin/publish-check";
import { logActivity } from "@/lib/db";
import { readJson } from "@/lib/http";

const text = (message: string, status: number) => new NextResponse(message, { status });

const NOT_SET_UP = "The database isn't connected. Connect Neon in Vercel, then redeploy.";
const MAX_FILE = 3_000_000; // base64 characters, about 2 MB
const MAX_REQUEST = 4_000_000; // below Vercel's function request limit, including base64 photos

const fail = (e: unknown) =>
  e instanceof ContentError ? text(e.message, e.status) : text("Something went wrong. Try again.", 500);

/**
 * Read current menu or shop information from the content store. Any signed-in
 * user: the admin needs both to start, and both files are public on the website anyway.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if ("refuse" in g) return g.refuse;
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
  const g = await guard(req, { write: true });
  if ("refuse" in g) return g.refuse;
  if (!mode()) return text(NOT_SET_UP, 503);

  const body = (await readJson(req, MAX_REQUEST)) as {
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
        f !== null &&
        typeof f === "object" &&
        typeof f.path === "string" &&
        ALLOWED.test(f.path) &&
        typeof f.content === "string" &&
        f.content.length <= MAX_FILE,
    );
  if (!valid) return text("That change can't be published.", 400);
  for (const f of files as { path: string; content: string }[]) {
    // Staff publish only what their pages cover: the menu (and photos), or shop info.
    if (!canPublish(g.user, f.path)) return text("You don't have access to change this.", 403);
    const problem = publishProblem(f.path, f.content);
    if (problem) return text(problem, 400);
  }

  const base = Object.fromEntries(
    Object.entries(body?.base ?? {}).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
  try {
    const result = await publish(
      files as { path: string; content: string }[],
      `${body!.message as string} (via menu admin, by ${g.user.role === "admin" ? "super admin" : `staff: ${g.user.name}`})`,
      base,
    );
    // The save already succeeded. A cache/log failure must not tell staff it failed.
    try {
      revalidatePath("/[lang]", "layout");
    } catch (e) {
      console.error("Content cache invalidation failed:", e);
    }
    await logActivity(g.user.name, body!.message as string).catch((e) =>
      console.error("Content activity log failed:", e),
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
