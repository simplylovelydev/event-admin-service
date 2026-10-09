"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, MapPin, Plus, UsersRound, X } from "lucide-react";
import type { ClubEvent } from "@/lib/events";

type TeamMember = { name: string; email: string; phone: string; usn: string };
type RegistrationState = { id: string; leaderEmail: string; submitted: boolean };

export default function EventDetail({ event }: { event: ClubEvent }) {
  const [memberCount, setMemberCount] = useState(1);
  const [registration, setRegistration] = useState<RegistrationState | null>(null);
  const [checkingRegistration, setCheckingRegistration] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/teams/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not check team registration.");
        return response.json();
      })
      .then(({ team }) => {
        if (active && team?.eventId === event.id) {
          setRegistration({
            id: team.id,
            leaderEmail: team.leaderEmail,
            submitted: Boolean(team.submission),
          });
        }
      })
      .catch(() => undefined)
      .finally(() => { if (active) setCheckingRegistration(false); });
    return () => { active = false; };
  }, [event.id]);

  async function handleRegistration(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError("");
    setSuccess("");
    setRegistering(true);

    const form = new FormData(formEvent.currentTarget);
    const teamName = String(form.get("teamName") ?? "").trim();
    const members: TeamMember[] = [];

    for (let index = 1; index <= memberCount; index += 1) {
      const member = {
        name: String(form.get(`m${index}_name`) ?? "").trim(),
        email: String(form.get(`m${index}_email`) ?? "").trim(),
        phone: String(form.get(`m${index}_phone`) ?? "").trim(),
        usn: String(form.get(`m${index}_usn`) ?? "").trim(),
      };
      if (index > 1 && Object.values(member).every((value) => !value)) continue;
      if (Object.values(member).some((value) => !value)) {
        setError(`Complete all four fields for team member ${index}.`);
        setRegistering(false);
        return;
      }
      members.push(member);
    }

    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, teamName, members }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Registration failed.");
      setRegistration({ id: result.registrationId, leaderEmail: members[0].email, submitted: false });
      setSuccess("Your team is registered. You can submit your project here when submissions open.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your registration.");
    } finally {
      setRegistering(false);
    }
  }

  async function handleSubmission(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!registration) return;
    const formElement = formEvent.currentTarget;
    setError("");
    setSuccess("");
    setSubmitting(true);
    const form = new FormData(formElement);

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          registrationId: registration.id,
          leaderEmail: registration.leaderEmail,
          githubUrl: form.get("githubUrl"),
          liveDemoUrl: form.get("liveDemoUrl"),
          videoPitchUrl: form.get("videoPitchUrl"),
          notes: form.get("notes"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Submission failed.");
      setRegistration((current) => current ? { ...current, submitted: true } : current);
      setSuccess("Your project submission has been received.");
      formElement.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your submission.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="detail-page">
      <header className="detail-topbar"><Link className="detail-back" href="/events"><ArrowLeft size={16} /> All events</Link><Link className="detail-brand" href="/events"><span>✳</span> TECH CLUB</Link><Link className="detail-team-link" href="/teams">Team hub <ArrowRight size={15} /></Link></header>
      <section className="detail-hero" style={{ backgroundImage: event.image ? `linear-gradient(90deg, rgba(23,32,22,.88) 0%, rgba(23,32,22,.53) 57%, rgba(23,32,22,.12) 100%), url("${event.image}")` : "linear-gradient(110deg, #20372b, #50613b)", backgroundPosition: event.imagePosition }}>
        <div className="detail-hero-content"><span className="featured-kicker"><span className="live-dot" /> {event.registrationOpen ? "REGISTRATION OPEN" : "REGISTRATION CLOSED"} · {event.spots.toUpperCase()}</span><p className="featured-date">{event.dateLabel.toUpperCase()} <span>·</span> {event.category.toUpperCase()}</p><h1>{event.title}<span>.</span></h1><p className="detail-lede">{event.shortDescription}</p></div>
        <div className="detail-hero-stamp"><span>SHOW UP.<br />MAKE STUFF.<br />MEET YOUR PEOPLE.</span><span>✳</span></div>
      </section>
      <section className="detail-body">
        <div className="detail-info"><span className="section-overline">THE PLAN</span><h2>Good ideas<br />start <span>somewhere.</span></h2><p className="detail-description">{event.description}</p><div className="detail-facts"><div><CalendarDays size={17} /><span><strong>{event.dateLabel}</strong><small>Save the date</small></span></div><div><Clock3 size={17} /><span><strong>{event.time}</strong><small>Doors open 15 minutes early</small></span></div><div><MapPin size={17} /><span><strong>{event.venue}</strong><small>On campus</small></span></div><div><UsersRound size={17} /><span><strong>Teams up to {event.maxTeamSize}</strong><small>Bring a crew or find one here</small></span></div></div><div className="detail-note"><span>✳</span><p>New to this? Perfect. All experience levels are welcome, and nobody expects you to have it all figured out.</p></div></div>
        {checkingRegistration ? (
          <div className="registration-form"><div className="portal-loading">Checking your team registration…</div></div>
        ) : registration ? (
          <section className="registration-form">
            <div className="form-heading"><div><span className="section-overline">TEAM REGISTRATION</span><h2>{registration.submitted ? <>Submission <span>received.</span></> : <>You’re <span>on the list.</span></>}</h2></div><span className="confirmation-icon"><Check size={18} /></span></div>
            {success && <p className="form-success">{success}</p>}
            <p className="form-fine-print">Registration ID: {registration.id}</p>
            {registration.submitted ? (
              <div className="form-success">Your team’s project has been submitted.</div>
            ) : event.submissionsOpen ? (
              <form onSubmit={handleSubmission} className="submission-form">
                <div className="member-form-heading"><span>PROJECT SUBMISSION</span><span>{event.submissionDeadline ? `DUE ${new Date(event.submissionDeadline).toLocaleDateString()}` : "OPEN"}</span></div>
                <label className="field-label">GitHub repository<input name="githubUrl" type="url" placeholder="https://github.com/team/project" required /></label>
                <label className="field-label">Live demo<input name="liveDemoUrl" type="url" placeholder="https://your-project.example" required /></label>
                <label className="field-label">Video pitch<input name="videoPitchUrl" type="url" placeholder="https://video.example/your-pitch" required /></label>
                <label className="field-label">Notes<textarea name="notes" rows={3} maxLength={5000} placeholder="Anything the reviewers should know?" /></label>
                <button className="button button-dark submit-registration" type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit project"}<ArrowRight size={17} /></button>
              </form>
            ) : <div className="empty-state"><Clock3 size={20} /><strong>Submissions aren’t open yet</strong><span>Check back when the event window opens.</span></div>}
          </section>
        ) : (
          <form className="registration-form" onSubmit={handleRegistration}>
            <div className="form-heading"><div><span className="section-overline">SAVE YOUR SPOT</span><h2>Count me in<span>.</span></h2></div><span className="spots-badge">{event.spots}</span></div>
            <label className="field-label">Team name<input name="teamName" placeholder="Give your crew a name" required maxLength={100} /></label>
            <div className="member-form-heading"><span>TEAM MEMBERS</span><span>{memberCount} / {event.maxTeamSize}</span></div>
            <div className="member-fields">
              {Array.from({ length: memberCount }, (_, index) => (
                <fieldset className="member-fieldset" key={index}>
                  <legend><span>{index === 0 ? "01 / TEAM LEAD" : `${String(index + 1).padStart(2, "0")} / TEAM MEMBER`}</span>{index > 0 && <button type="button" onClick={() => setMemberCount((count) => count - 1)} aria-label={`Remove team member ${index + 1}`}><X size={15} /></button>}</legend>
                  <div className="member-input-grid"><label className="field-label">Full name<input name={`m${index + 1}_name`} placeholder="Name" required={index === 0} maxLength={120} /></label><label className="field-label">Campus email<input name={`m${index + 1}_email`} type="email" placeholder="you@campus.edu" required={index === 0} maxLength={254} /></label><label className="field-label">Phone number<input name={`m${index + 1}_phone`} type="tel" placeholder="Phone" required={index === 0} maxLength={40} /></label><label className="field-label">USN<input name={`m${index + 1}_usn`} placeholder="University seat number" required={index === 0} maxLength={64} /></label></div>
                </fieldset>
              ))}
            </div>
            {memberCount < event.maxTeamSize && <button className="add-member-button" type="button" onClick={() => setMemberCount((count) => Math.min(count + 1, event.maxTeamSize))}><Plus size={16} /> Add a teammate <span>({event.maxTeamSize - memberCount} left)</span></button>}
            <button className="button button-lime submit-registration" type="submit" disabled={registering || !event.registrationOpen}>{registering ? "Registering…" : event.registrationOpen ? "Register your team" : "Registration closed"}<ArrowRight size={17} /></button>
            <p className="form-fine-print">By registering, you agree to receive event updates from Tech Club.</p>
          </form>
        )}
        {(error || success && !registration) && <p className={error ? "form-error" : "form-success"} role="status">{error || success}</p>}
      </section>
    </main>
  );
}
