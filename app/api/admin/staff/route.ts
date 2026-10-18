import { NextResponse, type NextRequest } from "next/server";
import { hashPassword, MIN_PASSWORD } from "@/lib/admin/auth";
import { guard } from "@/lib/admin/guard";
import { cleanPages, PAGE_LABELS, type Page } from "@/lib/admin/permissions";
import {
  createStaff,
  deleteStaff,
  getSettings,
  listStaff,
  logActivity,
  markSignedOut,
  staffPresence,
  updateStaff,
  type StaffRow,
} from "@/lib/db";
import { readJson } from "@/lib/http";

/** Staff accounts: super admin only. Responses never include password hashes. */
const text = (message: string, status: number) => new NextResponse(message, { status });
const USERNAME = /^[a-z0-9._-]{3,40}$/;
const publicRow = ({ id, username, pages, active, createdAt }: StaffRow) => ({ id, username, pages, active, createdAt });

function passwordProblem(password: unknown, username: string) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD)
    return `The password needs at least ${MIN_PASSWORD} characters.`;
  if (password.toLowerCase().includes(username)) return "The password can't contain the username.";
  return null;
}

/** The accounts, with who is online and when each was last active. */
export async function GET(req: NextRequest) {
  const g = await guard(req, { adminOnly: true, needsDb: true });
  if ("refuse" in g) return g.refuse;
  const [staff, presence] = await Promise.all([listStaff(), staffPresence()]);
  const offline = { online: false, lastSeen: null, lastSignout: null };
  return NextResponse.json(
    staff.map((s) => ({ ...publicRow(s), ...(presence.get(s.id) ?? offline) })),
    { headers: { "Cache-Control": "no-store" } },
  );
}

const pageNames = (pages: Page[]) => (pages.length ? pages.map((p) => PAGE_LABELS[p]).join(", ") : "no pages");

/** Create: { username, password, pages }. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { write: true, adminOnly: true, needsDb: true });
  if ("refuse" in g) return g.refuse;
  const body = ((await readJson(req, 2_000)) ?? {}) as Record<string, unknown>;
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  if (!USERNAME.test(username))
    return text("The username needs 3 to 40 letters, numbers, dots, dashes or underscores.", 400);
  if (username === (await getSettings()).username.toLowerCase())
    return text("That's the super admin's username. Choose another.", 400);
  const problem = passwordProblem(body.password, username);
  if (problem) return text(problem, 400);
  const row = await createStaff(username, hashPassword(body.password as string), cleanPages(body.pages));
  if (!row) return text("A staff account already uses that username.", 400);
  await logActivity(g.user.name, `Created staff account "${row.username}" (${pageNames(row.pages)})`);
  return NextResponse.json(publicRow(row));
}

/** Change: { id, pages?, active?, password?, signOut? }. Any change signs that person out. */
export async function PATCH(req: NextRequest) {
  const g = await guard(req, { write: true, adminOnly: true, needsDb: true });
  if ("refuse" in g) return g.refuse;
  const body = ((await readJson(req, 2_000)) ?? {}) as Record<string, unknown>;
  if (!Number.isInteger(body.id)) return text("Bad request.", 400);
  const id = body.id as number;
  const current = (await listStaff()).find((s) => s.id === id);
  if (!current) return text("That staff account doesn't exist.", 404);
  if (body.password !== undefined) {
    const problem = passwordProblem(body.password, current.username);
    if (problem) return text(problem, 400);
  }
  // "Sign out now": the update below ends their sessions; also mark them signed out.
  if (body.signOut === true) await markSignedOut(id);
  const row = await updateStaff(id, {
    ...(body.pages !== undefined && { pages: cleanPages(body.pages) }),
    ...(typeof body.active === "boolean" && { active: body.active }),
    ...(body.password !== undefined && { passwordHash: hashPassword(body.password as string) }),
  });
  if (!row) return text("That staff account doesn't exist.", 404);
  const what = [
    body.pages !== undefined && row.pages.join() !== current.pages.join() && `access to ${pageNames(row.pages)}`,
    typeof body.active === "boolean" && body.active !== current.active && (row.active ? "account restarted" : "account stopped"),
    body.password !== undefined && "set a new password",
    body.signOut === true && "signed out by the super admin",
  ].filter(Boolean);
  await logActivity(g.user.name, `Staff "${row.username}": ${what.join(", ") || "no change"}`);
  return NextResponse.json(publicRow(row));
}

/** Delete: { id }. */
export async function DELETE(req: NextRequest) {
  const g = await guard(req, { write: true, adminOnly: true, needsDb: true });
  if ("refuse" in g) return g.refuse;
  const body = ((await readJson(req, 500)) ?? {}) as Record<string, unknown>;
  const gone = (await listStaff()).find((s) => s.id === body.id);
  if (!gone || !(await deleteStaff(gone.id))) return text("That staff account doesn't exist.", 404);
  await logActivity(g.user.name, `Deleted staff account "${gone.username}"`);
  return new NextResponse(null, { status: 204 });
}
