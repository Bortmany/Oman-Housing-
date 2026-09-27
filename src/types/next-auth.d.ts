import type { Role, Tier } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      tier: Tier;
      agencyId: string | null;
      /** Whether the user's agency (if any) has been approved by an admin. */
      agencyApproved: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
    tier?: Tier;
    agencyId?: string | null;
    agencyApproved?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    tier?: Tier;
    agencyId?: string | null;
    agencyApproved?: boolean;
    /** Epoch ms of the last database re-read of role/agency (src/auth.ts). */
    roleCheckedAt?: number;
  }
}
