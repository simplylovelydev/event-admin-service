import { createSupabaseAdmin } from "@/lib/supabase-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength
    ? value.trim()
    : null;
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isObject(payload) || typeof payload.eventId !== "string" || !uuidPattern.test(payload.eventId)) {
    return Response.json({ error: "A valid eventId is required." }, { status: 400 });
  }

  const teamName = requiredText(payload.teamName, 100);
  if (!teamName || !Array.isArray(payload.members) || payload.members.length < 1 || payload.members.length > 6) {
    return Response.json({ error: "Enter a team name and between one and six team members." }, { status: 400 });
  }

  const members: Record<string, string | null>[] = [];
  for (const [index, candidate] of payload.members.entries()) {
    if (!isObject(candidate)) {
      return Response.json({ error: "Invalid team member details." }, { status: 400 });
    }

    const name = requiredText(candidate.name, 120);
    const email = requiredText(candidate.email, 254);
    const phone = requiredText(candidate.phone, 40);
    const usn = requiredText(candidate.usn, 64);
    if (!name || !email || !emailPattern.test(email) || !phone || !usn) {
      return Response.json({ error: `Complete valid name, email, phone, and USN for member ${index + 1}.` }, { status: 400 });
    }

    members.push({ name, email, phone, usn });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id,is_active,registration_open,max_team_size,registration_limit")
      .eq("id", payload.eventId)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!event || !event.is_active) return Response.json({ error: "This event is not available." }, { status: 404 });
    if (!event.registration_open) return Response.json({ error: "Registration is closed for this event." }, { status: 409 });
    if (members.length > event.max_team_size) {
      return Response.json({ error: `This event allows teams of up to ${event.max_team_size}.` }, { status: 400 });
    }

    if (event.registration_limit !== null) {
      const { count, error: countError } = await supabase
        .from("team_registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id);
      if (countError) throw countError;
      if ((count ?? 0) >= event.registration_limit) {
        return Response.json({ error: "This event has reached its registration limit." }, { status: 409 });
      }
    }

    const row: Record<string, unknown> = {
      event_id: event.id,
      team_name: teamName,
    };
    for (let index = 1; index <= 6; index += 1) {
      const member = members[index - 1];
      row[`m${index}_name`] = member?.name ?? null;
      row[`m${index}_email`] = member?.email ?? null;
      row[`m${index}_phone`] = member?.phone ?? null;
      row[`m${index}_usn`] = member?.usn ?? null;
    }

    const { data: registration, error: insertError } = await supabase
      .from("team_registrations")
      .insert(row)
      .select("id")
      .single();

    if (insertError) throw insertError;
    return Response.json({ registrationId: registration.id }, { status: 201 });
  } catch (error) {
    console.error("Could not save registration:", error);
    return Response.json({ error: "Could not save your registration." }, { status: 503 });
  }
}