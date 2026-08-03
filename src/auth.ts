import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role, Tier } from "@prisma/client";
import { checkRateLimit, getAnonRateLimitKey } from "@/lib/rate-limit";
import { safePath } from "@/lib/safePath";

// A precomputed bcrypt hash (cost 10, same as every real password below) of
// an arbitrary string nobody will ever type. Comparing against it for
// unknown emails — or accounts with no password set — makes a login attempt
// cost the same ~bcrypt-compare time whether or not the email exists, so
// response timing can't be used to enumerate registered emails.
const DUMMY_PASSWORD_HASH =
  "$2b$10$bjIu4fPZNeTw9dkdsKYBHeLDM6zy2.vt6c6VarmCZYA.tsMebqDDS";

// Once an email/IP is over its wrong-guess limit, we delay the rejection —
// slowing down automated brute-forcing without ever blocking a correct
// password (see the `ok` check below). The delay GROWS with repeated wrong
// guesses (doubling per guess past the limit) up to an impractically slow
// ceiling, rather than staying at one fixed, brute-forceable delay.
const LOGIN_BACKOFF_BASE_MS = 1500;
const LOGIN_BACKOFF_MAX_MS = 30_000; // ~30s ceiling — still bounded so a
// real request never hangs forever, but far too slow for automated guessing
// to be worthwhile.

// Once a single email has racked up this many wrong guesses inside the
// window (well past ordinary user typos), a real deployment should require
// a human-challenge step (CAPTCHA/hCaptcha/Cloudflare Turnstile) before
// accepting further attempts for that email. See requireLoginChallenge()
// below — it's a stub seam, not wired to anything yet.
const LOGIN_CHALLENGE_THRESHOLD = 25;

/**
 * Pluggable seam for a future human-challenge step (e.g. CAPTCHA). Called
 * once an email has failed LOGIN_CHALLENGE_THRESHOLD+ times inside the
 * rate-limit window. Does nothing yet but log — a real deployment would plug
 * a CAPTCHA verification call in here and return false (deny) when it
 * fails. Kept as a single call site so wiring a real check later is a
 * one-function change, not a hunt through the auth flow.
 */
function requireLoginChallenge(email: string, failureCount: number): void {
  console.warn(
    `[auth] ${email} has failed ${failureCount} login attempts — a CAPTCHA/challenge step would gate further attempts here once wired up.`,
  );
}

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

        const anonKey = await getAnonRateLimitKey();
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
        // count the miss against both the visitor's anonymous key and the
        // email being tried, so brute-forcing stays expensive. Once either
        // is over its limit, add a delay before rejecting — a progressive
        // backoff instead of a hard, sticky deny. The delay grows with how
        // far over the limit the guesser is, up to LOGIN_BACKOFF_MAX_MS.
        const byIp = checkRateLimit(`login:ip:${anonKey}`, {
          limit: 20,
          windowMs: 10 * 60 * 1000,
        });
        const byEmail = checkRateLimit(`login:email:${email}`, {
          limit: 10,
          windowMs: 10 * 60 * 1000,
        });
        if (!byIp.allowed || !byEmail.allowed) {
          // How many wrong guesses PAST the limit this is (0 = the first
          // denial). Doubling the delay each guess past that first one is
          // what makes the ceiling "impractically slow" for a script while
          // the very first denial still feels like the original short delay.
          const overshoot = Math.max(byIp.count - 20 - 1, byEmail.count - 10 - 1, 0);
          const delayMs = Math.min(
            LOGIN_BACKOFF_MAX_MS,
            LOGIN_BACKOFF_BASE_MS * 2 ** overshoot,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));

          if (byEmail.count >= LOGIN_CHALLENGE_THRESHOLD) {
            requireLoginChallenge(email, byEmail.count);
          }
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
    redirect({ url, baseUrl }) {
      // NextAuth's OWN default redirect callback does:
      //   if (url.startsWith("/")) return baseUrl + url
      //   else if (new URL(url).origin === baseUrl) return url
      //   else return baseUrl
      // `new URL(url)` THROWS on a malformed string (no scheme, spaces,
      // etc). That callback runs on the raw `callbackUrl` posted straight to
      // the sign-in endpoint — before our own form-level safePath() ever
      // gets a chance to sanitize it — so a malformed callbackUrl crashed
      // the request with "Invalid URL" and dumped the visitor to the
      // generic error page, even with the correct password. Never let a bad
      // value crash the redirect here.
      const relative = safePath(url, "");
      if (relative) return `${baseUrl}${relative}`;

      try {
        if (new URL(url, baseUrl).origin === baseUrl) return url;
      } catch {
        // Malformed callbackUrl — ignore it and fall back below instead of
        // throwing.
      }
      return baseUrl;
    },
  },
});
