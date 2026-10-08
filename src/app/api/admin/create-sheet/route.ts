import { hasAdminSession } from "@/lib/admin-session";
import { createEventSpreadsheet, deleteEventSpreadsheet } from "@/lib/googleSheets";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!hasAdminSession(request, process.env.ADMIN_API_TOKEN)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("eventId" in body) ||
    typeof body.eventId !== "string" ||
    !uuidPattern.test(body.eventId)
  ) {
    return Response.json({ error: "A valid eventId is required." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data: event, error: lookupError } = await supabase
      .from("events")
      .select("id,title,google_sheet_id")
      .eq("id", body.eventId)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!event) return Response.json({ error: "Event not found." }, { status: 404 });
    if (event.google_sheet_id) {
      return Response.json({ error: "This event already has a spreadsheet." }, { status: 409 });
    }

    const spreadsheetId = await createEventSpreadsheet(event.title);
    const { data: linkedEvent, error: updateError } = await supabase
      .from("events")
      .update({ google_sheet_id: spreadsheetId })
      .eq("id", event.id)
      .is("google_sheet_id", null)
      .select("id")
      .maybeSingle();

    if (updateError || !linkedEvent) {
      await deleteEventSpreadsheet(spreadsheetId).catch(() => undefined);
      if (updateError) throw updateError;
      return Response.json({ error: "A spreadsheet was linked while this request was running." }, { status: 409 });
    }

    return Response.json({
      success: true,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    });
  } catch (error) {
    console.error("Event spreadsheet creation failed:", error);
    return Response.json({ error: "Could not create the event spreadsheet." }, { status: 500 });
  }
}