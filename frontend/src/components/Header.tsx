"use client";

import Link from "next/link";
import Image from "next/image";
import { LogIn, LogOut, LayoutDashboard, PlusCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logoImg from "@/assets/logo-transparent.webp";

export default function Header() {
  const { user, loading, signInWithGoogle, signOutUser } = useAuth();

  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-10 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Image src={logoImg} alt="LetUsMeet" className="h-14 w-auto transition-transform group-hover:scale-105" priority />
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/create"
            data-testid="create-poll-btn"
            className="flex items-center gap-2 text-sm font-bold bg-brand-green text-white px-5 py-2.5 rounded-full hover:bg-brand-green-dark transition-all shadow-md hover:shadow-lg active:scale-95 hidden sm:flex"
          >
            <PlusCircle size={18} />
            <span>Create Poll</span>
          </Link>

          {!loading && (
            <>
              {user && !user.isAnonymous ? (
                <div className="flex items-center gap-3">
                  <Link
                    href="/dashboard"
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
                  className="flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-brand-green transition-colors px-3 py-2 rounded-full hover:bg-neutral-100"
                >
                  <LogIn size={18} />
                  <span>Sign in</span>
                </button>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
