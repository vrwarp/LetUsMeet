import { Outlet, Link } from "react-router-dom";
import { Users, LogIn, LogOut, User as UserIcon } from "lucide-react";
import { auth, googleProvider, db } from "@/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, type User, GoogleAuthProvider } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useState, useEffect } from "react";

export default function Layout() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
      googleProvider.addScope('https://www.googleapis.com/auth/calendar.readonly');

      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      if (credential && result.user) {
        const userRef = doc(db, "users", result.user.uid);
        const tokenData: any = {
          googleTokens: {
            accessToken: credential.accessToken,
            expiryDate: Date.now() + 3600 * 1000, // Roughly 1 hour
          },
          email: result.user.email,
          displayName: result.user.displayName,
          updatedAt: serverTimestamp(),
        };

        // Note: refresh token is only available if access_type=offline is requested
        // and it's the first time the user grants permission.
        // For simplicity in this demo, we assume we might get it.
        // To be sure, you'd add custom parameters to googleProvider.
        const oauthCredential = credential as any;
        if (oauthCredential.refreshToken) {
          tokenData.googleTokens.refreshToken = oauthCredential.refreshToken;
        }

        await setDoc(userRef, tokenData, { merge: true });
      }
    } catch (error) {
      console.error("Sign in failed", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out failed", error);
    }
  };

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
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 rounded-full border border-neutral-200">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || ""} className="w-5 h-5 rounded-full" />
                  ) : (
                    <UserIcon size={14} className="text-neutral-500" />
                  )}
                  <span className="text-sm font-semibold text-neutral-700">{user.displayName || user.email}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  aria-label="Sign out"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm"
              >
                <LogIn size={16} />
                Sign in
              </button>
            )}
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
