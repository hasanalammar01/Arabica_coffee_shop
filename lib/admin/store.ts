import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Where the admin reads and writes the menu files (server only):
 * - GitHub (GITHUB_TOKEN set): the live setup. Each publish is one commit on the branch;
 *   Vercel then redeploys the site. Staff never need a GitHub account.
 * - This folder: `npm run dev` without GITHUB_TOKEN.
 */
export const REPO = "hasanalammar01/Arabica_coffee_shop";
export const BRANCH = process.env.GITHUB_BRANCH || "main";

/** The only files the admin may touch. */
export const ALLOWED = /^(data\/(menu|site)\.json|public\/menu\/[a-z0-9-]+\.webp)$/;

export const CONFLICT =
  "Someone else published changes since you opened the admin. Reload the page to get the latest version, then make your change again.";

export class StoreError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Mode = "github" | "local";
export const mode = (): Mode | null =>
  process.env.GITHUB_TOKEN ? "github" : process.env.NODE_ENV === "development" ? "local" : null;

async function github<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch {
    throw new StoreError(502, "The website can't reach GitHub right now. Try again in a minute.");
  }
  if (res.status === 401 || res.status === 403)
    throw new StoreError(
      502,
      "GitHub refused the website's access key (GITHUB_TOKEN). It may have expired. Ask the owner to renew it.",
    );
  if (!res.ok) throw new StoreError(res.status, `GitHub error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}
const send = <T>(path: string, body: unknown, method = "POST") =>
  github<T>(path, { method, body: JSON.stringify(body) });

const contents = (path: string, ref: string) =>
  github<{ sha: string; content: string }>(`/contents/${path}?ref=${ref}`);

/** File text, plus its version (blob sha) so a later publish can detect conflicts. */
export async function readText(path: string): Promise<{ text: string; sha: string | null }> {
  // Local mode only runs in `npm run dev`; the ignore comment stops the production build
  // from bundling the whole project into this function to cover the computed path.
  if (mode() === "local")
    return { text: await readFile(join(/*turbopackIgnore: true*/ process.cwd(), path), "utf8"), sha: null };
  const f = await contents(path, BRANCH);
  return { text: Buffer.from(f.content, "base64").toString("utf8"), sha: f.sha };
}

/**
 * Writes all files in one commit. `base` holds the version of each data file the
 * editor started from; if any changed since, nothing is written (409).
 * Returns the new version of each written file.
 */
export async function publish(
  files: { path: string; content: string }[],
  message: string,
  base: Record<string, string>,
): Promise<Record<string, string>> {
  if (mode() === "local") {
    for (const f of files)
      await writeFile(
        join(/*turbopackIgnore: true*/ process.cwd(), f.path),
        Buffer.from(f.content, "base64"),
      );
    return {};
  }

  const head = (await github<{ object: { sha: string } }>(`/git/ref/heads/${BRANCH}`)).object.sha;
  for (const f of files)
    if (base[f.path] && (await contents(f.path, head)).sha !== base[f.path])
      throw new StoreError(409, CONFLICT);

  const tree = await Promise.all(
    files.map(async (f) => ({
      path: f.path,
      mode: "100644",
      type: "blob",
      sha: (await send<{ sha: string }>("/git/blobs", { content: f.content, encoding: "base64" })).sha,
    })),
  );
  const parent = await github<{ tree: { sha: string } }>(`/git/commits/${head}`);
  const newTree = await send<{ sha: string }>("/git/trees", { base_tree: parent.tree.sha, tree });
  const commit = await send<{ sha: string }>("/git/commits", { message, tree: newTree.sha, parents: [head] });
  try {
    await send(`/git/refs/heads/${BRANCH}`, { sha: commit.sha }, "PATCH");
  } catch (e) {
    // 422: the branch moved on (someone else published), so this isn't a fast-forward.
    throw e instanceof StoreError && e.status === 422 ? new StoreError(409, CONFLICT) : e;
  }
  return Object.fromEntries(tree.map((t) => [t.path, t.sha]));
}
