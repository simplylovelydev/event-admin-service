import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Code2, Heart, Lightbulb, MessageCircle, Sparkles, UsersRound, Zap } from "lucide-react";
import HomeEvents from "@/components/home-events";
import "./home.css";

export default function Home() {
  return (
    <main className="home-page">
      <header className="home-header">
        <Link className="home-brand" href="/" aria-label="Tech Club home">
          <span className="home-brand-mark"><Zap size={19} fill="currentColor" /></span>
          <span>TECHCLUB<small>CAMPUS / BUILD TOGETHER</small></span>
        </Link>
        <nav className="home-nav" aria-label="Main navigation">
          <Link className="home-nav-active" href="/">Home</Link>
          <Link href="/events">Events</Link>
          <Link href="/teams">Team hub</Link>
        </nav>
        <Link className="home-header-cta" href="/events">Find an event <ArrowUpRight size={15} /></Link>
      </header>

      <section className="home-hero">
        <div className="home-pixel-mark" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
        <div className="home-copy">
          <p className="home-kicker"><span /> CAMPUS TECH · ALL YEAR ROUND · OPEN TO EVERYONE</p>
          <h1>Good ideas<br />meet good<br /><span>people.</span></h1>
          <p className="home-subhead">Build something together.</p>
          <p className="home-description">Hack nights, design jams, and hands-on workshops. Bring your curiosity, find your crew, and turn that “what if?” into something real.</p>
          <div className="home-actions">
            <Link className="home-button home-button-coral" href="/events">Explore events <ArrowRight size={17} /></Link>
            <Link className="home-button home-button-outline" href="/teams">Visit team hub <UsersRound size={16} /></Link>
          </div>
          <div className="home-note"><span className="home-note-icon"><Heart size={15} /></span> No experience needed. Just show up curious.</div>
        </div>

        <div className="home-art" aria-label="Students collaborating on a project">
          <div className="home-art-photo" role="img" aria-label="A student team collaborating around a table" />
          <div className="home-art-caption"><span>IDEAS GET BETTER</span><span>WHEN THEY’RE SHARED <ArrowDown size={14} /></span></div>
          <div className="home-sticker home-sticker-code"><Code2 size={21} /><span>MAKE</span></div>
          <div className="home-sticker home-sticker-idea"><Lightbulb size={22} /><span>TRY</span></div>
          <div className="home-sticker home-sticker-chat"><MessageCircle size={20} /><span>SHARE</span></div>
          <div className="home-sticker home-sticker-spark"><Sparkles size={22} /></div>
          <span className="home-art-number">TC / 01</span>
        </div>
        <span className="home-side-note">MAKE · LEARN · REPEAT</span>
      </section>

      <section className="home-principles" aria-label="How we do things">
        <div className="home-principle"><span>01</span><strong>Start curious</strong><p>Bring the question you can’t stop thinking about.</p></div>
        <div className="home-principle"><span>02</span><strong>Make it together</strong><p>Find collaborators, learn by doing, and ship a first draft.</p></div>
        <div className="home-principle"><span>03</span><strong>Keep the door open</strong><p>Every skill level and every kind of idea belongs here.</p></div>
        <Link className="home-principle-link" href="/teams">Meet the team hub <ArrowUpRight size={16} /></Link>
      </section>

      <section className="home-upcoming" id="upcoming-events">
        <div className="home-section-heading"><div><p className="home-kicker home-kicker-dark"><span /> YOUR NEXT GOOD IDEA STARTS HERE</p><h2>Coming up<span>.</span></h2></div><Link href="/events">All events <ArrowUpRight size={16} /></Link></div>
        <HomeEvents />
      </section>

      <footer className="home-footer"><Link className="home-brand home-brand-footer" href="/"><span className="home-brand-mark"><Zap size={16} fill="currentColor" /></span><span>TECHCLUB<small>CAMPUS / BUILD TOGETHER</small></span></Link><span>GOOD IDEAS LIKE COMPANY.</span><Link href="/teams">Bring a friend <ArrowUpRight size={14} /></Link></footer>
    </main>
  );
}