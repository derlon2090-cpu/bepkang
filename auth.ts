import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { accessCodes, users } from "@/lib/db/schema";

class AccessCodeError extends CredentialsSignin {
  code: "invalid-code" | "expired-code" | "inactive-code" | "code-exhausted" | "unavailable";
  constructor(code: AccessCodeError["code"]) { super(); this.code = code; }
}

function normalizedName(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : fallback.slice(0, 80);
}

function canonicalAccessCode(value: string) {
  return value.trim().toLowerCase().replaceAll("o", "0");
}

function matchesAccessCode(value: string, secret: string) {
  const supplied = Buffer.from(canonicalAccessCode(value)); const expected = Buffer.from(canonicalAccessCode(secret));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [Credentials({
    name: "كود الدخول الخاص",
    credentials: { code: { label: "كود الدخول الخاص", type: "text" } },
    async authorize(credentials) {
      const suppliedCode = typeof credentials?.code === "string" ? credentials.code : "";
      const configuredCode = process.env.ACCESS_CODE;
      const database = getDb();
      if (!database) throw new AccessCodeError("unavailable");
      if (!suppliedCode || !configuredCode || !matchesAccessCode(suppliedCode, configuredCode)) throw new AccessCodeError("invalid-code");
      // From this point onward always use the exact server-side value for DB lookup/provisioning.
      const code = configuredCode.trim();
      return database.transaction(async (tx) => {
        let [accessCode] = await tx.select().from(accessCodes).where(eq(accessCodes.code, code)).for("update").limit(1);
        // The configured production code must work before any optional seed job has run.
        if (!accessCode) {
          await tx.insert(accessCodes).values({ code, label: "كود الدخول الرئيسي", maxUses: 1 }).onConflictDoNothing({ target: accessCodes.code });
          [accessCode] = await tx.select().from(accessCodes).where(eq(accessCodes.code, code)).for("update").limit(1);
        }
        if (!accessCode) throw new AccessCodeError("invalid-code");
        if (!accessCode.isActive) throw new AccessCodeError("inactive-code");
        if (accessCode.expiresAt && accessCode.expiresAt <= new Date()) throw new AccessCodeError("expired-code");
        if (accessCode.maxUses === 1 && accessCode.boundUserId) {
          const [user] = await tx.select().from(users).where(eq(users.id, accessCode.boundUserId)).limit(1);
          if (!user) throw new AccessCodeError("invalid-code");
          return { id: user.id, name: user.name };
        }
        if (accessCode.usedCount >= accessCode.maxUses) throw new AccessCodeError("code-exhausted");
        const [user] = await tx.insert(users).values({ name: normalizedName(undefined, accessCode.label ?? code) }).returning();
        await tx.update(accessCodes).set({ usedCount: sql`${accessCodes.usedCount} + 1`, ...(accessCode.maxUses === 1 ? { boundUserId: user.id } : {}) }).where(eq(accessCodes.id, accessCode.id));
        return { id: user.id, name: user.name };
      });
    },
  })],
  callbacks: {
    jwt({ token, user }) { if (user) { token.id = user.id; token.name = user.name; } return token; },
    session({ session, token }) { if (session.user) { session.user.id = token.id as string; session.user.name = typeof token.name === "string" ? token.name : null; } return session; },
  },
});
