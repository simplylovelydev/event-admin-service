import { Suspense } from "react";
import { notFound } from "next/navigation";
import EventDetail from "@/components/event-detail";
import { eventSelect, toClubEvent, type EventRow } from "@/lib/event-format";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return <Suspense fallback={<main className="detail-page"><div className="portal-loading">Loading event…</div></main>}><EventContent params={params} /></Suspense>;
}

async function EventContent({ params }: Pick<PageProps<"/events/[id]">, "params">) {
  const { id } = await params;
  const supabase = createSupabaseAdmin();
  const [{ data: row, error }, { count, error: countError }] = await Promise.all([
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

  if (error || countError) throw error ?? countError;
  if (!row) notFound();

  return <EventDetail event={toClubEvent(row as EventRow, count ?? 0)} />;
}
