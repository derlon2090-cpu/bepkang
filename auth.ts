import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";

const db = getDb();
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: db ? DrizzleAdapter(db, { usersTable: users, accountsTable: accounts, sessionsTable: sessions, verificationTokensTable: verificationTokens }) : undefined,
  session: { strategy: db ? "database" : "jwt" },
  providers: [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })] : []),
    Credentials({ name: "البريد الإلكتروني", credentials: { email: { label: "البريد الإلكتروني", type: "email" }, password: { label: "كلمة المرور", type: "password" } }, async authorize(credentials) {
      const email = typeof credentials?.email === "string" ? credentials.email.toLowerCase() : "";
      const password = typeof credentials?.password === "string" ? credentials.password : "";
      const database = getDb(); if (!database || !email || !password) return null;
      const [user] = await database.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user?.passwordHash || !await compare(password, user.passwordHash)) return null;
      return { id: user.id, email: user.email, name: user.name ?? user.displayName, image: user.image };
    } }),
  ],
});
