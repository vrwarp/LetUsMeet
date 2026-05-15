import { Link } from "react-router-dom";
// No lucide-react imports used in this file currently
import heroImg from "@/assets/hero-transparent.webp";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)]">
      {/* Hero Section */}
      <section className="flex-1 grid grid-cols-1 md:grid-cols-2">
        {/* Left Side: Mascot */}
        <div className="bg-white flex flex-col items-center justify-center py-12 px-6 sm:p-20 relative">
          <Link to="/create" className="max-w-md w-full flex flex-col items-center gap-4 group/hero hover:scale-[1.02] transition-transform duration-500">
            <img
              src={heroImg}
              alt="LetUsMeet Mascot"
              className="w-full max-w-[280px] sm:max-w-[400px] h-auto drop-shadow-2xl animate-bounce-subtle"
            />
          </Link>
        </div>

        {/* Right Side: CTA */}
        <div className="bg-[#2D5A43] flex flex-col items-center justify-center py-16 px-8 sm:p-20 text-center md:text-left md:items-start">
          <div className="max-w-md w-full space-y-8 sm:space-y-10">
            <h1 className="text-5xl sm:text-8xl font-display font-bold text-white leading-tight tracking-tight px-2 sm:px-0">
              Let everyone meet.
            </h1>
            <Link
              to="/create"
              className="inline-flex items-center justify-center bg-[#5B8C3A] hover:bg-[#4A722F] text-white font-display font-bold text-xl sm:text-2xl px-10 py-5 rounded-2xl transition-all shadow-xl hover:scale-105 active:scale-95 w-full sm:w-auto"
            >
              Start a Poll
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
