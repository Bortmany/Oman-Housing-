import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Role, Tier } from "@prisma/client";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// A precomputed bcrypt hash (cost 10, same as every real password below) of
// an arbitrary string nobody will ever type. Comparing against it for
// unknown emails — or accounts with no password set — makes a login attempt
// cost the same ~bcrypt-compare time whether or not the email exists, so
// response timing can't be used to enumerate registered emails.
const DUMMY_PASSWORD_HASH =
  "$2b$10$bjIu4fPZNeTw9dkdsKYBHeLDM6zy2.vt6c6VarmCZYA.tsMebqDDS";

// Once an email/IP is over its wrong-guess limit, add this delay before
// rejecting — slows down automated brute-forcing further without ever
// blocking a correct password (see the `ok` check below).
const LOGIN_BACKOFF_MS = 1500;

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

        const ip = getClientIp(await headers());
        const user = await prisma.user.findUnique({ where: { email } });

        // Always run a real bcrypt compare — even for an email that doesn't
        // exist, or an account with no password set — against the dummy
        // hash above. Skipping bcrypt for those cases would make the
        // response ~15-20x faster, letting a visitor learn which emails
        // have accounts purely from how long the request took.
        const ok = await bcrypt.compare(
          password,
          user?.passwordHash ?? DUMMY_PASSWORD_HASH,
        );

        // A correct password always signs the owner in — even if this email
        // or IP has racked up wrong guesses first. The rate limiter below
        // only ever throttles WRONG guesses, so 11 mistyped attempts (by the
        // real owner, or by someone deliberately failing logins to lock
        // them out) can never deny the correct 12th attempt. This is the
        // fix for the self-inflicted-lockout finding.
        if (user?.passwordHash && ok) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tier: user.tier,
            agencyId: user.agencyId,
          };
        }

        // Wrong password (or unknown email, or a passwordless account):
        // count the miss against both the visitor's IP and the email being
        // tried, so brute-forcing stays expensive. Once either is over its
        // limit, add a short delay before rejecting — a progressive
        // backoff instead of a hard, sticky deny.
        const byIp = checkRateLimit(`login:ip:${ip}`, {
          limit: 20,
          windowMs: 10 * 60 * 1000,
        });
        const byEmail = checkRateLimit(`login:email:${email}`, {
          limit: 10,
          windowMs: 10 * 60 * 1000,
        });
        if (!byIp.allowed || !byEmail.allowed) {
          await new Promise((resolve) => setTimeout(resolve, LOGIN_BACKOFF_MS));
        }
        return null;
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
