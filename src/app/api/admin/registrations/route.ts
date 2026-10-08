import { hasAdminSession } from "@/lib/admin-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type RegistrationRow = {
  id: string;
  event_id: string;
  team_name: string;
  created_at: string;
  events: { title: string } | { title: string }[] | null;
  m1_name: string | null;
  m1_email: string | null;
  m1_phone: string | null;
  m1_usn: string | null;
  m2_name: string | null;
  m2_email: string | null;
  m2_phone: string | null;
  m2_usn: string | null;
  m3_name: string | null;
  m3_email: string | null;
  m3_phone: string | null;
  m3_usn: string | null;
  m4_name: string | null;
  m4_email: string | null;
  m4_phone: string | null;
  m4_usn: string | null;
  m5_name: string | null;
  m5_email: string | null;
  m5_phone: string | null;
  m5_usn: string | null;
  m6_name: string | null;
  m6_email: string | null;
  m6_phone: string | null;
  m6_usn: string | null;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request) {
  if (!hasAdminSession(request, process.env.ADMIN_API_TOKEN)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  const eventId = params.get("eventId");
  if (eventId && eventId !== "all" && !isUuid(eventId)) {
    return Response.json({ error: "Invalid event filter." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    let registrationsQuery = supabase
      .from("team_registrations")
      .select("id,event_id,team_name,m1_name,m1_email,m1_phone,m1_usn,m2_name,m2_email,m2_phone,m2_usn,m3_name,m3_email,m3_phone,m3_usn,m4_name,m4_email,m4_phone,m4_usn,m5_name,m5_email,m5_phone,m5_usn,m6_name,m6_email,m6_phone,m6_usn,created_at,events(title)")
      .order("created_at", { ascending: false })
      .limit(500);

    if (eventId && eventId !== "all") registrationsQuery = registrationsQuery.eq("event_id", eventId);

    const { data, error } = await registrationsQuery;
    if (error) throw error;

    const registrations = ((data ?? []) as unknown as RegistrationRow[]).map((row) => {
      const members = Array.from({ length: 6 }, (_, index) => {
        const member = index + 1;
        const name = row[`m${member}_name` as keyof RegistrationRow];
        if (typeof name !== "string" || !name) return null;
        return {
          name,
          email: row[`m${member}_email` as keyof RegistrationRow] as string | null,
          phone: row[`m${member}_phone` as keyof RegistrationRow] as string | null,
          usn: row[`m${member}_usn` as keyof RegistrationRow] as string | null,
        };
      }).filter(Boolean);
      const eventRelation = row.events;
      const eventTitle = Array.isArray(eventRelation) ? eventRelation[0]?.title : eventRelation?.title;
      const lead = members[0];

      return {
        id: row.id,
        eventId: row.event_id,
        teamName: row.team_name,
        leadName: lead?.name ?? "",
        leadEmail: lead?.email ?? "",
        members,
        eventTitle: eventTitle ?? "Unknown event",
        createdAt: row.created_at,
      };
    });

    const filtered = query
      ? registrations.filter((registration) => {
          const haystack = [
            registration.teamName,
            registration.leadName,
            registration.leadEmail,
            registration.eventTitle,
            ...registration.members.flatMap((member) => [member?.name, member?.email, member?.phone, member?.usn]),
          ].join(" ").toLowerCase();
          return haystack.includes(query);
        })
      : registrations;

    return Response.json({ registrations: filtered }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load registrations:", error);
    return Response.json({ error: "Could not load registrations." }, { status: 503 });
  }
}