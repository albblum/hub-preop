import type { DefaultSession } from "next-auth";
import type { HubRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    roles?: HubRole[];
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      roles: HubRole[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roles?: HubRole[];
  }
}
