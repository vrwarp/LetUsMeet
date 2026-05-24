import { useEffect, useState } from "react";
import { signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, db } from "@/firebase";
import {
  clearPrfSessionCache,
  verifyAmk, clearAmkSessionCache, subscribePendingRequests, recoverAmkWithPhrase, registerCurrentDevice,
  getActiveAmk, loadDeviceKeysFromIndexedDB, hasAccountKeys
} from "@letusmeet/zero-knowledge";
import { resetKeystore } from "@/lib/pollService";
import type { PendingDevice } from "@/types";

let isSigningIn = false;
let lastUid: string | null = null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyMismatchError, setKeyMismatchError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingDevice[]>([]);
  const [isDeviceRegistered, setIsDeviceRegistered] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const currentUid = currentUser ? currentUser.uid : null;
      if (currentUid !== lastUid) {
        lastUid = currentUid;
        // Clear session caches only on actual user change to prevent cross-session leakage and race conditions
        clearAmkSessionCache();
        clearPrfSessionCache();
      }

      if (currentUser) {
        if (currentUser && !currentUser.isAnonymous) {
          // Check if device keys are loaded, meaning it has successfully completed registration
          const localKeys = await loadDeviceKeysFromIndexedDB();
          if (localKeys) {
            verifyAmk().then((isMatch) => {
              if (!isMatch) {
                console.warn(`[Auth] AMK verification failed for ${currentUser.uid}: unrecognized device.`);
                setKeyMismatchError("UNRECOGNIZED_DEVICE: Device not authorized.");
              } else {
                console.log(`[Auth] AMK verified successfully for ${currentUser.uid}.`);
                setIsDeviceRegistered(true);
              }
              setUser(currentUser);
              setLoading(false);
            }).catch((e) => {
              console.error("AMK verification failed on auth state change", e);
              setKeyMismatchError(e.message || "UNRECOGNIZED_DEVICE");
              setUser(currentUser);
              setLoading(false);
            });
          } else {
            // Keys are missing. Check if the user already has secure keys on the server!
            hasAccountKeys().then((hasKeys) => {
              if (hasKeys) {
                // User has registered keys. Try to verify/recover silently via PRF first!
                verifyAmk().then((isMatch) => {
                  if (!isMatch) {
                    console.warn(`[Auth] AMK verification failed for ${currentUser.uid}: unrecognized device.`);
                    setKeyMismatchError("UNRECOGNIZED_DEVICE: Device not authorized.");
                  } else {
                    console.log(`[Auth] AMK verified successfully via silent PRF recovery for ${currentUser.uid}.`);
                    setIsDeviceRegistered(true);
                  }
                  setUser(currentUser);
                  setLoading(false);
                }).catch((e) => {
                  console.error("AMK verification failed on auth state change (missing local keys)", e);
                  setKeyMismatchError(e.message || "UNRECOGNIZED_DEVICE");
                  setUser(currentUser);
                  setLoading(false);
                });
              } else {
                setIsDeviceRegistered(false);
                setUser(currentUser);
                setLoading(false);
              }
            }).catch((e) => {
              console.error("Failed to check server account keys", e);
              setIsDeviceRegistered(false);
              setUser(currentUser);
              setLoading(false);
            });
          }
        } else {
          setUser(currentUser);
          setLoading(false);
        }
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

    const unsubscribe = subscribePendingRequests((requests) => {
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
    const { amk, amkId } = await recoverAmkWithPhrase(mnemonic);
    await registerCurrentDevice(amk, amkId);
    setKeyMismatchError(null);
  };

  const enrollDevice = async () => {
    try {
      await getActiveAmk();
      setIsDeviceRegistered(true);
      setKeyMismatchError(null);
    } catch (e: any) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        // Keep keyMismatchError null for canceled enrollment prompts
      } else {
        setKeyMismatchError(e.message || "UNRECOGNIZED_DEVICE");
      }
      throw e;
    }
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
    pendingRequests,
    isDeviceRegistered,
    enrollDevice
  };
}
