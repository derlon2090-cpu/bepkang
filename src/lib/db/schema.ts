import { index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid, varchar, vector } from "drizzle-orm/pg-core";

export const AGE_GROUPS = ["G3_4", "G5_6", "G7_8", "G9_10", "G11_12"] as const;
export type AgeGroup = typeof AGE_GROUPS[number];

/** Persistent learner data. Keep identifiers opaque so an auth provider can be added later. */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  displayName: text("display_name"),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), provider: text("provider").notNull(), providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"), access_token: text("access_token"), expires_at: integer("expires_at"), token_type: text("token_type"), scope: text("scope"), id_token: text("id_token"), session_state: text("session_state"),
}, (table) => [uniqueIndex("accounts_provider_account_idx").on(table.provider, table.providerAccountId)]);
export const sessions = pgTable("sessions", { sessionToken: text("session_token").primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), expires: timestamp("expires", { withTimezone: true }).notNull() });
export const verificationTokens = pgTable("verification_tokens", { identifier: text("identifier").notNull(), token: text("token").notNull(), expires: timestamp("expires", { withTimezone: true }).notNull() }, (table) => [uniqueIndex("verification_token_idx").on(table.identifier, table.token)]);

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  competition: text("competition", { enum: ["BEBRAS", "KANGAROO"] }).notNull(),
  ageGroup: text("age_group", { enum: AGE_GROUPS }).notNull(),
  category: text("category").notNull(),
  prompt: text("prompt").notNull(),
  answer: text("answer"),
  imageUrl: text("image_url"),
  embedding: vector("embedding", { dimensions: 768 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("questions_category_idx").on(table.category)]);

export const userAttempts = pgTable("user_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  questionId: uuid("question_id").references(() => questions.id, { onDelete: "cascade" }).notNull(),
  isCorrect: integer("is_correct").notNull(),
  elapsedSeconds: integer("elapsed_seconds"),
  submittedAnswer: text("submitted_answer"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const skillMastery = pgTable("skill_mastery", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  category: text("category").notNull(),
  attemptsCount: integer("attempts_count").default(0).notNull(),
  correctCount: integer("correct_count").default(0).notNull(),
  masteryScore: real("mastery_score").default(0).notNull(),
  lastPracticedAt: timestamp("last_practiced_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("skill_mastery_user_category_idx").on(table.userId, table.category)]);

/** Gemini output for a normalized image. The hash makes repeated uploads effectively free. */
export const solvedPuzzlesCache = pgTable("solved_puzzles_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  imageHash: varchar("image_hash", { length: 64 }).notNull().unique(),
  competition: text("competition", { enum: ["BEBRAS", "KANGAROO"] }).notNull(),
  ageGroup: text("age_group", { enum: AGE_GROUPS }),
  category: text("category").notNull(),
  naturalWidth: integer("natural_width").notNull(),
  naturalHeight: integer("natural_height").notNull(),
  solutionJson: jsonb("solution_json").$type<VisualSolutionRecord>().notNull(),
  hitCount: integer("hit_count").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("solved_puzzles_cache_hash_idx").on(table.imageHash)]);

export type VisualSolutionRecord = { steps: unknown; socraticHints: string[]; metadata?: Record<string, unknown> };
