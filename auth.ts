import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { timingSafeEqual } from "node:crypto";

class AccessCodeError extends CredentialsSignin {
  code: "invalid-code" | "expired-code" | "inactive-code" | "code-exhausted" | "unavailable";
  constructor(code: AccessCodeError["code"]) { super(); this.code = code; }
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
      const configuredCode = process.env.ACCESS_CODE?.trim();
      if (!configuredCode) throw new AccessCodeError("unavailable");
      if (!suppliedCode || !matchesAccessCode(suppliedCode, configuredCode)) throw new AccessCodeError("invalid-code");
      // Login must never depend on database migrations or seed state.
      return { id: "00000000-0000-4000-8000-000000000001", name: "الطالب" };
    },
  })],
  callbacks: {
    jwt({ token, user }) { if (user) { token.id = user.id; token.name = user.name; } return token; },
    session({ session, token }) { if (session.user) { session.user.id = token.id as string; session.user.name = typeof token.name === "string" ? token.name : null; } return session; },
  },
});
