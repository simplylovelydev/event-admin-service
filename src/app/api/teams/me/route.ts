import { expiredTeamSessionCookie, getTeamSessionId } from "@/lib/team-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const registrationId = getTeamSessionId(request, process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!registrationId) {
    return Response.json({ team: null }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data: row, error } = await supabase
      .from("team_registrations")
      .select("id,event_id,team_name,m1_name,m1_email,m1_phone,m1_usn,m2_name,m2_email,m2_phone,m2_usn,m3_name,m3_email,m3_phone,m3_usn,m4_name,m4_email,m4_phone,m4_usn,m5_name,m5_email,m5_phone,m5_usn,m6_name,m6_email,m6_phone,m6_usn,created_at,events(id,title,category,starts_at,venue),submissions(id,github_url,live_demo_url,video_pitch_url,submission_notes,created_at)")
      .eq("id", registrationId)
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      return Response.json(
        { team: null },
        { headers: { "Cache-Control": "no-store", "Set-Cookie": expiredTeamSessionCookie() } },
      );
    }

    const members = Array.from({ length: 6 }, (_, index) => {
      const memberIndex = index + 1;
      const name = row[`m${memberIndex}_name` as keyof typeof row];
      if (typeof name !== "string" || !name) return null;
      return {
        name,
        email: row[`m${memberIndex}_email` as keyof typeof row],
        phone: row[`m${memberIndex}_phone` as keyof typeof row],
        usn: row[`m${memberIndex}_usn` as keyof typeof row],
      };
    }).filter(Boolean);

    const eventRelation = row.events;
    const event = Array.isArray(eventRelation) ? eventRelation[0] : eventRelation;
    const submissionRelation = row.submissions;
    const submission = Array.isArray(submissionRelation) ? submissionRelation[0] : submissionRelation;

    return Response.json({
      team: {
        id: row.id,
        eventId: row.event_id,
        teamName: row.team_name,
        leaderEmail: row.m1_email,
        members,
        createdAt: row.created_at,
        event: event ?? null,
        submission: submission ?? null,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load team dashboard:", error);
    return Response.json({ error: "Could not load the team dashboard." }, { status: 503 });
  }
}

export async function DELETE() {
  return Response.json(
    { team: null },
    { headers: { "Set-Cookie": expiredTeamSessionCookie(), "Cache-Control": "no-store" } },
  );
}