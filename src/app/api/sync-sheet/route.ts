import { hasBearerToken } from "@/lib/api-auth";
import { appendSheetRecordOnce } from "@/lib/googleSheets";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  if (!hasBearerToken(request, process.env.SUPABASE_WEBHOOK_SECRET)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isObject(payload)) {
    return Response.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
  if (payload.type !== "INSERT") return Response.json({ status: "ignored" });
  if (payload.table !== "team_registrations" && payload.table !== "submissions") {
    return Response.json({ status: "ignored" });
  }

  const record = payload.record;
  if (
    !isObject(record) ||
    typeof record.id !== "string" ||
    !uuidPattern.test(record.id) ||
    typeof record.event_id !== "string" ||
    !uuidPattern.test(record.event_id)
  ) {
    return Response.json({ error: "Webhook record is missing valid IDs." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("google_sheet_id")
      .eq("id", record.event_id)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!event?.google_sheet_id) {
      return Response.json({ error: "No spreadsheet is linked to this event." }, { status: 409 });
    }

    if (payload.table === "team_registrations") {
      const row = [
        text(record.team_name),
        ...Array.from({ length: 6 }, (_, index) => {
          const member = index + 1;
          return [
            text(record[`m${member}_name`]),
            text(record[`m${member}_email`]),
            text(record[`m${member}_phone`]),
            text(record[`m${member}_usn`]),
          ];
        }).flat(),
        text(record.created_at),
        record.id,
      ];

      const appended = await appendSheetRecordOnce({
        spreadsheetId: event.google_sheet_id,
        tabName: "Registrations",
        recordIdRange: "Registrations!AA2:AA",
        recordId: record.id,
        row,
      });

      return Response.json({ success: true, duplicate: !appended });
    }

    if (
      typeof record.team_registration_id !== "string" ||
      !uuidPattern.test(record.team_registration_id)
    ) {
      return Response.json({ error: "Submission is missing a valid team registration." }, { status: 400 });
    }

    const { data: team, error: teamError } = await supabase
      .from("team_registrations")
      .select("team_name")
      .eq("id", record.team_registration_id)
      .eq("event_id", record.event_id)
      .maybeSingle();

    if (teamError) throw teamError;
    if (!team) return Response.json({ error: "Submission team was not found." }, { status: 404 });

    const appended = await appendSheetRecordOnce({
      spreadsheetId: event.google_sheet_id,
      tabName: "Submissions",
      recordIdRange: "Submissions!G2:G",
      recordId: record.id,
      row: [
        text(team.team_name),
        text(record.github_url),
        text(record.live_demo_url),
        text(record.video_pitch_url),
        text(record.submission_notes),
        text(record.created_at),
        record.id,
      ],
    });

    return Response.json({ success: true, duplicate: !appended });
  } catch (error) {
    console.error("Spreadsheet webhook sync failed:", error);
    return Response.json({ error: "Could not sync this record to Google Sheets." }, { status: 500 });
  }
}