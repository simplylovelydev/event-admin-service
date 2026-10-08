import { eventSelect, toClubEvent, type EventRow } from "@/lib/event-format";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const supabase = createSupabaseAdmin();
    const [{ data: rows, error }, { data: registrations, error: registrationError }] = await Promise.all([
      supabase
        .from("events")
        .select(eventSelect)
        .eq("is_active", true)
        .order("starts_at", { ascending: true, nullsFirst: false }),
      supabase.from("team_registrations").select("event_id"),
    ]);

    if (error) throw error;
    if (registrationError) throw registrationError;

    const counts = new Map<string, number>();
    for (const registration of registrations ?? []) {
      counts.set(registration.event_id, (counts.get(registration.event_id) ?? 0) + 1);
    }

    return Response.json(
      { events: (rows as EventRow[]).map((event) => toClubEvent(event, counts.get(event.id) ?? 0)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not load events:", error);
    return Response.json({ error: "Could not load events." }, { status: 503 });
  }
}