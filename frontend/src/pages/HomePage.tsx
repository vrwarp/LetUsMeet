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
          <p className="text-xl sm:text-2xl font-medium text-brand-charcoal/75 tracking-tight max-w-2xl mx-auto">
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
              className="relative h-64 sm:h-72 w-auto animate-bounce-subtle transition-transform group-hover:scale-105 duration-700"
            />
          </div>

          <div className="btn-primary-green w-full sm:w-72 h-14 md:h-16 text-base md:text-lg group-hover:shadow-brand-green/40 transition-all">
            Start a Poll
            <ArrowRight size={20} className="md:w-6 md:h-6 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </section>

      <section className="w-full max-w-5xl px-6 pb-12 md:pb-24">
        <div className="bg-white rounded-2xl md:rounded-[3rem] border border-neutral-200/60 shadow-sm p-4 md:p-16 grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-neutral-100/80">
          <div data-testid="feature-frictionless" className="group flex flex-row md:flex-col items-center gap-4 md:gap-6 text-left md:text-center p-4 md:px-12 transition-all">
            <div className="shrink-0 w-12 h-12 md:w-16 md:h-16 bg-brand-green/5 rounded-xl md:rounded-2xl flex items-center justify-center text-brand-green">
              <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8" strokeWidth={1.5} />
            </div>
            <div className="space-y-0.5 md:space-y-2">
              <h2 className="font-display text-sm md:text-xl font-bold text-brand-charcoal tracking-tight">Zero Friction</h2>
              <p className="text-brand-charcoal/70 text-xs md:text-base leading-relaxed">
                Vote in one click. <br /> No logins or apps required.
              </p>
            </div>
          </div>

          <div data-testid="feature-trinary" className="group flex flex-row md:flex-col items-center gap-4 md:gap-6 text-left md:text-center p-4 md:px-12 transition-all">
            <div className="shrink-0 w-12 h-12 md:w-16 md:h-16 bg-brand-red/5 rounded-xl md:rounded-2xl flex items-center justify-center text-brand-red">
              <Clock className="w-6 h-6 md:w-8 md:h-8" strokeWidth={1.5} />
            </div>
            <div className="space-y-0.5 md:space-y-2">
              <h2 className="font-display text-sm md:text-xl font-bold text-brand-charcoal tracking-tight">Trinary Voting</h2>
              <p className="text-brand-charcoal/70 text-xs md:text-base leading-relaxed">
                Yes, No, and <span className="whitespace-nowrap">If-need-be.</span> <br /> Flexible options for everyone.
              </p>
            </div>
          </div>

          <div data-testid="feature-realtime" className="group flex flex-row md:flex-col items-center gap-4 md:gap-6 text-left md:text-center p-4 md:px-12 transition-all">
            <div className="shrink-0 w-12 h-12 md:w-16 md:h-16 bg-brand-green/5 rounded-xl md:rounded-2xl flex items-center justify-center text-brand-green">
              <Zap className="w-6 h-6 md:w-8 md:h-8" strokeWidth={1.5} fill="currentColor" />
            </div>
            <div className="space-y-0.5 md:space-y-2">
              <h2 className="font-display text-sm md:text-xl font-bold text-brand-charcoal tracking-tight">Realtime Sync</h2>
              <p className="text-brand-charcoal/70 text-xs md:text-base leading-relaxed">
                Watch updates happen instantly. <br /> No refreshing required.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
