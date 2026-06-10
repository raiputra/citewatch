import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";

// Early-access seat cap. Blocks new account creation only — existing users
// always sign in fine. 0 disables.
export function signupCap(): number {
  return parseInt(process.env.SIGNUP_CAP ?? "30", 10);
}

export async function userCount(): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.user);
  return count;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const cap = signupCap();
          if (cap > 0 && (await userCount()) >= cap) {
            throw new APIError("FORBIDDEN", {
              message: "All early-access seats are taken.",
            });
          }
          return { data: user };
        },
      },
    },
  },
  user: {
    additionalFields: {
      company: { type: "string", required: false },
      industry: { type: "string", required: false },
      companySize: { type: "string", required: false },
      credits: { type: "number", required: false, defaultValue: 12, input: false },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
