import Link from "next/link";
import { requireOnboardedUser } from "@/lib/session";
import { SignOut } from "@/components/sign-out";
import { CreditsModal } from "@/components/credits-modal";
import { Footer } from "@/components/footer";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireOnboardedUser();

  return (
    <div className="flex-1 flex flex-col">
      <nav className="border-b border-line bg-bg sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-7 md:px-12 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-9">
            <Link href="/dashboard" className="font-serif text-lg tracking-tight">
              Citewatch
            </Link>
            <div className="hidden sm:flex items-center gap-7">
              <Link
                href="/dashboard"
                className="text-sm font-medium opacity-75 hover:opacity-100 transition-opacity"
              >
                Dashboard
              </Link>
              <Link
                href="/prompts/new"
                className="text-sm font-medium opacity-75 hover:opacity-100 transition-opacity"
              >
                New prompt
              </Link>
              <Link
                href="/settings"
                className="text-sm font-medium opacity-75 hover:opacity-100 transition-opacity"
              >
                Settings
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <CreditsModal />
            <span className="tag" title="Credits remaining. BYOK runs are free.">
              {user.credits} credits
            </span>
            <SignOut />
          </div>
        </div>
      </nav>
      <main className="flex-1">
        <div className="max-w-[1200px] mx-auto px-7 md:px-12 py-12">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
