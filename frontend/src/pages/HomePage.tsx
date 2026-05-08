import { Link } from "react-router-dom";
import { Calendar, Clock, CheckCircle2, Zap, ArrowRight } from "lucide-react";
import heroImg from "@/assets/hero-transparent.webp";

export default function HomePage() {
  return (
    <div className="relative flex flex-col items-center text-center py-12 gap-20 overflow-hidden">
      {/* Decorative Background Blobs */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-brand-green/10 blur-[100px] rounded-full -z-10"></div>
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-brand-red/10 blur-[100px] rounded-full -z-10"></div>

      <section className="max-w-4xl flex flex-col items-center gap-8 relative">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-green-light/50 text-brand-green-dark rounded-full text-sm font-bold border border-brand-green-light mb-2 backdrop-blur-sm">
          <Zap size={14} fill="currentColor" />
          <span>Frictionless Group Scheduling</span>
        </div>
        
        <div className="relative group cursor-pointer">
          <img 
            src={heroImg} 
            alt="LetUsMeet Hero" 
            className="h-48 sm:h-72 w-auto mb-4 animate-bounce-subtle transition-transform group-hover:scale-110" 
          />
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-4 bg-black/5 blur-xl rounded-full"></div>
        </div>

        <h1 className="text-5xl sm:text-8xl font-black tracking-tight text-brand-charcoal leading-[0.95]">
          Stop the back-and-forth <br />
          <span className="text-brand-gradient">
            Let everyone meet.
          </span>
        </h1>
        
        <p className="text-xl text-neutral-600 max-w-xl leading-relaxed">
          The fastest way to find a time that works for everyone. No accounts required for participants, just results.
        </p>

        <div className="flex flex-col sm:flex-row gap-5 mt-4 w-full sm:w-auto">
          <Link
            to="/create"
            data-testid="create-poll-btn"
            className="px-12 py-6 bg-brand-green text-white rounded-2xl font-black text-2xl hover:bg-brand-green-dark transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-brand-green/30 flex items-center justify-center gap-3"
          >
            Create your first poll
            <ArrowRight size={24} />
          </Link>
          <Link
            to="/create"
            className="px-12 py-6 bg-white text-brand-charcoal border-2 border-neutral-100 rounded-2xl font-bold text-2xl hover:bg-neutral-50 transition-all hover:border-neutral-200 flex items-center justify-center"
          >
            See how it works
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl px-4">
        <div data-testid="feature-frictionless" className="group bg-white p-10 rounded-[2.5rem] border border-neutral-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-brand-green-light/30 text-brand-green rounded-3xl flex items-center justify-center transition-transform group-hover:rotate-6 group-hover:scale-110">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="font-black text-2xl text-brand-charcoal">Zero Friction</h2>
          <p className="text-neutral-500 text-base leading-relaxed">
            Participants vote in one click. No logins, no app downloads, no passwords.
          </p>
        </div>
        <div data-testid="feature-trinary" className="group bg-white p-10 rounded-[2.5rem] border border-neutral-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-brand-red-light/30 text-brand-red rounded-3xl flex items-center justify-center transition-transform group-hover:-rotate-6 group-hover:scale-110">
            <Clock size={40} />
          </div>
          <h2 className="font-black text-2xl text-brand-charcoal">Trinary Voting</h2>
          <p className="text-neutral-500 text-base leading-relaxed">
            "Yes", "No", and "If-need-be". Break scheduling deadlocks with granular options.
          </p>
        </div>
        <div data-testid="feature-sync" className="group bg-white p-10 rounded-[2.5rem] border border-neutral-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-brand-charcoal/5 text-brand-charcoal rounded-3xl flex items-center justify-center transition-transform group-hover:rotate-12 group-hover:scale-110">
            <Calendar size={40} />
          </div>
          <h2 className="font-black text-2xl text-brand-charcoal">Google Sync</h2>
          <p className="text-neutral-500 text-base leading-relaxed">
            Organizers sync calendars to see conflicts and auto-generate events.
          </p>
        </div>
      </section>
    </div>
  );
}
