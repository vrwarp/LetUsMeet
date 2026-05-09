import Link from "next/link";
import Image from "next/image";
import { Calendar, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import heroImg from "@/assets/hero-transparent.webp";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center text-center py-12 gap-20">

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
          data-testid="create-poll-btn"
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
        {/* Zero Friction Card */}
        <div data-testid="feature-frictionless" className="group bg-white p-10 rounded-[2.5rem] shadow-xl shadow-black/[0.03] hover:shadow-2xl hover:shadow-brand-green/10 hover:-translate-y-2 transition-all duration-500 flex flex-col items-center gap-6 text-center border border-neutral-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-green/5 blur-3xl rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700"></div>
          <div className="w-16 h-16 bg-brand-green/10 text-brand-green rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-6 group-hover:scale-110 group-hover:bg-brand-green group-hover:text-white">
            <CheckCircle2 size={32} />
          </div>
          <div className="space-y-2 relative z-10">
            <h2 className="font-black text-2xl text-brand-charcoal tracking-tight">Zero Friction</h2>
            <p className="text-neutral-500 text-base leading-relaxed font-medium">
              Vote in one click. No logins or apps.
            </p>
          </div>
        </div>

        {/* Trinary Voting Card */}
        <div data-testid="feature-trinary" className="group bg-white p-10 rounded-[2.5rem] shadow-xl shadow-black/[0.03] hover:shadow-2xl hover:shadow-brand-red/10 hover:-translate-y-2 transition-all duration-500 flex flex-col items-center gap-6 text-center border border-neutral-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-red/5 blur-3xl rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700"></div>
          <div className="w-16 h-16 bg-brand-red/10 text-brand-red rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:-rotate-6 group-hover:scale-110 group-hover:bg-brand-red group-hover:text-white">
            <Clock size={32} />
          </div>
          <div className="space-y-2 relative z-10">
            <h2 className="font-black text-2xl text-brand-charcoal tracking-tight">Trinary Voting</h2>
            <p className="text-neutral-500 text-base leading-relaxed font-medium">
              Yes, No, and If-need-be options.
            </p>
          </div>
        </div>

        {/* Google Sync Card */}
        <div data-testid="feature-sync" className="group bg-white p-10 rounded-[2.5rem] shadow-xl shadow-black/[0.03] hover:shadow-2xl hover:shadow-brand-green/10 hover:-translate-y-2 transition-all duration-500 flex flex-col items-center gap-6 text-center border border-neutral-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-green/5 blur-3xl rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700"></div>
          <div className="w-16 h-16 bg-brand-green/10 text-brand-green rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-12 group-hover:scale-110 group-hover:bg-brand-green group-hover:text-white">
            <Calendar size={32} />
          </div>
          <div className="space-y-2 relative z-10">
            <h2 className="font-black text-2xl text-brand-charcoal tracking-tight">Google Sync</h2>
            <p className="text-neutral-500 text-base leading-relaxed font-medium">
              See conflicts and auto-generate events.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
