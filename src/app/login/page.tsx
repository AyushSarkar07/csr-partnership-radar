import { LoginForm } from "@/components/LoginForm";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const s = await getSession();
  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="font-serif text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-ink-2">Reading is open. Recording decisions, changing settings, refreshing sources and generating digests need the access code.</p>
      {!s.authConfigured ? (
        <p className="mt-4 rounded-md bg-monitor-bg p-3 text-sm text-monitor">Sign-in is not configured on this deployment (ACCESS_CODE / SESSION_SECRET missing), so all write operations are disabled.</p>
      ) : s.signedIn ? (
        <p className="mt-4 text-sm text-high">You are signed in.</p>
      ) : (
        <LoginForm />
      )}
    </div>
  );
}
