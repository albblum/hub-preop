import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import type { HubRole } from "@prisma/client";

const github =
  process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
    ? GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      })
    : null;

export const authConfig = {
  trustHost: true,
  providers: github ? [github] : [],
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        const fromUser = (user as { roles?: HubRole[] }).roles;
        if (fromUser && fromUser.length > 0) {
          token.roles = fromUser;
        } else if (account?.provider === "github") {
          token.roles = ["viewer_registered"] as HubRole[];
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.roles = (token.roles as HubRole[] | undefined) ?? [];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
