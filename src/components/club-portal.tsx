"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleHelp,
  FileSpreadsheet,
  Filter,
  LayoutDashboard,
  LogOut,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import type { AdminEvent, ClubEvent, TeamRegistration } from "@/lib/events";

type PortalView = "events" | "teams" | "admin";
type ApiResult<T> = T & { error?: string };

const navItems = [
  { href: "/events", label: "Events", icon: CalendarDays, view: "events" },
  { href: "/teams", label: "Team hub", icon: UsersRound, view: "teams" },
  { href: "/admin", label: "Admin", icon: LayoutDashboard, view: "admin" },
] as const;
const categories = ["All events", "Hackathon", "Workshop", "Meetup", "Community"];

async function readResponse<T>(response: Response): Promise<ApiResult<T>> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "The request failed.");
  return body as ApiResult<T>;
}

export default function ClubPortal({ view }: { view: PortalView }) {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [adminEvents, setAdminEvents] = useState<AdminEvent[]>([]);
  const [registrations, setRegistrations] = useState<TeamRegistration[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All events");
  const [selectedEvent, setSelectedEvent] = useState("all");
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(view !== "admin");
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordError, setAdminPasswordError] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingEventId, setSavingEventId] = useState("");
  const [selectedRegistration, setSelectedRegistration] = useState<TeamRegistration | null>(null);

  useEffect(() => {
    if (view !== "admin") return;
    let active = true;
    fetch("/api/admin/session", { cache: "no-store" })
      .then(readResponse<{ authenticated: boolean }>)
      .then((result) => { if (active) setAdminAuthenticated(result.authenticated); })
      .catch((error: unknown) => { if (active) setAdminPasswordError(error instanceof Error ? error.message : "Could not check admin session."); })
      .finally(() => { if (active) setSessionChecked(true); });
    return () => { active = false; };
  }, [view]);

  useEffect(() => {
    if (view === "admin" || view === "teams" || view === "events") {
      if (view === "admin" && !adminAuthenticated) return;
      let active = true;
      const load = async () => {
        try {
          if (view === "admin") {
            const [adminResult, publicResult] = await Promise.all([
            fetch("/api/admin/events", { cache: "no-store" }).then(readResponse<{ events: AdminEvent[] }>),
            fetch("/api/events", { cache: "no-store" }).then(readResponse<{ events: ClubEvent[] }>),
            ]);
            if (active) {
              setAdminEvents(adminResult.events);
              setEvents(publicResult.events);
            }
          } else {
            const result = await readResponse<{ events: ClubEvent[] }>(await fetch("/api/events", { cache: "no-store" }));
            if (active) setEvents(result.events);
          }
          if (active) setLoadError("");
        } catch (error) {
          if (active) setLoadError(error instanceof Error ? error.message : "Could not load events.");
        } finally {
          if (active) setLoading(false);
        }
      };
      void load();
      const interval = window.setInterval(() => void load(), 15000);
      return () => { active = false; window.clearInterval(interval); };
    }
  }, [view, adminAuthenticated]);

  useEffect(() => {
    if (view !== "admin" || !adminAuthenticated) return;
    let active = true;
    const loadRegistrations = () => {
      const params = new URLSearchParams({ q: query, eventId: selectedEvent });
      fetch(`/api/admin/registrations?${params}`, { cache: "no-store" })
        .then(readResponse<{ registrations: TeamRegistration[] }>)
        .then((result) => { if (active) setRegistrations(result.registrations); })
        .catch((error: unknown) => { if (active) setLoadError(error instanceof Error ? error.message : "Could not load registrations."); });
    };
    const timeout = window.setTimeout(loadRegistrations, 180);
    const interval = window.setInterval(loadRegistrations, 15000);
    return () => { active = false; window.clearTimeout(timeout); window.clearInterval(interval); };
  }, [view, adminAuthenticated, query, selectedEvent]);

  const matchingEvents = events.filter((event) => {
    const matchesCategory = category === "All events" || event.category === category;
    const searchText = `${event.title} ${event.category} ${event.venue}`.toLowerCase();
    return matchesCategory && searchText.includes(query.toLowerCase());
  });
  const featuredEvent = matchingEvents.find((event) => event.isFeatured) ?? matchingEvents[0];
  const totalRegistrations = adminEvents.reduce((total, event) => total + event.registrationCount, 0);
  const connectedSheets = adminEvents.filter((event) => event.sheetUrl).length;

  async function handleLogin(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setLoginPending(true);
    setLoading(true);
    setAdminPasswordError("");
    try {
      await readResponse(await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      }));
      setAdminAuthenticated(true);
      setAdminPassword("");
    } catch (error) {
      setAdminPasswordError(error instanceof Error ? error.message : "Admin sign-in failed.");
    } finally {
      setLoginPending(false);
    }
  }

  async function loadAdminEvents() {
    const result = await readResponse<{ events: AdminEvent[] }>(await fetch("/api/admin/events", { cache: "no-store" }));
    setAdminEvents(result.events);
    return result.events;
  }

  async function handleCreateEvent(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const formElement = formEvent.currentTarget;
    setSavingEvent(true);
    setLoadError("");
    const form = new FormData(formElement);
    const startsAt = String(form.get("startsAt") ?? "");
    const endsAt = String(form.get("endsAt") ?? "");
    const rules = String(form.get("submissionRules") ?? "").split("\n").map((rule) => rule.trim()).filter(Boolean);
    try {
      await readResponse(await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          category: form.get("category"),
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          venue: form.get("venue"),
          description: form.get("description"),
          shortDescription: form.get("shortDescription"),
          imageUrl: form.get("imageUrl"),
          maxTeamSize: Number(form.get("maxTeamSize")),
          registrationLimit: form.get("registrationLimit") ? Number(form.get("registrationLimit")) : null,
          isFeatured: form.get("isFeatured") === "on",
          submissionRules: rules,
        }),
      }));
      formElement.reset();
      setNotice("Event created.");
      await loadAdminEvents();
      const publicEvents = await readResponse<{ events: ClubEvent[] }>(await fetch("/api/events", { cache: "no-store" }));
      setEvents(publicEvents.events);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not create event.");
    } finally {
      setSavingEvent(false);
    }
  }

  async function updateEvent(event: AdminEvent, updates: Record<string, boolean>) {
    setSavingEventId(event.id);
    setLoadError("");
    try {
      await readResponse(await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }));
      await loadAdminEvents();
      const publicEvents = await readResponse<{ events: ClubEvent[] }>(await fetch("/api/events", { cache: "no-store" }));
      setEvents(publicEvents.events);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not update event.");
    } finally {
      setSavingEventId("");
    }
  }

  async function createSheet(event: AdminEvent) {
    setSavingEventId(event.id);
    setLoadError("");
    try {
      await readResponse(await fetch("/api/admin/create-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id }),
      }));
      await loadAdminEvents();
      setNotice(`Spreadsheet created for ${event.title}.`);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not create spreadsheet.");
    } finally {
      setSavingEventId("");
    }
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAdminAuthenticated(false);
    setAdminEvents([]);
    setRegistrations([]);
  }

  if (view === "admin" && (!sessionChecked || !adminAuthenticated)) {
    return <AdminLogin checked={sessionChecked} password={adminPassword} setPassword={setAdminPassword} error={adminPasswordError} pending={loginPending} onSubmit={handleLogin} />;
  }

  return (
    <div className="portal-shell">
      <header className="topbar">
        <Link className="brand" href="/events" aria-label="Tech Club home"><span className="brand-mark"><Zap size={20} fill="currentColor" strokeWidth={2.8} /></span><span className="brand-name">tech<span>club</span><small> CAMPUS / EST. 2024</small></span></Link>
        <nav className="primary-nav" aria-label="Main navigation">{navItems.map(({ href, label, view: itemView }) => <Link className={view === itemView ? "nav-link active" : "nav-link"} href={href} key={href}>{label}</Link>)}</nav>
        <div className="topbar-right"><span className="term-pill"><span /> FALL ’26</span>{view === "admin" ? <button className="icon-button" type="button" title="Sign out" onClick={logout}><LogOut size={15} /></button> : <span className="avatar" aria-label="Tech Club">✳</span>}</div>
      </header>

      <main className="portal-main">
        {view === "events" && <>
          <div className="eyebrow"><span className="live-dot" /> CAMPUS TECH, OFF THE CLOCK <span className="eyebrow-rule" /></div>
          <section className="intro-row"><div><h1>Make something<br /><span>happen.</span><span className="headline-spark">✳</span></h1><p className="intro-copy">Hack nights, happy accidents, and the people who get it.<br className="desktop-only" /> Find your next thing.</p></div><div className="intro-stamp" aria-label="All skill levels welcome"><Sparkles size={19} /><span>CURIOUS MINDS<br />ALWAYS WELCOME</span><ArrowDownRight size={17} /></div></section>
          {featuredEvent ? <FeaturedEvent event={featuredEvent} /> : !loading && <EmptyState title="No events yet" text="New campus events will appear here when an admin publishes them." />}
          <section className="event-section">
            <div className="section-heading"><div><span className="section-overline">YOUR CALENDAR JUST GOT BETTER</span><h2>Coming up <span>↘</span></h2></div><SearchBox label="Search events" value={query} onChange={setQuery} /></div>
            <div className="filter-row" aria-label="Filter events by category"><Filter size={15} />{categories.map((item) => <button key={item} type="button" className={category === item ? "filter-chip selected" : "filter-chip"} onClick={() => setCategory(item)}>{item}</button>)}<span className="result-count">{matchingEvents.length} EVENTS</span></div>
            {loading ? <LoadingState /> : loadError ? <ErrorState message={loadError} /> : matchingEvents.length ? <EventGrid events={matchingEvents} /> : <EmptyState title="No matching events" text="Try another search or check back when new events are posted." />}
          </section>
        </>}

        {view === "teams" && <>
          <PageIntro label="MAKE IT A TEAM EFFORT" title={<>Your people.<br /><span>Your project.</span></>} copy="Find an active challenge, review its submission rules, and register your team." />
          {loading ? <LoadingState /> : loadError ? <ErrorState message={loadError} /> : events.length ? <div className="team-live-list">{events.map((event) => <TeamEvent key={event.id} event={event} />)}</div> : <EmptyState title="No active challenges" text="When an admin publishes an event, its team rules and registration link will show here." />}
        </>}

        {view === "admin" && <>
          <PageIntro label="THE PEOPLE BEHIND THE SCENES" title={<>A little order.<br /><span>A lot of events.</span></>} copy="Create campus events, manage registrations, control submission windows, and create event workbooks." />
          <div className="admin-toolbar"><details className="event-create-details"><summary className="button button-dark"><PlusIcon /> New event</summary><EventCreateForm saving={savingEvent} onSubmit={handleCreateEvent} /></details><span className="admin-live-indicator"><span className="live-dot" /> LIVE DATABASE</span></div>
          {loadError && <div className="inline-error" role="alert">{loadError}</div>}
          <section className="admin-stats"><StatCard label="ACTIVE EVENTS" value={String(adminEvents.filter((event) => event.isActive).length).padStart(2, "0")} detail={`${adminEvents.length} total events`} tone="stat-lime" icon={<CalendarDays size={18} />} /><StatCard label="TEAM REGISTRATIONS" value={String(totalRegistrations).padStart(2, "0")} detail="Across all events" tone="stat-pink" icon={<UsersRound size={18} />} /><StatCard label="SHEETS CONNECTED" value={`${connectedSheets} / ${adminEvents.length}`} detail="Event workbooks" tone="stat-blue" icon={<FileSpreadsheet size={18} />} /></section>
          <section className="admin-workspace">
            <div className="admin-table-panel"><div className="section-heading compact"><div><span className="section-overline">LIVE SIGN-UPS</span><h2>Registrations <span>↘</span></h2></div><span className="sample-tag">DATABASE</span></div><div className="admin-tools"><SearchBox label="Search team, name, email, USN" value={query} onChange={setQuery} className="admin-search" /><select aria-label="Filter by event" value={selectedEvent} onChange={(event) => setSelectedEvent(event.target.value)}><option value="all">All events</option>{adminEvents.map((event) => <option value={event.id} key={event.id}>{event.title}</option>)}</select></div>{loading ? <LoadingState /> : <RegistrationTable registrations={registrations} onSelect={setSelectedRegistration} />}</div>
            <aside className="sheet-panel"><div className="sheet-heading"><span className="sheet-icon"><FileSpreadsheet size={19} /></span><span className="sheet-count">{adminEvents.length} EVENTS</span></div><span className="section-overline">GOOGLE SHEETS</span><h2>One home<br />for every event.</h2><p>Create a workbook with dedicated registration and submission tabs.</p><div className="sheet-event-list">{adminEvents.map((event) => <div className="sheet-event-row" key={event.id}><span className={`sheet-status ${event.sheetUrl ? "ready" : "not-ready"}`} /><span>{event.title}</span>{event.sheetUrl ? <a href={event.sheetUrl} target="_blank" rel="noreferrer">Open <ArrowUpRight size={12} /></a> : <button type="button" disabled={savingEventId === event.id} onClick={() => createSheet(event)}>{savingEventId === event.id ? "Creating…" : "Create"}</button>}</div>)}</div><div className="sheet-footnote"><ShieldCheck size={15} /> Workbook creation runs on the server.</div></aside>
          </section>
          <section className="admin-event-management"><div className="section-heading compact"><div><span className="section-overline">EVENT CONTROLS</span><h2>Manage events <span>↘</span></h2></div></div>{adminEvents.length ? <div className="admin-event-list">{adminEvents.map((event) => <AdminEventRow event={event} key={event.id} busy={savingEventId === event.id} onUpdate={updateEvent} />)}</div> : <EmptyState title="No events created" text="Create your first event to publish it to the events page." />}</section>
        </>}
      </main>

      <footer className="site-footer"><Link className="footer-brand" href="/events"><Zap size={15} fill="currentColor" /> TECH CLUB</Link><span>GOOD IDEAS LIKE COMPANY.</span><span>CAMPUS / 2026</span></footer>
      <div className="mobile-nav">{navItems.map(({ href, label, icon: Icon, view: itemView }) => <Link className={view === itemView ? "mobile-nav-link active" : "mobile-nav-link"} href={href} key={href}><Icon size={18} /><span>{label}</span></Link>)}</div>
      {notice && <div className="notice-toast" role="status"><span><Check size={17} /></span>{notice}<button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={16} /></button></div>}
      {selectedRegistration && <RegistrationDialog registration={selectedRegistration} onClose={() => setSelectedRegistration(null)} />}
    </div>
  );
}

function PlusIcon() { return <span aria-hidden="true">+</span>; }

function FeaturedEvent({ event }: { event: ClubEvent }) {
  return <section className="featured-event" aria-label="Featured event"><div className="featured-image" style={{ backgroundImage: event.image ? `linear-gradient(90deg, rgba(23,32,22,.84) 0%, rgba(23,32,22,.43) 54%, rgba(23,32,22,.06) 100%), url("${event.image}")` : "linear-gradient(110deg, #20372b, #50613b)" }} /><div className="featured-copy"><span className="featured-kicker"><Sparkles size={14} /> {event.isFeatured ? "FEATURED EVENT" : event.category.toUpperCase()}</span><p className="featured-date">{event.dateLabel.toUpperCase()} <span>·</span> {event.venue.toUpperCase()}</p><h2>{event.title}<span>.</span></h2><p className="featured-description">{event.shortDescription}</p><Link className="button button-lime" href={`/events/${event.id}`}>View event <ArrowUpRight size={17} /></Link></div><div className="featured-aside"><span className="vertical-label">A LITTLE LESS TALK. A LOT MORE MAKING.</span><div className="date-sticker"><span>{event.date.split(" ")[0]}</span><strong>{event.date.split(" ")[1]}</strong><small>{event.category.toUpperCase()}</small></div></div></section>;
}

function EventGrid({ events }: { events: ClubEvent[] }) {
  return <div className="event-grid">{events.map((event, index) => <article className={`event-card card-${event.color}`} key={event.id}><Link className="event-image" href={`/events/${event.id}`} style={{ backgroundImage: event.image ? `url("${event.image}")` : "linear-gradient(135deg, #dce8ca, #a9bf8b)", backgroundPosition: event.imagePosition }} aria-label={`View ${event.title}`}><span className="event-date-badge">{event.date}</span><span className="event-image-index">{String(index + 1).padStart(2, "0")}</span></Link><div className="event-card-content"><div className="event-card-meta"><span className="category-label">{event.category}</span><span className="event-spots">{event.spots}</span></div><h3><Link href={`/events/${event.id}`}>{event.title}</Link></h3><p>{event.shortDescription}</p><div className="event-card-bottom"><span><CalendarDays size={14} /> {event.dateLabel}</span><Link href={`/events/${event.id}`} aria-label={`Details for ${event.title}`}><ArrowUpRight size={17} /></Link></div></div></article>)}</div>;
}

function TeamEvent({ event }: { event: ClubEvent }) {
  return <article className="team-live-card"><div className="team-live-heading"><div><span className="section-overline">{event.category.toUpperCase()} · {event.dateLabel.toUpperCase()}</span><h2>{event.title}<span>.</span></h2><p>{event.description}</p></div><span className={`team-window ${event.submissionsOpen ? "window-open" : "window-closed"}`}>{event.submissionsOpen ? "SUBMISSIONS OPEN" : "SUBMISSIONS CLOSED"}</span></div><div className="team-live-footer"><span><UsersRound size={15} /> Teams up to {event.maxTeamSize}</span><span><MapPin size={15} /> {event.venue}</span><Link className="button button-lime" href={`/events/${event.id}`}>{event.registrationOpen ? "Register team" : "View event"}<ArrowRight size={16} /></Link></div>{event.submissionRules.length > 0 && <div className="team-live-rules"><strong>SUBMISSION CRITERIA</strong><ul>{event.submissionRules.map((rule, index) => <li key={`${event.id}-${index}`}>{rule}</li>)}</ul></div>}</article>;
}

function AdminLogin({ checked, password, setPassword, error, pending, onSubmit }: { checked: boolean; password: string; setPassword: (value: string) => void; error: string; pending: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <main className="admin-login-page"><Link className="detail-brand" href="/events"><span>✳</span> TECH CLUB</Link><form className="admin-login-form" onSubmit={onSubmit}><span className="section-overline">ADMIN ACCESS</span><h1>Welcome <span>back.</span></h1><p>Sign in to manage campus events and registrations.</p>{!checked ? <LoadingState /> : <><label className="field-label">Admin token<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-dark" disabled={pending}>{pending ? "Signing in…" : "Sign in"}<ArrowRight size={16} /></button></>}</form></main>;
}

function EventCreateForm({ saving, onSubmit }: { saving: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="event-create-form" onSubmit={onSubmit}><label className="field-label">Event title<input name="title" required maxLength={120} /></label><label className="field-label">Category<select name="category" required><option>Hackathon</option><option>Workshop</option><option>Meetup</option><option>Community</option></select></label><div className="event-create-date-grid"><label className="field-label">Starts<input name="startsAt" type="datetime-local" required /></label><label className="field-label">Ends<input name="endsAt" type="datetime-local" /></label></div><label className="field-label">Venue<input name="venue" maxLength={240} /></label><label className="field-label">Short description<input name="shortDescription" maxLength={240} required /></label><label className="field-label">Details<textarea name="description" rows={3} maxLength={5000} /></label><label className="field-label">Image URL<input name="imageUrl" type="url" placeholder="https://…" /></label><div className="event-create-date-grid"><label className="field-label">Team size<select name="maxTeamSize" defaultValue="6">{[1,2,3,4,5,6].map((size) => <option key={size}>{size}</option>)}</select></label><label className="field-label">Registration limit<input name="registrationLimit" type="number" min="1" /></label></div><label className="field-label">Submission rules<textarea name="submissionRules" rows={3} placeholder="One rule per line" /></label><label className="event-feature-toggle"><input name="isFeatured" type="checkbox" /> Feature this event</label><button className="button button-lime" type="submit" disabled={saving}>{saving ? "Creating…" : "Create event"}<ArrowRight size={16} /></button></form>;
}

function AdminEventRow({ event, busy, onUpdate }: { event: AdminEvent; busy: boolean; onUpdate: (event: AdminEvent, changes: Record<string, boolean>) => void }) {
  return <article className="admin-event-row"><div className="admin-event-title"><strong>{event.title}</strong><span>{event.category} · {event.dateLabel}</span></div><span className={`admin-event-state ${event.isActive ? "state-active" : "state-inactive"}`}>{event.isActive ? "ACTIVE" : "INACTIVE"}</span><button type="button" disabled={busy} onClick={() => onUpdate(event, { is_active: !event.isActive })}>{event.isActive ? "Deactivate" : "Activate"}</button><button type="button" disabled={busy} onClick={() => onUpdate(event, { registration_open: !event.registrationOpen })}>Registration {event.registrationOpen ? "open" : "closed"}</button><button type="button" disabled={busy} onClick={() => onUpdate(event, { submissions_open: !event.submissionsOpen })}>Submissions {event.submissionsOpen ? "open" : "closed"}</button></article>;
}

function RegistrationTable({ registrations, onSelect }: { registrations: TeamRegistration[]; onSelect: (registration: TeamRegistration) => void }) {
  return <div className="registration-table-wrap"><table className="registration-table"><thead><tr><th>TEAM / EVENT</th><th>TEAM LEAD</th><th>REGISTERED</th><th aria-label="Details" /></tr></thead><tbody>{registrations.map((registration) => <tr key={registration.id}><td><strong>{registration.teamName}</strong><span>{registration.eventTitle}</span></td><td><strong>{registration.leadName}</strong><span>{registration.leadEmail}</span></td><td>{new Date(registration.createdAt).toLocaleString()}</td><td><button type="button" className="icon-button" title={`View ${registration.teamName}`} onClick={() => onSelect(registration)}><ArrowUpRight size={16} /></button></td></tr>)}</tbody></table>{registrations.length === 0 && <div className="table-empty">No registrations match this search.</div>}</div>;
}

function RegistrationDialog({ registration, onClose }: { registration: TeamRegistration; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation"><section className="confirmation-modal registration-detail-modal" role="dialog" aria-modal="true" aria-labelledby="registration-detail-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button><span className="section-overline">{registration.eventTitle}</span><h2 id="registration-detail-title">{registration.teamName}</h2><div className="registration-member-list">{registration.members.map((member, index) => <div className="registration-member-row" key={`${registration.id}-${index}`}><strong>{String(index + 1).padStart(2, "0")} · {member.name}</strong><span>{member.email}</span><span>{member.phone} · {member.usn}</span></div>)}</div></section></div>;
}

function PageIntro({ label, title, copy }: { label: string; title: React.ReactNode; copy: string }) {
  return <section className="page-intro"><div className="eyebrow"><span className="live-dot" /> {label} <span className="eyebrow-rule" /></div><div className="page-intro-row"><h1>{title}<span className="headline-spark">✳</span></h1><p className="intro-copy">{copy}</p></div></section>;
}

function SearchBox({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return <label className={`search-box ${className}`}><Search size={16} /><input aria-label={label} placeholder={label} value={value} onChange={(event) => onChange(event.target.value)} />{value && <button type="button" aria-label="Clear search" onClick={() => onChange("")}><X size={15} /></button>}</label>;
}

function LoadingState() { return <div className="portal-loading" role="status">Loading…</div>; }
function ErrorState({ message }: { message: string }) { return <div className="inline-error" role="alert">{message}</div>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="empty-state"><CircleHelp size={24} /><strong>{title}</strong><span>{text}</span></div>; }
function StatCard({ label, value, detail, tone, icon }: { label: string; value: string; detail: string; tone: string; icon: React.ReactNode }) { return <article className={`stat-card ${tone}`}><div className="stat-card-top"><span>{label}</span>{icon}</div><strong>{value}</strong><small>{detail}</small></article>; }
