"use client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-2"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
