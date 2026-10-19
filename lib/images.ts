/** Local assets and public Blob images accepted by the menu and shop editor. */
export const IMAGE_PATH = /^\/(menu|photos)\/[a-z0-9][a-z0-9-]*\.(webp|png|jpe?g)$/;

export function isBlobImage(src: string): boolean {
  try {
    const url = new URL(src);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash &&
      /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname) &&
      /^\/(menu|photos)\/[a-zA-Z0-9][a-zA-Z0-9-]*\.(webp|png|jpe?g)$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export const isSiteImage = (src: string) => IMAGE_PATH.test(src) || isBlobImage(src);
