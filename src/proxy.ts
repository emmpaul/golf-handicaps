import { type NextRequest, NextResponse } from "next/server";
import { decideAccess } from "@/lib/auth/access";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";

export function proxy(request: NextRequest) {
  const decision = decideAccess({
    method: request.method,
    pathname: request.nextUrl.pathname,
    token: request.cookies.get(SESSION_COOKIE_NAME)?.value,
    secret: getEnv().SESSION_SECRET,
    now: Date.now(),
  });
  if (decision === "unauthorized") {
    return NextResponse.json({ error: "Session requise" }, { status: 401 });
  }
  if (decision === "redirect-login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Tout passe par le proxy, sauf les assets statiques générés par Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
