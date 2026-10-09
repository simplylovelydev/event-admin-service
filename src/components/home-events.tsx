"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, MapPin, SearchX } from "lucide-react";
import type { ClubEvent } from "@/lib/events";

export default function HomeEvents() {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/events", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load events.");
        return result as { events: ClubEvent[] };
      })
      .then((result) => { if (active) setEvents(result.events.slice(0, 3)); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="home-event-grid" aria-label="Loading upcoming events">{[0, 1, 2].map((item) => <div className="home-event-skeleton" key={item} />)}</div>;
  }

  if (error) {
    return <div className="home-events-empty"><SearchX size={20} /><p>Events couldn’t load right now.</p><Link href="/events">Open events <ArrowUpRight size={14} /></Link></div>;
  }

  if (events.length === 0) {
    return <div className="home-events-empty"><CalendarDays size={20} /><p>Nothing on the calendar just yet.</p><span>Check back soon, or visit the event board.</span><Link href="/events">Visit events <ArrowUpRight size={14} /></Link></div>;
  }

  return <div className="home-event-grid">{events.map((event, index) => <article className="home-event" key={event.id}><Link className="home-event-image" href={`/events/${event.id}`} style={{ backgroundImage: event.image ? `url("${event.image}")` : "linear-gradient(135deg, #d5f25d, #b7d8f2)", backgroundPosition: event.imagePosition }} aria-label={`View ${event.title}`}><span className="home-event-date">{event.date}</span><span className="home-event-index">0{index + 1}</span></Link><div className="home-event-body"><div className="home-event-meta"><span>{event.category}</span><span>{event.spots}</span></div><h3><Link href={`/events/${event.id}`}>{event.title}</Link></h3><p>{event.shortDescription}</p><div className="home-event-foot"><span><CalendarDays size={13} /> {event.dateLabel}</span><span><MapPin size={13} /> {event.venue}</span><Link href={`/events/${event.id}`} aria-label={`Open ${event.title}`}><ArrowUpRight size={16} /></Link></div></div></article>)}</div>;
}
