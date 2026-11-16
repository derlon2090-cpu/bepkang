import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid, varchar, vector } from "drizzle-orm/pg-core";

export const AGE_GROUPS = ["G3_4", "G5_6", "G7_8", "G9_10", "G11_12"] as const;
export type AgeGroup = typeof AGE_GROUPS[number];

/** Persistent learner data. Access codes deliberately do not require an email address. */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 80 }),
  gradeBracket: varchar("grade_bracket", { length: 16 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accessCodes = pgTable("access_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  label: varchar("label", { length: 160 }),
  maxUses: integer("max_uses").default(1).notNull(),
  usedCount: integer("used_count").default(0).notNull(),
  boundUserId: uuid("bound_user_id").references(() => users.id, { onDelete: "set null" }),
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("access_codes_active_idx").on(table.isActive)]);

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(), competition: text("competition", { enum: ["BEBRAS", "KANGAROO"] }).notNull(), ageGroup: text("age_group", { enum: AGE_GROUPS }).notNull(), category: text("category").notNull(), prompt: text("prompt").notNull(), answer: text("answer"), imageUrl: text("image_url"), embedding: vector("embedding", { dimensions: 768 }), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("questions_category_idx").on(table.category), uniqueIndex("questions_competition_prompt_idx").on(table.competition, table.prompt)]);

export const userAttempts = pgTable("user_attempts", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(), questionId: uuid("question_id").references(() => questions.id, { onDelete: "cascade" }).notNull(), isCorrect: integer("is_correct").notNull(), elapsedSeconds: integer("elapsed_seconds"), submittedAnswer: text("submitted_answer"), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const skillMastery = pgTable("skill_mastery", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(), category: text("category").notNull(), attemptsCount: integer("attempts_count").default(0).notNull(), correctCount: integer("correct_count").default(0).notNull(), masteryScore: real("mastery_score").default(0).notNull(), lastPracticedAt: timestamp("last_practiced_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("skill_mastery_user_category_idx").on(table.userId, table.category)]);

export const solvedPuzzlesCache = pgTable("solved_puzzles_cache", {
  id: uuid("id").defaultRandom().primaryKey(), imageHash: varchar("image_hash", { length: 64 }).notNull().unique(), competition: text("competition", { enum: ["BEBRAS", "KANGAROO"] }).notNull(), ageGroup: text("age_group", { enum: AGE_GROUPS }), category: text("category").notNull(), naturalWidth: integer("natural_width").notNull(), naturalHeight: integer("natural_height").notNull(), solutionJson: jsonb("solution_json").$type<VisualSolutionRecord>().notNull(), hitCount: integer("hit_count").default(1).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("solved_puzzles_cache_hash_idx").on(table.imageHash)]);

/** Owner-verified examples used as domain-specific few-shot guidance for Gemini. */
export const referenceExamples = pgTable("reference_examples", {
  id: uuid("id").defaultRandom().primaryKey(),
  competition: text("competition", { enum: ["BEBRAS", "KANGAROO"] }).notNull(),
  category: text("category").notNull(),
  puzzlePatternDescription: text("puzzle_pattern_description").notNull(),
  solvingStrategy: text("solving_strategy").notNull(),
  imageUrl: text("image_url"),
  thumbnailBase64: text("thumbnail_base64"),
  verifiedStepsJson: jsonb("verified_steps_json").$type<VisualSolutionRecord>().notNull(),
  archetype: varchar("archetype", { length: 64 }),
  structuralSignature: text("structural_signature"),
  trapWarning: text("trap_warning"),
  imageHash: varchar("image_hash", { length: 64 }).unique(),
  embedding: vector("embedding", { dimensions: 768 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("reference_examples_competition_idx").on(table.competition),
  index("reference_examples_category_idx").on(table.category),
]);

export type VisualSolutionRecord = { steps: unknown; socraticHints: string[]; metadata?: Record<string, unknown> };
