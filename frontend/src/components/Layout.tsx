import { useEffect, useState, useRef } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { LogIn, LogOut, LayoutDashboard, PlusCircle, ChevronDown, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logoImg from "@/assets/meat-lettuce-logo-transparent.webp";
import ScrollToTop from "./ScrollToTop";

export default function Layout() {
  const { user, loading, signInWithGoogle, signOutUser } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Close menu on navigation
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 text-brand-charcoal font-sans flex flex-col">
      <ScrollToTop />
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
            <img src={logoImg} alt="" className="h-9 sm:h-10 w-auto transition-transform group-hover:scale-105" />
            <span className="font-display font-bold text-base sm:text-2xl tracking-tight [font-variant:small-caps] block">
              <span className="text-brand-green-dark">Let</span><span className="text-brand-green">Us</span><span className="text-brand-red">Meet</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/create"
              data-testid="create-poll-btn"
              className="flex items-center justify-center gap-2 text-sm font-bold bg-brand-green text-white px-4 py-2 sm:px-6 sm:py-3 rounded-full hover:bg-brand-green-dark transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <PlusCircle size={18} />
              <span className="hidden sm:inline">Create Poll</span>
            </Link>

            {!loading && (
              <div className="flex items-center">
                {user && !user.isAnonymous ? (
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="flex items-center gap-2 p-1 pr-2 sm:pr-3 rounded-full hover:bg-neutral-100 transition-all border border-transparent hover:border-neutral-200 group"
                      aria-expanded={isMenuOpen}
                      aria-haspopup="true"
                    >
                      <div className="flex-shrink-0">
                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            alt=""
                            className="h-8 w-8 sm:h-10 sm:w-10 rounded-full ring-2 ring-brand-green/10 shadow-sm object-cover border border-white"
                          />
                        ) : (
                          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-brand-green/10 text-brand-green-dark flex items-center justify-center font-bold text-sm ring-2 ring-brand-green/10 border border-white">
                            {user.displayName?.[0] || user.email?.[0] || "U"}
                          </div>
                        )}
                      </div>
                      <ChevronDown size={16} className={`text-neutral-400 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-neutral-100 py-2 z-30 animate-fade-in-up overflow-hidden">
                        <div className="px-4 py-3 border-b border-neutral-50 mb-1">
                          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">Signed in as</p>
                          <p className="text-sm font-bold text-brand-charcoal truncate">{user.displayName || user.email}</p>
                          {user.displayName && <p className="text-xs text-neutral-500 truncate">{user.email}</p>}
                        </div>
                        
                        <Link
                          to="/dashboard"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:text-brand-green transition-colors"
                        >
                          <LayoutDashboard size={18} className="text-neutral-400" />
                          Dashboard
                        </Link>
                        
                        <div className="h-px bg-neutral-50 my-1"></div>
                        
                        <button
                          onClick={signOutUser}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-brand-red-light/30 hover:text-brand-red transition-colors"
                        >
                          <LogOut size={18} className="text-neutral-400" />
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={signInWithGoogle}
                    className="flex items-center gap-2 text-sm font-bold text-neutral-700 hover:text-brand-green transition-colors px-4 py-2 rounded-full hover:bg-neutral-100 border border-neutral-200"
                  >
                    <LogIn size={18} />
                    <span>Sign in</span>
                  </button>
                )}
              </div>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <footer className="border-t border-neutral-200 py-8 mt-auto w-full bg-neutral-50">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-neutral-600 font-medium">
          <p>© 2026 Benson Tsai • <span className="text-brand-green font-bold">LetUs</span><span className="text-brand-red font-bold">Meet</span></p>
          <a 
            href="https://github.com/vrwarp/LetUsMeet" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-2 hover:text-brand-green transition-all group"
          >
            <ExternalLink size={16} className="text-neutral-400 group-hover:text-brand-green transition-colors" />
            <span>GitHub Repository</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
