/**
 * Small in-memory fixed-window rate limiter for Server Actions (sign-up, sign-in, password
 * reset), which bypass Better Auth's HTTP rate limiting. Fine for the single pm2 process on
 * the VPS. Running several instances would need a shared store.
 */
import "server-only";
import { headers } from "next/headers";

const windows = new Map<string, { count: number; resetAt: number }>();

export function hit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    if (windows.size > 10_000) {
      for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** True if the action may proceed for this client IP. */
export async function allowAction(action: string, limit: number, windowMs: number): Promise<boolean> {
  return hit(`${action}:${await clientIp()}`, limit, windowMs);
}
