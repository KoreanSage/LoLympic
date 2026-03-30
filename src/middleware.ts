import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PATHS = ["/upload", "/settings", "/messages", "/admin", "/bookmarks", "/dashboard"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow the banned page itself and auth routes
  if (pathname === "/banned" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Check for banned users on all non-static routes
  const token = await getToken({ req: request });

  if (token?.isBanned && pathname !== "/banned") {
    const bannedUrl = new URL("/banned", request.url);
    return NextResponse.redirect(bannedUrl);
  }

  // Only check protected routes for auth
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/upload/:path*", "/settings/:path*", "/messages/:path*", "/admin/:path*", "/bookmarks/:path*", "/dashboard/:path*", "/banned"],
};
