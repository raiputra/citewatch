import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, user as userTable } from "@/db";

export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const [u] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, session.user.id));
  return u ?? null;
}

/** Redirects to sign-in when unauthenticated, to onboarding when profile is incomplete. */
export async function requireOnboardedUser() {
  const u = await getSessionUser();
  if (!u) redirect("/");
  if (!u.company || !u.industry || !u.companySize) redirect("/onboarding");
  return u;
}

export async function requireUser() {
  const u = await getSessionUser();
  if (!u) redirect("/");
  return u;
}
