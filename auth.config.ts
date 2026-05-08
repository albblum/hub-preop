import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import type { HubRole } from "@prisma/client";
import type { CommitteeMembershipClaim } from "@/lib/rbac";

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
        const memberIdrRef = (user as { memberIdrRef?: string }).memberIdrRef;
        const joinedAt = (user as { joinedAt?: string }).joinedAt;
        const committees = (user as { committeeMemberships?: CommitteeMembershipClaim[] })
          .committeeMemberships;
        if (fromUser && fromUser.length > 0) {
          token.roles = fromUser;
        } else if (account?.provider === "github") {
          token.roles = ["viewer_registered"] as HubRole[];
        }
        if (memberIdrRef) token.memberIdrRef = memberIdrRef;
        if (joinedAt) token.joinedAt = joinedAt;
        if (committees && committees.length > 0) {
          token.committeeMemberships = committees;
        } else {
          token.committeeMemberships = [];
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.roles = (token.roles as HubRole[] | undefined) ?? [];
        session.user.memberIdrRef = (token.memberIdrRef as string | undefined) ?? undefined;
        session.user.joinedAt = (token.joinedAt as string | undefined) ?? undefined;
        session.user.committeeMemberships = Array.isArray(token.committeeMemberships)
          ? (token.committeeMemberships as CommitteeMembershipClaim[])
          : [];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
