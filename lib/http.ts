/**
 * Reads a JSON request body, refusing anything over `maxBytes` so nobody can make the server
 * read huge payloads. Returns null for a missing, oversized or malformed body.
 */
export async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes) return null;
  const text = await req.text().catch(() => "");
  // The header can be missing or wrong, so check what actually arrived too.
  if (!text || new TextEncoder().encode(text).length > maxBytes) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
