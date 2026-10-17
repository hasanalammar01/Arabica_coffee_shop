import { NextResponse, type NextRequest } from "next/server";

/**
 * Language routing. English pages keep clean URLs (/menu) and are served from the
 * internal /en/... routes; Arabic lives at /ar/.... Anyone landing on /en/... is
 * redirected to the clean English URL so each page has one address.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/ar" || pathname.startsWith("/ar/")) return;
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }
  const url = request.nextUrl.clone();
  url.pathname = `/en${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.rewrite(url);
}

export const config = {
  // Everything except the admin, APIs, Next internals and files with an extension (images, sw.js, …).
  matcher: ["/((?!admin|api|_next|.*\\..*).*)"],
};
