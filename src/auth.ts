import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Role, Tier } from "@prisma/client";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        // Throttle sign-in attempts to blunt password guessing: by visitor IP
        // and by the email being tried. Denied attempts fail like a bad login.
        const ip = getClientIp(await headers());
        const byIp = checkRateLimit(`login:ip:${ip}`, {
          limit: 20,
          windowMs: 10 * 60 * 1000,
        });
        const byEmail = checkRateLimit(`login:email:${email}`, {
          limit: 10,
          windowMs: 10 * 60 * 1000,
        });
        if (!byIp.allowed || !byEmail.allowed) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tier: user.tier,
          agencyId: user.agencyId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tier = user.tier;
        token.agencyId = user.agencyId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.tier = token.tier as Tier;
      session.user.agencyId = (token.agencyId as string | null) ?? null;
      return session;
    },
  },
});
