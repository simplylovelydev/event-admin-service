import { createSupabaseAdmin } from "@/lib/supabase-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function httpsUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    !isObject(payload) ||
    typeof payload.eventId !== "string" || !uuidPattern.test(payload.eventId) ||
    typeof payload.registrationId !== "string" || !uuidPattern.test(payload.registrationId) ||
    typeof payload.leaderEmail !== "string" || !emailPattern.test(payload.leaderEmail)
  ) {
    return Response.json({ error: "Event, registration, and team-lead email are required." }, { status: 400 });
  }

  const githubUrl = httpsUrl(payload.githubUrl);
  const liveDemoUrl = httpsUrl(payload.liveDemoUrl);
  const videoPitchUrl = httpsUrl(payload.videoPitchUrl);
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
  if (!githubUrl || !liveDemoUrl || !videoPitchUrl || notes.length > 5000) {
    return Response.json({ error: "Enter valid HTTPS links for the repository, demo, and video pitch." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const [{ data: event, error: eventError }, { data: team, error: teamError }] = await Promise.all([
      supabase
        .from("events")
        .select("id,is_active,submissions_open,submission_deadline")
        .eq("id", payload.eventId)
        .maybeSingle(),
      supabase
        .from("team_registrations")
        .select("id,event_id,m1_email")
        .eq("id", payload.registrationId)
        .ilike("m1_email", payload.leaderEmail)
        .maybeSingle(),
    ]);

    if (eventError) throw eventError;
    if (teamError) throw teamError;
    if (!event?.is_active || !team || team.event_id !== event.id) {
      return Response.json({ error: "Could not verify this team for the selected event." }, { status: 404 });
    }
    if (!event.submissions_open) {
      return Response.json({ error: "Submissions are not open for this event." }, { status: 409 });
    }
    if (event.submission_deadline && Date.now() > new Date(event.submission_deadline).getTime()) {
      return Response.json({ error: "The submission deadline has passed." }, { status: 409 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("submissions")
      .select("id")
      .eq("team_registration_id", team.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return Response.json({ error: "This team has already submitted." }, { status: 409 });

    const { data: submission, error: insertError } = await supabase
      .from("submissions")
      .insert({
        event_id: event.id,
        team_registration_id: team.id,
        github_url: githubUrl,
        live_demo_url: liveDemoUrl,
        video_pitch_url: videoPitchUrl,
        submission_notes: notes || null,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;
    return Response.json({ submissionId: submission.id }, { status: 201 });
  } catch (error) {
    console.error("Could not save submission:", error);
    return Response.json({ error: "Could not save your submission." }, { status: 503 });
  }
}