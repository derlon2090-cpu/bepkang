import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [Credentials({
    name: "كود الدخول الخاص",
    credentials: { code: { label: "كود الدخول الخاص", type: "text" } },
    async authorize(credentials) {
      const code = typeof credentials?.code === "string" ? credentials.code.trim().toUpperCase() : "";
      const database = getDb();
      if (!database) throw new AccessCodeError("unavailable");
      if (!code) throw new AccessCodeError("invalid-code");
      return database.transaction(async (tx) => {
        const [accessCode] = await tx.select().from(accessCodes).where(eq(accessCodes.code, code)).for("update").limit(1);
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
