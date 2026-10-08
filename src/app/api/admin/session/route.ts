import {
  adminSessionCookie,
  expiredAdminSessionCookie,
  hasAdminSession,
  verifyAdminPassword,
} from "@/lib/admin-session";

function unavailable() {
  return Response.json({ error: "Admin authentication is not configured." }, { status: 503 });
}

export async function GET(request: Request) {
  const secret = process.env.ADMIN_API_TOKEN;
  if (!secret) return unavailable();
  return Response.json({ authenticated: hasAdminSession(request, secret) });
}

export async function POST(request: Request) {
  const secret = process.env.ADMIN_API_TOKEN;
  if (!secret) return unavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const password = typeof body === "object" && body !== null && "password" in body
    ? body.password
    : undefined;
  if (!verifyAdminPassword(password, secret)) {
    return Response.json({ error: "Incorrect admin password." }, { status: 401 });
  }

  return Response.json(
    { authenticated: true },
    { headers: { "Set-Cookie": adminSessionCookie(secret), "Cache-Control": "no-store" } },
  );
}

export async function DELETE() {
  return Response.json(
    { authenticated: false },
    { headers: { "Set-Cookie": expiredAdminSessionCookie(), "Cache-Control": "no-store" } },
  );
}