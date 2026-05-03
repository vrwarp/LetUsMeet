import { useEffect, useState } from "react";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "@/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Anonymous auth failed", error);
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}
