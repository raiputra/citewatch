import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/* ─── Better Auth tables ─────────────────────────── */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Onboarding profile — required before the app unlocks
  company: text("company"),
  industry: text("industry"),
  companySize: text("company_size"),
  // Free usage credits; BYOK runs don't consume them
  credits: integer("credits").notNull().default(12),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ─── App tables ─────────────────────────────────── */

export type Source = { url: string; title?: string };

export const prompt = pgTable(
  "prompt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    language: text("language").notNull().default("en"),
    country: text("country").notNull().default("US"),
    brandName: text("brand_name").notNull(),
    brandDomain: text("brand_domain").notNull(),
    engines: jsonb("engines").$type<string[]>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("prompt_user_idx").on(t.userId)],
);

export const run = pgTable(
  "run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompt.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // One id per "Run check" click — groups the engine fan-out into a batch.
    // Nullable for rows created before batching existed.
    batchId: uuid("batch_id"),
    engine: text("engine").notNull(),
    model: text("model"),
    status: text("status").notNull().default("done"), // done | error
    responseText: text("response_text"),
    sources: jsonb("sources").$type<Source[]>(),
    cited: boolean("cited").notNull().default(false),
    mentioned: boolean("mentioned").notNull().default(false),
    usedOwnKey: boolean("used_own_key").notNull().default(false),
    error: text("error"),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("run_prompt_idx").on(t.promptId),
    index("run_user_idx").on(t.userId),
  ],
);

// "Need more credits?" requests — demand signal + agency leads. Joins to
// user for company/industry/size, so the form doesn't re-ask.
export const creditRequest = pgTable(
  "credit_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    monthlyCredits: text("monthly_credits").notNull(),
    topEngines: jsonb("top_engines").$type<string[]>().notNull().default([]),
    suggestions: text("suggestions"),
    servicesInterest: boolean("services_interest").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("credit_request_user_idx").on(t.userId)],
);

export const apiKey = pgTable(
  "api_key",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // openai | anthropic | google | xai | perplexity
    encryptedKey: text("encrypted_key").notNull(),
    last4: text("last4").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("api_key_user_provider_idx").on(t.userId, t.provider)],
);
