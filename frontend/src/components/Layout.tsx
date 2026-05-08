import { Outlet, Link } from "react-router-dom";
import { LogIn, LogOut, LayoutDashboard, PlusCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logoImg from "@/assets/logo-transparent.webp";

export default function Layout() {
  const { user, loading, signInWithGoogle, signOutUser } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-50 text-brand-charcoal font-sans flex flex-col">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <img src={logoImg} alt="LetUsMeet" className="h-14 w-auto transition-transform group-hover:scale-105" />
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6">
            <Link
              to="/create"
              className="flex items-center gap-1.5 text-sm font-semibold text-brand-green-dark hover:text-brand-green transition-colors px-3 py-2 rounded-full hover:bg-brand-green-light hidden sm:flex"
            >
              <PlusCircle size={18} />
              <span>Create Poll</span>
            </Link>

            {!loading && (
              <>
                {user && !user.isAnonymous ? (
                  <div className="flex items-center gap-3">
                    <Link
                      to="/dashboard"
                      className="text-sm font-medium text-neutral-600 hover:text-brand-green-dark transition-colors flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-neutral-100"
                    >
                      <LayoutDashboard size={18} />
                      <span className="hidden sm:inline">Dashboard</span>
                    </Link>
                    <div className="h-4 w-[1px] bg-neutral-200 mx-1 hidden sm:block"></div>
                    <button
                      onClick={signOutUser}
                      className="text-sm font-medium text-neutral-600 hover:text-brand-red transition-colors flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-brand-red-light/30"
                    >
                      <LogOut size={18} />
                      <span className="hidden sm:inline">Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={signInWithGoogle}
                    className="flex items-center gap-2 text-sm font-bold bg-brand-green text-white px-5 py-2.5 rounded-full hover:bg-brand-green-dark transition-all shadow-md hover:shadow-lg active:scale-95"
                  >
                    <LogIn size={18} />
                    <span>Sign in with Google</span>
                  </button>
                )}
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        <Outlet />
      </main>
      <footer className="border-t border-neutral-200 py-8 mt-auto w-full bg-neutral-50">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-neutral-500 font-medium">
          <p>© 2026 <span className="text-brand-green font-bold">LetUs</span><span className="text-brand-red font-bold">Meet</span>. Simple group scheduling.</p>
        </div>
      </footer>
    </div>
  );
}
