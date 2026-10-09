import { hasAdminSession } from "@/lib/admin-session";
import { adminEventSelect, eventSelect, toClubEvent, type EventRow } from "@/lib/event-format";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const categories = new Set(["Hackathon", "Workshop", "Meetup", "Community"]);

function authorized(request: Request) {
  return hasAdminSession(request, process.env.ADMIN_API_TOKEN);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDate(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const supabase = createSupabaseAdmin();
    const [{ data: rows, error }, { data: registrations, error: registrationError }] = await Promise.all([
      supabase.from("events").select(adminEventSelect).order("created_at", { ascending: false }),
      supabase.from("team_registrations").select("event_id"),
    ]);
    if (error) throw error;
    if (registrationError) throw registrationError;

    const counts = new Map<string, number>();
    for (const registration of registrations ?? []) {
      counts.set(registration.event_id, (counts.get(registration.event_id) ?? 0) + 1);
    }

    const events = (rows as EventRow[]).map((row) => ({
      ...toClubEvent(row, counts.get(row.id) ?? 0),
      sheetUrl: row.google_sheet_id
        ? `https://docs.google.com/spreadsheets/d/${row.google_sheet_id}/edit`
        : null,
      registrationCount: counts.get(row.id) ?? 0,
    }));
    return Response.json({ events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load admin events:", error);
    return Response.json({ error: "Could not load events." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!isObject(body)) return Response.json({ error: "Invalid event data." }, { status: 400 });

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const category = typeof body.category === "string" ? body.category : "";
  const startsAt = parseDate(body.startsAt);
  const endsAt = parseDate(body.endsAt);
  const submissionDeadline = parseDate(body.submissionDeadline);
  const teamSize = body.maxTeamSize === undefined ? 6 : body.maxTeamSize;
  const registrationLimit = body.registrationLimit === undefined || body.registrationLimit === ""
    ? null
    : body.registrationLimit;
  const imageUrl = body.imageUrl === undefined || body.imageUrl === "" ? null : body.imageUrl;

  if (title.length < 2 || title.length > 120 || !categories.has(category)) {
    return Response.json({ error: "Enter an event title and a supported category." }, { status: 400 });
  }
  if (startsAt === undefined || endsAt === undefined || (startsAt && endsAt && endsAt < startsAt)) {
    return Response.json({ error: "Enter valid event dates and times." }, { status: 400 });
  }
  if (submissionDeadline === undefined) {
    return Response.json({ error: "Enter a valid submission deadline." }, { status: 400 });
  }
  if (typeof teamSize !== "number" || !Number.isInteger(teamSize) || teamSize < 1 || teamSize > 6) {
    return Response.json({ error: "Maximum team size must be between 1 and 6." }, { status: 400 });
  }
  if (registrationLimit !== null && (
    typeof registrationLimit !== "number" || !Number.isInteger(registrationLimit) || registrationLimit < 1
  )) {
    return Response.json({ error: "Registration limit must be a positive whole number." }, { status: 400 });
  }
  if (imageUrl !== null && (typeof imageUrl !== "string" || !imageUrl.startsWith("https://") || imageUrl.length > 2048)) {
    return Response.json({ error: "Event image must be an HTTPS URL." }, { status: 400 });
  }
  if (body.submissionRules !== undefined && (
    !Array.isArray(body.submissionRules) ||
    body.submissionRules.length > 20 ||
    body.submissionRules.some((rule) => typeof rule !== "string" || rule.trim().length > 500)
  )) {
    return Response.json({ error: "Submission rules must be a list of short text items." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data: row, error } = await supabase
      .from("events")
      .insert({
        title,
        category,
        description: typeof body.description === "string" ? body.description.trim().slice(0, 5000) : null,
        short_description: typeof body.shortDescription === "string" ? body.shortDescription.trim().slice(0, 240) : null,
        starts_at: startsAt,
        ends_at: endsAt,
        venue: typeof body.venue === "string" ? body.venue.trim().slice(0, 240) || null : null,
        image_url: imageUrl,
        image_position: typeof body.imagePosition === "string" ? body.imagePosition.slice(0, 80) : null,
        is_featured: body.isFeatured === true,
        is_active: true,
        registration_open: body.registrationOpen !== false,
        registration_limit: registrationLimit,
        max_team_size: teamSize,
        submissions_open: body.submissionsOpen === true,
        submission_deadline: submissionDeadline,
        submission_rules: body.submissionRules ?? [],
      })
      .select(eventSelect)
      .single();
    if (error) throw error;
    return Response.json({ event: toClubEvent(row as EventRow) }, { status: 201 });
  } catch (error) {
    console.error("Could not create event:", error);
    return Response.json({ error: "Could not create event." }, { status: 503 });
  }
}