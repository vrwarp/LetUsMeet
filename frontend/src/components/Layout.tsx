import { useEffect, useState, useRef } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { LogIn, LogOut, LayoutDashboard, PlusCircle, ChevronDown, ExternalLink, AlertTriangle, X, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logoImg from "@/assets/meat-lettuce-logo-transparent.webp";
import ScrollToTop from "./ScrollToTop";

export default function Layout() {
  const { user, loading, isKeyMismatch, signInWithGoogle, signOutUser, resetAccount, deleteAccount } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
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
              <span className="text-brand-green-dark">Let</span><span className="text-brand-green-dark">Us</span><span className="text-brand-red">Meet</span>
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
                          onClick={async () => {
                            if (confirm("CRITICAL WARNING: This will permanently delete your account and all your access keys. You will lose access to all your encrypted polls. This cannot be undone. Are you sure?")) {
                              try {
                                await deleteAccount();
                              } catch (e: any) {
                                alert("Failed to delete account: " + e.message);
                              }
                            }
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-brand-red hover:bg-brand-red/5 transition-colors"
                        >
                          <Trash2 size={18} className="text-brand-red/60" />
                          Delete My Account
                        </button>

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
                    onClick={async () => {
                      setAuthError(null);
                      try {
                        await signInWithGoogle();
                      } catch (e: any) {
                        setAuthError(e.message);
                      }
                    }}
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

      {authError && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-100 text-red-600 px-6 py-4 rounded-[2rem] font-medium flex items-start gap-4 shadow-lg shadow-red-100/50">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{authError}</p>
            </div>
            <button onClick={() => setAuthError(null)} className="p-1 hover:bg-red-100 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 w-full">
        <Outlet />
      </main>

      {isKeyMismatch && (
        <div className="fixed inset-0 z-[200] bg-brand-charcoal/98 backdrop-blur-xl flex items-center justify-center p-6 text-white text-center">
          <div className="max-w-md w-full">
            <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <AlertTriangle size={40} />
            </div>
            <h2 className="text-3xl font-black mb-4">Identity Key Mismatch</h2>
            <p className="text-neutral-400 mb-8 leading-relaxed">
              The passkey you just used is different from the one originally used to secure your account. 
              Because of our zero-knowledge security, it is mathematically impossible to decrypt your polls with this key.
            </p>
            
            <div className="grid gap-4">
              <button 
                onClick={signOutUser}
                className="w-full bg-white text-brand-charcoal py-4 rounded-2xl font-bold hover:bg-neutral-100 transition-colors"
              >
                Sign Out & Try Again
              </button>
              
              <div className="pt-4 border-t border-white/10 mt-4">
                <p className="text-sm text-neutral-500 mb-4">Lost your original passkey?</p>
                <button 
                  onClick={() => {
                    if (confirm("WARNING: This will permanently delete ALL your encrypted polls and reset your account. This cannot be undone. Are you sure?")) {
                      resetAccount();
                    }
                  }}
                  className="w-full bg-red-500/10 text-red-500 border border-red-500/20 py-4 rounded-2xl font-bold hover:bg-red-500/20 transition-colors"
                >
                  Reset My Account & Delete All Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <footer className="border-t border-neutral-200 py-8 mt-auto w-full bg-neutral-50">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-neutral-600 font-medium">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
            <p>© 2026 Benson Tsai • <span className="text-brand-green-dark font-bold">LetUs</span><span className="text-brand-red font-bold">Meet</span></p>
            <div className="flex items-center gap-6">
              <Link to="/privacy" className="hover:text-brand-green transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-brand-green transition-colors">Terms</Link>
            </div>
          </div>
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
