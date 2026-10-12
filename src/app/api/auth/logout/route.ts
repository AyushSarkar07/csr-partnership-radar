import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.append("set-cookie", `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return res;
}
