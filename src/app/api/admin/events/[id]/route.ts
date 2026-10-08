import { hasAdminSession } from "@/lib/admin-session";
import { toClubEvent, type EventRow } from "@/lib/event-format";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const editableFields = ["is_active", "registration_open", "submissions_open", "is_featured"] as const;

export async function PATCH(request: Request, context: RouteContext<"/api/admin/events/[id]">) {
  if (!hasAdminSession(request, process.env.ADMIN_API_TOKEN)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return Response.json({ error: "Invalid event ID." }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Invalid event changes." }, { status: 400 });
  }

  const bodyRecord = body as Record<string, unknown>;
  const updates: Record<string, boolean> = {};
  for (const field of editableFields) {
    if (field in bodyRecord) {
      const value = bodyRecord[field];
      if (typeof value !== "boolean") {
        return Response.json({ error: `${field} must be true or false.` }, { status: 400 });
      }
      updates[field] = value;
    }
  }
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No supported event changes were provided." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("events")
      .update(updates)
      .eq("id", id)
      .select("id,title,category,description,short_description,starts_at,ends_at,venue,image_url,image_position,is_featured,is_active,registration_open,registration_limit,submissions_open,submission_deadline,max_team_size,submission_rules,google_sheet_id,created_at")
      .maybeSingle();

    if (error) throw error;
    if (!data) return Response.json({ error: "Event not found." }, { status: 404 });
    return Response.json({ event: toClubEvent(data as EventRow) });
  } catch (error) {
    console.error("Could not update event:", error);
    return Response.json({ error: "Could not update event." }, { status: 503 });
  }
}