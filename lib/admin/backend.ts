/**
 * Where the admin reads and publishes files:
 * - GitHub: the live setup. Each publish is one commit on main; Vercel redeploys the site.
 * - Local: `npm run dev` only, writes straight to this folder through /api/admin/local.
 */

export const REPO = "hasanalammar01/Arabica_coffee_shop";
export const BRANCH = "main";

export type FileChange = { path: string; content: string | Blob };

export type Backend = {
  user: { name: string; detail: string };
  /** Shown after a successful publish. */
  afterPublish: string;
  loadJson<T>(path: string): Promise<T>;
  /** Writes all files at once (one commit). Throws a message ready to show staff. */
  publish(changes: FileChange[], message: string): Promise<void>;
};

const toBase64 = (content: string | Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(typeof content === "string" ? new Blob([content]) : content);
  });

const fromBase64 = (b64: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

export const CONFLICT =
  "Someone else published changes since you opened the admin. Reload the page to get the latest version, then make your change again.";

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function githubBackend(token: string): Promise<Backend> {
  const api = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    let res: Response;
    try {
      res = await fetch(`https://api.github.com${path}`, {
        ...init,
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      });
    } catch {
      throw new Error("Can't reach GitHub. Check your internet connection and try again.");
    }
    if (!res.ok) throw new HttpError(res.status, `GitHub error ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  };
  const post = <T>(path: string, body: unknown, method = "POST") =>
    api<T>(path, { method, body: JSON.stringify(body) });

  const user = await api<{ login: string; name: string | null }>("/user");
  const repo = await api<{ permissions?: { push?: boolean } }>(`/repos/${REPO}`).catch(() => null);
  if (!repo?.permissions?.push)
    throw new Error(
      `Your GitHub account (${user.login}) can't edit this menu. Ask the owner to add you as a collaborator.`,
    );

  // Blob sha of each file as loaded, to detect someone else publishing in between.
  const loaded = new Map<string, string>();
  const file = (path: string, ref: string) =>
    api<{ sha: string; content: string }>(`/repos/${REPO}/contents/${path}?ref=${ref}`);

  return {
    user: { name: user.name || user.login, detail: "Signed in with GitHub" },
    afterPublish: "Published. The public menu updates in about a minute.",

    async loadJson<T>(path: string) {
      const f = await file(path, BRANCH);
      loaded.set(path, f.sha);
      return JSON.parse(fromBase64(f.content)) as T;
    },

    async publish(changes, message) {
      const head = (await api<{ object: { sha: string } }>(`/repos/${REPO}/git/ref/heads/${BRANCH}`)).object
        .sha;
      for (const c of changes)
        if (loaded.has(c.path) && (await file(c.path, head)).sha !== loaded.get(c.path))
          throw new Error(CONFLICT);

      const tree = await Promise.all(
        changes.map(async (c) => ({
          path: c.path,
          mode: "100644",
          type: "blob",
          sha: (
            await post<{ sha: string }>(`/repos/${REPO}/git/blobs`, {
              content: await toBase64(c.content),
              encoding: "base64",
            })
          ).sha,
        })),
      );
      const base = await api<{ tree: { sha: string } }>(`/repos/${REPO}/git/commits/${head}`);
      const newTree = await post<{ sha: string }>(`/repos/${REPO}/git/trees`, {
        base_tree: base.tree.sha,
        tree,
      });
      const commit = await post<{ sha: string }>(`/repos/${REPO}/git/commits`, {
        message,
        tree: newTree.sha,
        parents: [head],
      });
      try {
        await post(`/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha }, "PATCH");
      } catch (e) {
        // 422: main moved on (someone else published) and this commit isn't a fast-forward.
        throw e instanceof HttpError && e.status === 422 ? new Error(CONFLICT) : e;
      }
      for (const t of tree) loaded.set(t.path, t.sha);
    },
  };
}

export const localBackend: Backend = {
  user: { name: "Local editor", detail: "Editing files on this computer" },
  afterPublish: "Saved to this computer. The local site updates right away.",

  async loadJson<T>(path: string) {
    const res = await fetch(`/api/admin/local?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Couldn't read ${path} (${res.status}).`);
    return res.json() as Promise<T>;
  },

  async publish(changes) {
    const files = await Promise.all(
      changes.map(async (c) => ({ path: c.path, content: await toBase64(c.content) })),
    );
    const res = await fetch("/api/admin/local", { method: "POST", body: JSON.stringify({ files }) });
    if (!res.ok) throw new Error(`Couldn't save the files (${res.status}): ${await res.text()}`);
  },
};

/**
 * GitHub sign-in in a popup, using the /api/decap/* handlers and Decap's message
 * protocol: the popup says "authorizing:github", we echo it, it sends the token.
 */
export function signInWithGitHub(): Promise<string> {
  return new Promise((resolve, reject) => {
    const popup = window.open(
      "/api/decap/auth?provider=github&scope=repo",
      "github-login",
      "width=600,height=720",
    );
    if (!popup) return reject(new Error("Allow pop-ups for this site, then try again."));
    const done = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(watch);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || typeof e.data !== "string") return;
      if (e.data === "authorizing:github") return popup.postMessage(e.data, e.origin);
      const match = /^authorization:github:(success|error):([\s\S]*)$/.exec(e.data);
      if (!match) return;
      done();
      popup.close();
      const payload = JSON.parse(match[2]) as { token?: string; error?: string };
      if (match[1] === "success" && payload.token) resolve(payload.token);
      else reject(new Error(payload.error ?? "GitHub sign-in failed. Try again."));
    };
    const watch = setInterval(() => {
      if (popup.closed) {
        done();
        reject(new Error("The sign-in window was closed before finishing."));
      }
    }, 500);
    window.addEventListener("message", onMessage);
  });
}
