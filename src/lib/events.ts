export type ClubEvent = {
  id: string;
  title: string;
  category: string;
  date: string;
  dateLabel: string;
  time: string;
  venue: string;
  description: string;
  shortDescription: string;
  spots: string;
  color: string;
  image: string;
  imagePosition?: string;
  tag: string;
  isFeatured: boolean;
  isActive: boolean;
  registrationOpen: boolean;
  registrationLimit: number | null;
  submissionsOpen: boolean;
  submissionDeadline: string | null;
  maxTeamSize: number;
  submissionRules: string[];
};

export type TeamRegistration = {
  id: string;
  eventId: string;
  teamName: string;
  leadName: string;
  leadEmail: string;
  eventTitle: string;
  createdAt: string;
  members: {
    name: string;
    email: string;
    phone: string;
    usn: string;
  }[];
};

export type AdminEvent = ClubEvent & {
  sheetUrl: string | null;
  registrationCount: number;
};
