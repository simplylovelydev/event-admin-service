import type { ClubEvent } from "@/lib/events";

export type EventRow = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  short_description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  venue: string | null;
  image_url: string | null;
  image_position: string | null;
  is_featured: boolean;
  is_active: boolean;
  registration_open: boolean;
  registration_limit: number | null;
  submissions_open: boolean;
  submission_deadline: string | null;
  max_team_size: number;
  submission_rules: string[] | null;
  google_sheet_id?: string | null;
  created_at: string;
};

export const eventSelect =
  "id,title,category,description,short_description,starts_at,ends_at,venue,image_url,image_position,is_featured,is_active,registration_open,registration_limit,submissions_open,submission_deadline,max_team_size,submission_rules,created_at";
export const adminEventSelect = `${eventSelect},google_sheet_id`;

const colors = ["lime", "pink", "blue", "orange"];

function formatDate(value: string | null, options: Intl.DateTimeFormatOptions) {
  if (!value) return "Date to be announced";
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(value));
}

export function toClubEvent(row: EventRow, registrationCount = 0): ClubEvent {
  const startDate = formatDate(row.starts_at, { month: "long", day: "numeric", year: "numeric" });
  const endDate = row.ends_at
    ? formatDate(row.ends_at, { month: "long", day: "numeric", year: "numeric" })
    : null;

  return {
    id: row.id,
    title: row.title,
    category: row.category,
    date: formatDate(row.starts_at, { month: "short", day: "2-digit" }).toUpperCase(),
    dateLabel: endDate && endDate !== startDate ? `${startDate} – ${endDate}` : startDate,
    time: row.starts_at
      ? formatDate(row.starts_at, { hour: "numeric", minute: "2-digit" }) +
        (row.ends_at ? ` – ${formatDate(row.ends_at, { hour: "numeric", minute: "2-digit" })}` : "")
      : "Time to be announced",
    venue: row.venue ?? "Venue to be announced",
    description: row.description ?? "Event details will be announced soon.",
    shortDescription: row.short_description ?? row.description ?? "More details coming soon.",
    spots: row.registration_limit === null
      ? "Open to all"
      : `${Math.max(row.registration_limit - registrationCount, 0)} spots left`,
    color: colors[row.category.length % colors.length],
    image: row.image_url ?? "",
    imagePosition: row.image_position ?? "center",
    tag: row.is_featured ? "FEATURED" : row.category.toUpperCase(),
    isFeatured: row.is_featured,
    isActive: row.is_active,
    registrationOpen: row.registration_open,
    registrationLimit: row.registration_limit,
    submissionsOpen: row.submissions_open,
    submissionDeadline: row.submission_deadline,
    maxTeamSize: row.max_team_size,
    submissionRules: row.submission_rules ?? [],
  };
}