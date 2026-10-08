import { eventSelect, toClubEvent, type EventRow } from "@/lib/event-format";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/events/[id]">,
) {
  const { id } = await context.params;

  try {
    const supabase = createSupabaseAdmin();
    const [{ data: event, error }, { count, error: registrationError }] = await Promise.all([
      supabase
        .from("events")
        .select(eventSelect)
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("team_registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", id),
    ]);

    if (error) throw error;
    if (registrationError) throw registrationError;
    if (!event) return Response.json({ error: "Event not found." }, { status: 404 });

    return Response.json(
      { event: toClubEvent(event as EventRow, count ?? 0) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not load event:", error);
    return Response.json({ error: "Could not load event." }, { status: 503 });
  }
}