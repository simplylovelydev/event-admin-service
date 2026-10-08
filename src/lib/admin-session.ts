import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "techclub_admin_session";
const sessionDurationSeconds = 60 * 60 * 12;

function signature(expiresAt: string, secret: string) {
  return createHmac("sha256", secret).update(expiresAt).digest("hex");
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyAdminPassword(candidate: unknown, secret: string) {
  return typeof candidate === "string" && secureEquals(candidate, secret);
}

export function hasAdminSession(request: Request, secret?: string) {
  if (!secret) return false;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);

  if (!value) return false;
  const [expiresAt, providedSignature] = value.split(".");
  if (!expiresAt || !providedSignature || Number(expiresAt) <= Date.now()) return false;
  return secureEquals(providedSignature, signature(expiresAt, secret));
}

export function adminSessionCookie(secret: string) {
  const expiresAt = String(Date.now() + sessionDurationSeconds * 1000);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${cookieName}=${expiresAt}.${signature(expiresAt, secret)}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${sessionDurationSeconds}${secure}`;
}

export function expiredAdminSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0${secure}`;
}