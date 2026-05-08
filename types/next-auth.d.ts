import type { DefaultSession } from "next-auth";
import type { HubRole } from "@prisma/client";
import type { CommitteeMembershipClaim } from "@/lib/rbac";

declare module "next-auth" {
  interface User {
    roles?: HubRole[];
    memberIdrRef?: string;
    joinedAt?: string;
    committeeMemberships?: CommitteeMembershipClaim[];
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      roles: HubRole[];
      memberIdrRef?: string;
      joinedAt?: string;
      committeeMemberships: CommitteeMembershipClaim[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roles?: HubRole[];
    memberIdrRef?: string;
    joinedAt?: string;
    committeeMemberships?: CommitteeMembershipClaim[];
  }
}
