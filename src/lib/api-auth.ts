import "server-only";

import { timingSafeEqual } from "node:crypto";

export function hasBearerToken(request: Request, expectedToken?: string) {
  if (!expectedToken) return false;

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const providedToken = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(expectedToken);

  return providedToken.length === expected.length && timingSafeEqual(providedToken, expected);
}