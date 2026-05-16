import { useEffect, useState } from "react";
import { signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, db } from "@/firebase";
import { derivePrfMasterKey } from "@/lib/prfService";
import { verifyAmk } from "@/lib/deviceService";
import { resetKeystore } from "@/lib/pollService";

let isSigningIn = false;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isKeyMismatch, setIsKeyMismatch] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (currentUser && !currentUser.isAnonymous) {
          // 1. Ensure PRF is derived (for legacy migration)
          derivePrfMasterKey().catch(e => console.warn("PRF derivation failed", e));
          
          // 2. Verify AMK (Multi-device Key)
          verifyAmk().then((isMatch) => {
            if (!isMatch) {
              setIsKeyMismatch(true);
            }
          }).catch((e) => {
            console.error("AMK verification failed on auth state change", e);
            setIsKeyMismatch(true);
          });
        }
        setUser(currentUser);
        setLoading(false);
        isSigningIn = false;
      } else {
        if (isSigningIn) return;
        isSigningIn = true;
        signInAnonymously(auth).catch((error) => {
          console.error("Anonymous auth failed", error);
          setLoading(false);
          isSigningIn = false;
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);

      if (result.user) {
        // 1. Update user record
        await setDoc(doc(db, "users", result.user.uid), {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        // 2. Immediate Security Flow
        try {
          // Optional: still derive PRF for migration
          await derivePrfMasterKey().catch(() => {});
          
          const isMatch = await verifyAmk();
          if (!isMatch) {
            setIsKeyMismatch(true);
            return;
          }
        } catch (error: any) {
          console.error("Security verification failed during sign-in", error);
          await signOut(auth);
          throw new Error("Zero-Knowledge Security: A device key or recovery phrase is required to access your polls. Please try signing in again.");
        }
      }
    } catch (error) {
      throw error;
    }
  };

  const signOutUser = async () => {
    setIsKeyMismatch(false);
    await signOut(auth);
  };

  const resetAccount = async () => {
    await resetKeystore();
    await signOutUser();
  };

  const deleteAccount = async () => {
    if (!user || user.isAnonymous) return;
    
    const functions = getFunctions();
    const deleteFn = httpsCallable(functions, "deleteUserAccount");
    
    try {
      await deleteFn();
      // After successful deletion, clear local storage and sign out
      localStorage.clear();
      await signOutUser();
    } catch (error) {
      console.error("Account deletion failed:", error);
      throw error;
    }
  };

  return { user, loading, isKeyMismatch, signInWithGoogle, signOutUser, resetAccount, deleteAccount };
}
