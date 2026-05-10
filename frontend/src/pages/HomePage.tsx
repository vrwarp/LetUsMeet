import { Link } from "react-router-dom";
import { Clock, CheckCircle2, ArrowRight, Zap } from "lucide-react";
import heroImg from "@/assets/hero-transparent.webp";

export default function HomePage() {
  return (
    <div className="relative flex flex-col items-center text-center py-10 sm:py-20 gap-16 sm:gap-24 overflow-hidden bg-[#FAFAFA]">
      {/* Decorative Background Blobs */}
      <div className="absolute top-0 -left-20 w-[600px] h-[600px] bg-brand-green/10 blur-[140px] rounded-full -z-10 animate-pulse"></div>
      <div className="absolute bottom-0 -right-20 w-[600px] h-[600px] bg-brand-red/5 blur-[140px] rounded-full -z-10 animate-pulse" style={{ animationDelay: '1.5s' }}></div>

      <section className="max-w-5xl flex flex-col items-center gap-8 sm:gap-12 relative px-6 w-full">
        <div className="space-y-4 sm:space-y-6">
          <h1 className="text-6xl sm:text-9xl font-display font-black tracking-tighter leading-[1.1] text-brand-charcoal">
            Let everyone <br />
            <span className="text-brand-gradient">meet.</span>
          </h1>
          <p className="text-xl sm:text-2xl font-medium text-brand-charcoal/40 tracking-tight max-w-2xl mx-auto">
            The simplest way to coordinate with groups, <br className="hidden sm:block" /> friends, and teams.
          </p>
        </div>

        <Link
          to="/create"
          className="group flex flex-col items-center gap-6 sm:gap-10 w-full sm:w-auto transition-all"
          data-testid="create-poll-link-group"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-brand-green/10 blur-3xl rounded-full scale-150 group-hover:bg-brand-green/20 transition-colors"></div>
            <img
              src={heroImg}
              alt="LetUsMeet Hero"
              className="relative h-40 sm:h-72 w-auto animate-bounce-subtle transition-transform group-hover:scale-105 duration-700"
            />
          </div>

          <div className="btn-primary-green w-full sm:w-72 h-16 text-lg group-hover:shadow-brand-green/40 transition-all">
            Start a Poll
            <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl px-6 pb-12">
        <div data-testid="feature-frictionless" className="group glass-card-light p-12 rounded-[3rem] hover:shadow-brand-green/15 hover:-translate-y-3 transition-all duration-500 flex flex-col items-center gap-8 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-green/5 blur-2xl rounded-full transition-all group-hover:bg-brand-green/10"></div>
          <div className="w-20 h-20 premium-gradient-green text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-brand-green/20 transition-all group-hover:rotate-6 group-hover:scale-110">
            <CheckCircle2 size={40} strokeWidth={2.5} />
          </div>
          <div className="space-y-3 relative z-10">
            <h2 className="font-display text-2xl font-bold text-brand-charcoal tracking-tight">Zero Friction</h2>
            <p className="text-brand-charcoal/60 text-base leading-relaxed">
              Vote in one click. <br />No logins or apps required.
            </p>
          </div>
        </div>

        <div data-testid="feature-trinary" className="group glass-card-light p-12 rounded-[3rem] hover:shadow-brand-red/15 hover:-translate-y-3 transition-all duration-500 flex flex-col items-center gap-8 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-red/5 blur-2xl rounded-full transition-all group-hover:bg-brand-red/10"></div>
          <div className="w-20 h-20 premium-gradient-red text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-brand-red/20 transition-all group-hover:-rotate-6 group-hover:scale-110">
            <Clock size={40} strokeWidth={2.5} />
          </div>
          <div className="space-y-3 relative z-10">
            <h2 className="font-display text-2xl font-bold text-brand-charcoal tracking-tight">Trinary Voting</h2>
            <p className="text-brand-charcoal/60 text-base leading-relaxed">
              Yes, No, and If-need-be. <br />Flexible options for everyone.
            </p>
          </div>
        </div>

        <div data-testid="feature-realtime" className="group glass-card-light p-12 rounded-[3rem] hover:shadow-brand-green/15 hover:-translate-y-3 transition-all duration-500 flex flex-col items-center gap-8 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-green/5 blur-2xl rounded-full transition-all group-hover:bg-brand-green/10"></div>
          <div className="w-20 h-20 premium-gradient-green text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-brand-green/20 transition-all group-hover:rotate-12 group-hover:scale-110">
            <Zap size={40} strokeWidth={2.5} fill="currentColor" />
          </div>
          <div className="space-y-3 relative z-10">
            <h2 className="font-display text-2xl font-bold text-brand-charcoal tracking-tight">Realtime Sync</h2>
            <p className="text-brand-charcoal/60 text-base leading-relaxed">
              Watch updates happen instantly. <br />No refreshing, just smooth coordination.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
