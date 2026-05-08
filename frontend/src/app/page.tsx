import Link from "next/link";
import Image from "next/image";
import { Calendar, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import heroImg from "@/assets/hero-transparent.webp";

export default function HomePage() {
  return (
    <div className="relative flex flex-col items-center text-center py-12 gap-20 overflow-hidden">
      {/* Decorative Background Blobs */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-brand-green/10 blur-[100px] rounded-full -z-10"></div>
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-brand-red/10 blur-[100px] rounded-full -z-10"></div>

      <section className="max-w-4xl flex flex-col items-center gap-10 relative px-6 w-full">
        <h1 className="text-6xl sm:text-9xl font-black tracking-tight leading-none">
          <span className="text-brand-green-dark">Let everyone </span>
          <span className="text-brand-red">meet.</span>
        </h1>
        <p className="text-2xl font-bold text-brand-charcoal/60 -mt-4">
          Meeting made easy.
        </p>

        <Link
          href="/create"
          className="group flex flex-col items-center gap-6 w-full sm:w-auto transition-transform hover:scale-105 active:scale-95"
          data-testid="create-poll-link-group"
        >
          <div className="relative">
            <Image
              src={heroImg}
              alt="LetUsMeet Hero"
              className="h-48 sm:h-64 w-auto mb-4 animate-bounce-subtle transition-transform group-hover:scale-110"
              priority
            />
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-4 bg-black/5 blur-xl rounded-full"></div>
          </div>

          <div className="btn-primary-green w-full sm:w-64 group-hover:bg-brand-green-dark group-hover:shadow-brand-green/40 transition-all">
            Start a Poll
            <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl px-4">
        <div data-testid="feature-frictionless" className="group bg-brand-charcoal p-10 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col items-center gap-4 text-center border border-white/10">
          <div className="w-16 h-16 bg-white/10 text-brand-green rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-6 group-hover:scale-110">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="font-black text-xl text-brand-cream">Zero Friction</h2>
          <p className="text-brand-cream/60 text-sm leading-relaxed">
            Vote in one click. No logins or apps.
          </p>
        </div>
        <div data-testid="feature-trinary" className="group bg-brand-charcoal p-10 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col items-center gap-4 text-center border border-white/10">
          <div className="w-16 h-16 bg-white/10 text-brand-red rounded-2xl flex items-center justify-center transition-transform group-hover:-rotate-6 group-hover:scale-110">
            <Clock size={32} />
          </div>
          <h2 className="font-black text-xl text-brand-cream">Trinary Voting</h2>
          <p className="text-brand-cream/60 text-sm leading-relaxed">
            Yes, No, and If-need-be options.
          </p>
        </div>
        <div data-testid="feature-sync" className="group bg-brand-charcoal p-10 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col items-center gap-4 text-center border border-white/10">
          <div className="w-16 h-16 bg-white/10 text-brand-green rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12 group-hover:scale-110">
            <Calendar size={32} />
          </div>
          <h2 className="font-black text-xl text-brand-cream">Google Sync</h2>
          <p className="text-brand-cream/60 text-sm leading-relaxed">
            See conflicts and auto-generate events.
          </p>
        </div>
      </section>
    </div>
  );
}
