import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { HubRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

const credentials = Credentials({
  name: "Credentials",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    const emailRaw = credentials?.email as string | undefined;
    const password = credentials?.password as string | undefined;
    if (!emailRaw || !password) return null;
    const email = emailRaw.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        committeeMemberships: {
          where: { status: "active" },
          include: { committee: true },
        },
      },
    });
    if (!user?.passwordHash) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    const committeeMemberships = user.committeeMemberships.map((m) => ({
      committeeId: m.committeeId,
      code: m.committee.code,
      startedAt: m.startedAt.toISOString(),
      authorityInstrumentId: m.authorityInstrumentId,
    }));
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      roles: user.roles,
      memberIdrRef: `idr:MEMBER-${user.id.slice(-8).toUpperCase()}`,
      joinedAt: user.createdAt.toISOString(),
      committeeMemberships,
    };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [...authConfig.providers, credentials],
});
