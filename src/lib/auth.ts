/**
 * Dead-simple single-user auth. Credentials come only from env vars (AUTH_USER / AUTH_PASSWORD),
 * e.g. set in Coolify or in a local .env.local. If they're missing, nobody can log in.
 */
export const AUTH_COOKIE = "cp_session";

/** Read env at runtime. Dynamic keys stop Next from inlining build-time values into the middleware bundle. */
function env(name: string): string | undefined {
  return process.env[name];
}

export function credentials(): { user: string; password: string } | null {
  const user = env("AUTH_USER");
  const password = env("AUTH_PASSWORD");
  return user && password ? { user, password } : null;
}

/** Token derived from the credentials, so changing the password logs everyone out. Works in Edge + Node. */
export async function sessionToken(): Promise<string | null> {
  const c = credentials();
  if (!c) return null;
  const data = new TextEncoder().encode(`cp-training:${c.user}:${c.password}:${env("AUTH_SECRET") || ""}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
