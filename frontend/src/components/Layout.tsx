import { Outlet, Link } from "react-router-dom";
import { Users, LogIn, LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Layout() {
  const { user, loading, signInWithGoogle, signOutUser } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans flex flex-col">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-indigo-600">
            <div className="bg-indigo-100 p-1.5 rounded-lg">
              <Users size={24} />
            </div>
            <span>LetUsMeet</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/create" className="text-sm font-medium text-neutral-600 hover:text-indigo-600 transition-colors hidden sm:block">
              Create Poll
            </Link>

            {!loading && (
              <>
                {user && !user.isAnonymous ? (
                  <div className="flex items-center gap-4">
                    <Link to="/dashboard" className="text-sm font-medium text-neutral-600 hover:text-indigo-600 transition-colors flex items-center gap-1">
                      <LayoutDashboard size={16} />
                      <span className="hidden sm:inline">Dashboard</span>
                    </Link>
                    <button
                      onClick={signOutUser}
                      className="text-sm font-medium text-neutral-600 hover:text-red-600 transition-colors flex items-center gap-1"
                    >
                      <LogOut size={16} />
                      <span className="hidden sm:inline">Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={signInWithGoogle}
                    className="flex items-center gap-2 text-sm font-medium bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    <LogIn size={16} />
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
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-neutral-500">
          <p>© 2026 LetUsMeet — Simple, frictionless group scheduling.</p>
        </div>
      </footer>
    </div>
  );
}
