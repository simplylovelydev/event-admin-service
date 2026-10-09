import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "techclub_team_session";
const sessionDurationSeconds = 60 * 60 * 24 * 365;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createTeamSessionCookie(registrationId: string, secret: string) {
  const expiresAt = String(Date.now() + sessionDurationSeconds * 1000);
  const payload = `${registrationId}.${expiresAt}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${cookieName}=${payload}.${sign(payload, secret)}; HttpOnly; SameSite=Lax; Path=/api/teams; Max-Age=${sessionDurationSeconds}${secure}`;
}

export function getTeamSessionId(request: Request, secret?: string) {
  if (!secret) return null;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);

  if (!value) return null;
  const [registrationId, expiresAt, providedSignature] = value.split(".");
  if (!registrationId || !uuidPattern.test(registrationId) || !expiresAt || !providedSignature) return null;
  if (!Number.isFinite(Number(expiresAt)) || Number(expiresAt) <= Date.now()) return null;

  const payload = `${registrationId}.${expiresAt}`;
  return secureEquals(providedSignature, sign(payload, secret)) ? registrationId : null;
}

export function expiredTeamSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${cookieName}=; HttpOnly; SameSite=Lax; Path=/api/teams; Max-Age=0${secure}`;
}