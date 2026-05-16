import { useEffect, useState } from "react";
import { signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, db } from "@/firebase";
import { derivePrfMasterKey } from "@/lib/prfService";
import { verifyAmk, getDeviceId } from "@/lib/deviceService";
import { resetKeystore } from "@/lib/pollService";
import type { PendingDevice } from "@/types";
import { collection, onSnapshot, query, where } from "firebase/firestore";

let isSigningIn = false;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyMismatchError, setKeyMismatchError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingDevice[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (currentUser && !currentUser.isAnonymous) {
          verifyAmk().then((isMatch) => {
            if (!isMatch) {
              console.warn(`[Auth] AMK verification failed for ${currentUser.uid}: unrecognized device.`);
              setKeyMismatchError("UNRECOGNIZED_DEVICE: Device not authorized.");
            } else {
              console.log(`[Auth] AMK verified successfully for ${currentUser.uid}.`);
            }
          }).catch((e) => {
            console.error("AMK verification failed on auth state change", e);
            setKeyMismatchError(e.message || "UNRECOGNIZED_DEVICE");
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

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setPendingRequests([]);
      return;
    }

    // Only listen for devices that ARE NOT the current device
    const currentDeviceId = getDeviceId();
    const q = query(
      collection(db, "users", user.uid, "pending_devices"),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const now = Date.now();
      const requests = snap.docs
        .map(d => d.data() as PendingDevice)
        .filter(d => d.deviceId !== currentDeviceId && (!d.expiresAt || d.expiresAt > now));
      setPendingRequests(requests);
    });

    return () => unsubscribe();
  }, [user]);

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

        // 2. Immediate Security Flow (Optional, handled by onAuthStateChanged)
        try {
          // Optional: still derive PRF for migration
          await derivePrfMasterKey().catch(() => { });
        } catch (error: any) {
          console.error("Security verification failed during sign-in", error);
        }
      }
    } catch (error) {
      throw error;
    }
  };

  const signOutUser = async () => {
    setKeyMismatchError(null);
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

  const recoverWithPhrase = async (mnemonic: string) => {
    const { recoverAmkWithPhrase } = await import("@/lib/recoveryService");
    const { registerCurrentDevice } = await import("@/lib/deviceService");

    const { amk, amkId } = await recoverAmkWithPhrase(mnemonic);
    await registerCurrentDevice(amk, amkId);
    setKeyMismatchError(null);
  };

  return {
    user,
    loading,
    keyMismatchError,
    signInWithGoogle,
    signOutUser,
    resetAccount,
    deleteAccount,
    recoverWithPhrase,
    pendingRequests
  };
}
