import { Link } from "react-router-dom";
import { Calendar, Clock, CheckCircle2, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center text-center py-12 gap-16">
      <section className="max-w-2xl flex flex-col items-center gap-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-100 mb-2">
          <Zap size={14} fill="currentColor" />
          <span>Frictionless Scheduling</span>
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-neutral-900 leading-[1.1]">
          Stop the back-and-forth <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
            Let everyone meet.
          </span>
        </h1>
        <p className="text-xl text-neutral-600 max-w-lg">
          The fastest way to find a time that works for everyone. No accounts required for participants.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full sm:w-auto">
          <Link
            to="/create"
            data-testid="create-poll-btn"
            className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-200"
          >
            Create your first poll
          </Link>
          <Link
            to="/create"
            className="px-8 py-4 bg-white text-neutral-700 border border-neutral-200 rounded-xl font-bold text-lg hover:bg-neutral-50 transition-all flex items-center justify-center"
          >
            See how it works
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
        <div className="bg-white p-8 rounded-2xl border border-neutral-100 shadow-sm flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="font-bold text-xl">Zero Friction</h3>
          <p className="text-neutral-500 text-sm leading-relaxed">
            Participants vote in one click. No logins, no app downloads, no passwords.
          </p>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-neutral-100 shadow-sm flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <Clock size={24} />
          </div>
          <h3 className="font-bold text-xl">Trinary Voting</h3>
          <p className="text-neutral-500 text-sm leading-relaxed">
            "Yes", "No", and "If-need-be". Break scheduling deadlocks with granular options.
          </p>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-neutral-100 shadow-sm flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Calendar size={24} />
          </div>
          <h3 className="font-bold text-xl">Google Sync</h3>
          <p className="text-neutral-500 text-sm leading-relaxed">
            Organizers sync calendars to see conflicts and auto-generate events.
          </p>
        </div>
      </section>
    </div>
  );
}
