import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/ops") ||
    pathname.startsWith("/normalization") ||
    pathname.startsWith("/review")
  ) {
    if (!req.auth) {
      const login = new URL("/login", req.nextUrl.origin);
      login.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
      return Response.redirect(login);
    }
  }
});

export const config = {
  matcher: ["/ops/:path*", "/normalization/:path*", "/review/:path*"],
};
