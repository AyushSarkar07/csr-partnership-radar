import { cookies } from "next/headers";
import { authConfigured, SESSION_COOKIE, verifySessionToken } from "./auth";

export async function getSession() {
  const jar = await cookies();
  return { signedIn: verifySessionToken(jar.get(SESSION_COOKIE)?.value), authConfigured: authConfigured() };
}
