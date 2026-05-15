import { useEffect, useState } from "react";
import { signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { derivePrfMasterKey, verifyMasterKey, resetKeystore } from "@/lib/pollService";

let isSigningIn = false;


export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isKeyMismatch, setIsKeyMismatch] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (currentUser && !currentUser.isAnonymous) {
          // Trigger PRF derivation for authenticated users
          derivePrfMasterKey().then(async () => {
            const isMatch = await verifyMasterKey();
            if (!isMatch) {
              setIsKeyMismatch(true);
            }
          }).catch((e) => {
            console.error("Master key derivation failed on auth state change", e);
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

        // 2. Immediate WebAuthn Flow
        try {
          await derivePrfMasterKey();
          const isMatch = await verifyMasterKey();
          if (!isMatch) {
            setIsKeyMismatch(true);
            return; // Don't throw, let UI handle mismatch state
          }
        } catch (webauthnError: any) {
          console.error("WebAuthn verification failed during sign-in", webauthnError);
          await signOut(auth);
          throw new Error("Zero-Knowledge Security: A passkey/WebAuthn verification is required to access your polls and keep your data private. Please try signing in again and complete the security prompt.");
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

  return { user, loading, isKeyMismatch, signInWithGoogle, signOutUser, resetAccount };
}
