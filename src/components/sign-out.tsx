"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function SignOut() {
  const router = useRouter();
  return (
    <button
      className="text-sm font-medium opacity-75 hover:opacity-100 transition-opacity cursor-pointer"
      onClick={async () => {
        await signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
