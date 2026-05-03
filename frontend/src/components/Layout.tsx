import { Outlet, Link } from "react-router-dom";
import { Users } from "lucide-react";

export default function Layout() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-indigo-600">
            <div className="bg-indigo-100 p-1.5 rounded-lg">
              <Users size={24} />
            </div>
            <span>LetUsMeet</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-6">
            <Link to="/create" className="text-sm font-medium text-neutral-600 hover:text-indigo-600 transition-colors">
              Create Poll
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-neutral-200 py-8 mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-neutral-500">
          <p>© 2026 LetUsMeet — Simple, frictionless group scheduling.</p>
        </div>
      </footer>
    </div>
  );
}
