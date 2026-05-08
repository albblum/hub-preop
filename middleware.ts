import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

function redirectToLogin(req: { auth: unknown; nextUrl: URL }) {
  const login = new URL("/login", req.nextUrl.origin);
  login.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return Response.redirect(login);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/ops") ||
    pathname.startsWith("/normalization") ||
    pathname.startsWith("/review")
  ) {
    if (!req.auth) {
      return redirectToLogin(req);
    }
  }
  /** Edição de instrumentos: exige sessão (evita flash de UI só com API protegida). */
  if (/^\/instruments\/[^/]+\/edit$/.test(pathname)) {
    if (!req.auth) {
      return redirectToLogin(req);
    }
  }
});

export const config = {
  matcher: [
    "/ops/:path*",
    "/normalization/:path*",
    "/review",
    "/review/:path*",
    "/instruments/:id/edit",
  ],
};
