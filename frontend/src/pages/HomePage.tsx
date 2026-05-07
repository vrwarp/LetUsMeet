import { Link } from "react-router-dom";
import { Calendar, Clock, CheckCircle2, Zap, ArrowRight } from "lucide-react";
import mascotImg from "@/assets/mascots.png";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center text-center py-8 gap-16">
      <section className="max-w-4xl flex flex-col items-center gap-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-green-light/50 text-brand-green-dark rounded-full text-sm font-bold border border-brand-green-light mb-2">
          <Zap size={14} fill="currentColor" />
          <span>Frictionless Group Scheduling</span>
        </div>
        
        <div className="relative">
          <img src={mascotImg} alt="LetUsMeet Mascots" className="h-48 sm:h-64 w-auto mb-4 animate-bounce-subtle" />
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-4 bg-black/5 blur-xl rounded-full"></div>
        </div>

        <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-brand-charcoal leading-[1.05]">
          Stop the back-and-forth <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-green to-brand-red">
            Let everyone meet.
          </span>
        </h1>
        
        <p className="text-xl text-neutral-600 max-w-xl leading-relaxed">
          The fastest way to find a time that works for everyone. No accounts required for participants, just results.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full sm:w-auto">
          <Link
            to="/create"
            data-testid="create-poll-btn"
            className="px-10 py-5 bg-brand-green text-white rounded-2xl font-black text-xl hover:bg-brand-green-dark transition-all hover:scale-105 active:scale-95 shadow-xl shadow-brand-green/20 flex items-center justify-center gap-2"
          >
            Create your first poll
            <ArrowRight size={20} />
          </Link>
          <Link
            to="/create"
            className="px-10 py-5 bg-white text-brand-charcoal border-2 border-neutral-100 rounded-2xl font-bold text-xl hover:bg-neutral-50 transition-all flex items-center justify-center"
          >
            See how it works
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
        <div data-testid="feature-frictionless" className="bg-white p-10 rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-5">
          <div className="w-16 h-16 bg-brand-green-light/30 text-brand-green rounded-2xl flex items-center justify-center">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="font-black text-2xl text-brand-charcoal">Zero Friction</h2>
          <p className="text-neutral-500 text-base leading-relaxed">
            Participants vote in one click. No logins, no app downloads, no passwords.
          </p>
        </div>
        <div data-testid="feature-trinary" className="bg-white p-10 rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-5">
          <div className="w-16 h-16 bg-brand-red-light/30 text-brand-red rounded-2xl flex items-center justify-center">
            <Clock size={32} />
          </div>
          <h2 className="font-black text-2xl text-brand-charcoal">Trinary Voting</h2>
          <p className="text-neutral-500 text-base leading-relaxed">
            "Yes", "No", and "If-need-be". Break scheduling deadlocks with granular options.
          </p>
        </div>
        <div data-testid="feature-sync" className="bg-white p-10 rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-5">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
            <Calendar size={32} />
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
