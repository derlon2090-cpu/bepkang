import { sql } from "drizzle-orm";
import { getDb } from ".";
import { seedDatabase } from "./seed";

/** Additive recovery migration for a database that predates this project schema. */
export async function bootstrapDatabase() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL غير مضبوط.");
  const statements = [
    "CREATE EXTENSION IF NOT EXISTS pgcrypto",
    `CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(80), grade_bracket varchar(16), created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS access_codes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(64) NOT NULL UNIQUE, label varchar(160), max_uses integer NOT NULL DEFAULT 1, used_count integer NOT NULL DEFAULT 0, bound_user_id uuid REFERENCES users(id) ON DELETE SET NULL, is_active boolean NOT NULL DEFAULT true, expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS questions (id uuid PRIMARY KEY DEFAULT gen_random_uuid())`,
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_id varchar",
    "ALTER TABLE questions ALTER COLUMN source_id DROP NOT NULL",
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS competition text",
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS age_group text",
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS category text",
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS prompt text",
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS answer text",
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url text",
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS embedding jsonb",
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()",
    `CREATE TABLE IF NOT EXISTS user_attempts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE, is_correct integer NOT NULL, elapsed_seconds integer, submitted_answer text, created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS skill_mastery (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, category text NOT NULL, attempts_count integer NOT NULL DEFAULT 0, correct_count integer NOT NULL DEFAULT 0, mastery_score real NOT NULL DEFAULT 0, last_practiced_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE UNIQUE INDEX IF NOT EXISTS skill_mastery_user_category_idx ON skill_mastery(user_id, category)`,
    `CREATE TABLE IF NOT EXISTS solved_puzzles_cache (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), image_hash varchar(64) NOT NULL UNIQUE, competition text NOT NULL, age_group text, category text NOT NULL, natural_width integer NOT NULL, natural_height integer NOT NULL, solution_json jsonb NOT NULL, hit_count integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now())`,
    "CREATE TABLE IF NOT EXISTS reference_examples (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), competition text NOT NULL, category text NOT NULL, puzzle_pattern_description text NOT NULL, solving_strategy text NOT NULL, image_url text, thumbnail_base64 text, verified_steps_json jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())",
    "ALTER TABLE reference_examples ADD COLUMN IF NOT EXISTS archetype varchar(64)",
    "ALTER TABLE reference_examples ADD COLUMN IF NOT EXISTS structural_signature text",
    "ALTER TABLE reference_examples ADD COLUMN IF NOT EXISTS trap_warning text",
    "ALTER TABLE reference_examples ADD COLUMN IF NOT EXISTS image_hash varchar(64)",
    "ALTER TABLE reference_examples ADD COLUMN IF NOT EXISTS embedding jsonb",
    "ALTER TABLE reference_examples ADD COLUMN IF NOT EXISTS source_type varchar(32) NOT NULL DEFAULT 'OWNER_VERIFIED'",
    "DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'embedding' AND udt_name = 'vector') THEN ALTER TABLE questions ALTER COLUMN embedding TYPE jsonb USING embedding::text::jsonb; END IF; END $$",
    "DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reference_examples' AND column_name = 'embedding' AND udt_name = 'vector') THEN ALTER TABLE reference_examples ALTER COLUMN embedding TYPE jsonb USING embedding::text::jsonb; END IF; END $$",
    "CREATE UNIQUE INDEX IF NOT EXISTS reference_examples_image_hash_idx ON reference_examples(image_hash)",
  ];
  for (const statement of statements) await db.execute(sql.raw(statement));
  await seedDatabase();
}
