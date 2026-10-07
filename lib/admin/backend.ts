/**
 * The admin's link to the server (/api/admin/*). The server holds the GitHub key and
 * decides where files go (lib/admin/store.ts); the browser only ever sees the menu files.
 */

export type FileChange = { path: string; content: string | Blob };
export type Mode = "github" | "local";

export type Backend = {
  user: { name: string; detail: string };
  /** Shown after a successful publish. */
  afterPublish: string;
  loadJson<T>(path: string): Promise<T>;
  /** Writes all files at once (one commit). Throws a message ready to show staff. */
  publish(changes: FileChange[], message: string): Promise<void>;
};

async function api(path: string, init: RequestInit = {}) {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    throw new Error("Can't reach the website. Check your internet connection and try again.");
  }
  if (!res.ok) throw new Error((await res.text()) || `Something went wrong (${res.status}).`);
  return res;
}

const toBase64 = (content: string | Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(typeof content === "string" ? new Blob([content]) : content);
  });

export const getSession = async () =>
  (await (await api("/api/admin/session")).json()) as {
    signedIn: boolean;
    mode: Mode | null;
  };

export const signIn = (password: string) =>
  api("/api/admin/session", { method: "POST", body: JSON.stringify({ password }) });

export const signOut = () => api("/api/admin/session", { method: "DELETE" });

export function connect(mode: Mode | null): Backend {
  // Version of each file as loaded, so the server can refuse to overwrite someone else's publish.
  const versions = new Map<string, string>();
  const local = mode === "local";
  return {
    user: local
      ? { name: "Local editor", detail: "Editing files on this computer" }
      : { name: "Arabica staff", detail: "Signed in" },
    afterPublish: local
      ? "Saved to this computer. The local site updates right away."
      : "Published. The public menu updates in about a minute.",

    async loadJson<T>(path: string) {
      const res = await api(`/api/admin/files?path=${encodeURIComponent(path)}`);
      const { text, sha } = (await res.json()) as { text: string; sha: string | null };
      if (sha) versions.set(path, sha);
      return JSON.parse(text) as T;
    },

    async publish(changes, message) {
      const files = await Promise.all(
        changes.map(async (c) => ({ path: c.path, content: await toBase64(c.content) })),
      );
      const base = Object.fromEntries(
        changes.filter((c) => versions.has(c.path)).map((c) => [c.path, versions.get(c.path)]),
      );
      const res = await api("/api/admin/files", {
        method: "POST",
        body: JSON.stringify({ message, files, base }),
      });
      const { versions: next } = (await res.json()) as { versions: Record<string, string> };
      for (const [path, sha] of Object.entries(next)) versions.set(path, sha);
    },
  };
}
