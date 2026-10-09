import { createTeamSessionCookie } from "@/lib/team-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usnPattern = /^[a-z0-9-]{4,64}$/i;
const attempts = new Map<string, { count: number; resetAt: number }>();
const attemptLimit = 6;
const windowMs = 15 * 60 * 1000;

function isRateLimited(request: Request) {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (entry.resetAt <= now) attempts.delete(key);
  }

  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count += 1;
  return entry.count > attemptLimit;
}

function invalidCredentials() {
  return Response.json({ error: "We couldn't find a team with those details." }, { status: 404 });
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return Response.json({ error: "Too many attempts. Please try again in 15 minutes." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("eventId" in body) || !("leaderEmail" in body) || !("leaderUsn" in body)) {
    return Response.json({ error: "Enter your event, team-lead email, and USN." }, { status: 400 });
  }

  const { eventId, leaderEmail, leaderUsn } = body;
  if (
    typeof eventId !== "string" || !uuidPattern.test(eventId) ||
    typeof leaderEmail !== "string" || !emailPattern.test(leaderEmail.trim()) ||
    typeof leaderUsn !== "string" || !usnPattern.test(leaderUsn.trim())
  ) {
    return invalidCredentials();
  }

  const sessionSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sessionSecret) return Response.json({ error: "Team lookup is not configured." }, { status: 503 });

  try {
    const supabase = createSupabaseAdmin();
    const { data: registration, error } = await supabase
      .from("team_registrations")
      .select("id")
      .eq("event_id", eventId)
      .ilike("m1_email", leaderEmail.trim())
      .ilike("m1_usn", leaderUsn.trim())
      .maybeSingle();

    if (error) throw error;
    if (!registration) return invalidCredentials();

    return Response.json(
      { found: true },
      {
        headers: {
          "Set-Cookie": createTeamSessionCookie(registration.id, sessionSecret),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Could not recover team session:", error);
    return Response.json({ error: "Could not look up your team right now." }, { status: 503 });
  }
}