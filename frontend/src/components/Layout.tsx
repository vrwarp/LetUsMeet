import { useEffect, useState, useRef } from "react";
import { Outlet, Link, useLocation, useSearchParams } from "react-router-dom";
import { LogIn, LogOut, LayoutDashboard, PlusCircle, ChevronDown, ExternalLink, AlertTriangle, X, Trash2, Key, Loader2, Monitor, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logoImg from "@/assets/meat-lettuce-logo-transparent.webp";
import ScrollToTop from "./ScrollToTop";
import { db } from "@/firebase";
import { 
  getDeviceId, 
  getLocalPublicKey, 
  requestDeviceAuthorization, 
  approveDeviceAuthorization, 
  saveToKeystore 
} from "@/lib/deviceService";
import { 
  generateVerificationCode, 
  exportPrivateKey, 
  exportPublicKey, 
  importSymmetricKey 
} from "@/lib/crypto";
import { 
  loadIdentity, 
  extractKeyFromFragment, 
  loadIdentityFromToken, 
  saveToIndexedDB 
} from "@/lib/pollService";
import { onSnapshot, doc, deleteDoc } from "firebase/firestore";
import type { PendingDevice } from "@/types";

function PendingCodeDisplay({ publicKey }: { publicKey: string }) {
  const [code, setCode] = useState<string>("......");
  useEffect(() => {
    generateVerificationCode(publicKey).then(setCode);
  }, [publicKey]);
  return <>{code}</>;
}

export default function Layout() {
  const [showPhraseInput, setShowPhraseInput] = useState(false);
  const [mnemonicInput, setMnemonicInput] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const { user, loading, keyMismatchError, signInWithGoogle, signOutUser, resetAccount, deleteAccount, recoverWithPhrase, pendingRequests } = useAuth();
  const [isWaitingForAuth, setIsWaitingForAuth] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [isClaimed, setIsClaimed] = useState(false);

  useEffect(() => {
    if (!isWaitingForAuth || !user || !keyMismatchError) return;
    
    const deviceId = getDeviceId();
    const unsub = onSnapshot(doc(db, "users", user.uid, "pending_devices", deviceId), (snap) => {
      if (snap.exists() && snap.data().status === 'authorized') {
        window.location.reload();
      }
    });
    
    return () => unsub();
  }, [isWaitingForAuth, user, keyMismatchError]);

  const handleRequestAuth = async () => {
    try {
      setIsRecovering(true);
      await requestDeviceAuthorization();
      
      const pubKey = await getLocalPublicKey();
      if (pubKey) {
        const code = await generateVerificationCode(pubKey);
        setVerificationCode(code);
      }
      
      setIsWaitingForAuth(true);
    } catch (e) {
      console.error("Failed to request auth:", e);
    } finally {
      setIsRecovering(false);
    }
  };

  const handleApprove = async (req: PendingDevice) => {
    try {
      setApprovingId(req.deviceId);
      await approveDeviceAuthorization(req);
    } catch (e) {
      console.error("Failed to approve device:", e);
      alert("Failed to authorize device.");
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (req: PendingDevice) => {
    try {
      await deleteDoc(doc(db, "users", user!.uid, "pending_devices", req.deviceId));
    } catch (e) {
      console.error("Failed to reject device:", e);
    }
  };
  const [authError, setAuthError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Close menu on navigation
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRecover = async () => {
    setIsRecovering(true);
    try {
      await recoverWithPhrase(mnemonicInput.trim());
      setShowPhraseInput(false);
      setMnemonicInput("");
    } catch (e: any) {
      alert("Recovery failed: " + e.message);
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-brand-charcoal font-sans flex flex-col">
      <ScrollToTop />
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
            <img src={logoImg} alt="" className="h-9 sm:h-10 w-auto transition-transform group-hover:scale-105" />
            <span className="font-display font-bold text-base sm:text-2xl tracking-tight [font-variant:small-caps] block">
              <span className="text-brand-green-dark">Let</span><span className="text-brand-green-dark">Us</span><span className="text-brand-red">Meet</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/create"
              data-testid="create-poll-btn"
              className="flex items-center justify-center gap-2 text-sm font-bold bg-brand-green text-white px-4 py-2 sm:px-6 sm:py-3 rounded-full hover:bg-brand-green-dark transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <PlusCircle size={18} />
              <span className="hidden sm:inline">Create Poll</span>
            </Link>

            {!loading && (
              <div className="flex items-center">
                {user && !user.isAnonymous ? (
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      data-testid="user-profile-btn"
                      className="flex items-center gap-2 p-1 pr-2 sm:pr-3 rounded-full hover:bg-neutral-100 transition-all border border-transparent hover:border-neutral-200 group"
                      aria-expanded={isMenuOpen}
                      aria-haspopup="true"
                    >
                      <div className="flex-shrink-0">
                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            alt=""
                            className="h-8 w-8 sm:h-10 sm:w-10 rounded-full ring-2 ring-brand-green/10 shadow-sm object-cover border border-white"
                          />
                        ) : (
                          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-brand-green/10 text-brand-green-dark flex items-center justify-center font-bold text-sm ring-2 ring-brand-green/10 border border-white">
                            {user.displayName?.[0] || user.email?.[0] || "U"}
                          </div>
                        )}
                      </div>
                      <ChevronDown size={16} className={`text-neutral-400 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-neutral-100 py-2 z-30 animate-fade-in-up overflow-hidden">
                        <div className="px-4 py-3 border-b border-neutral-50 mb-1">
                          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">Signed in as</p>
                          <p className="text-sm font-bold text-brand-charcoal truncate">{user.displayName || user.email}</p>
                          {user.displayName && <p className="text-xs text-neutral-500 truncate">{user.email}</p>}
                        </div>
                        
                        <Link
                          to="/dashboard"
                          data-testid="dashboard-link"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:text-brand-green transition-colors"
                        >
                          <LayoutDashboard size={18} className="text-neutral-400" />
                          Dashboard
                        </Link>
                        
                        <div className="h-px bg-neutral-50 my-1"></div>
                        
                        <button
                          onClick={async () => {
                            if (confirm("CRITICAL WARNING: This will permanently delete your account and all your access keys. You will lose access to all your encrypted polls. This cannot be undone. Are you sure?")) {
                              try {
                                await deleteAccount();
                              } catch (e: any) {
                                alert("Failed to delete account: " + e.message);
                              }
                            }
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-brand-red hover:bg-brand-red/5 transition-colors"
                        >
                          <Trash2 size={18} className="text-brand-red/60" />
                          Delete My Account
                        </button>

                        <div className="h-px bg-neutral-50 my-1"></div>
                        
                        <button
                          onClick={signOutUser}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-brand-red-light/30 hover:text-brand-red transition-colors"
                        >
                          <LogOut size={18} className="text-neutral-400" />
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      setAuthError(null);
                      try {
                        await signInWithGoogle();
                      } catch (e: any) {
                        setAuthError(e.message);
                      }
                    }}
                    data-testid="google-signin-btn"
                    className="flex items-center gap-2 text-sm font-bold text-neutral-700 hover:text-brand-green transition-colors px-4 py-2 rounded-full hover:bg-neutral-100 border border-neutral-200"
                  >
                    <LogIn size={18} />
                    <span>Sign in</span>
                  </button>
                )}
              </div>
            )}
          </nav>
        </div>
      </header>

      {authError && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-100 text-red-600 px-6 py-4 rounded-[2rem] font-medium flex items-start gap-4 shadow-lg shadow-red-100/50">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{authError}</p>
            </div>
            <button onClick={() => setAuthError(null)} className="p-1 hover:bg-red-100 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 w-full">
        {pendingRequests.length > 0 && location.pathname !== "/dashboard" && (
          <div className="max-w-5xl mx-auto px-4 mt-6 animate-fade-in-up" data-testid="pending-auth-request">
            {pendingRequests.map(req => (
              <div key={req.deviceId} className="mb-4 bg-brand-green/10 border-2 border-brand-green/20 p-4 sm:p-6 rounded-[2rem] flex flex-col sm:flex-row items-center gap-4 sm:gap-6 shadow-lg shadow-brand-green/5">
                <div className="w-12 h-12 bg-brand-green/20 text-brand-green rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Monitor size={24} />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-base font-bold text-brand-green-dark">New Device Authorization</h3>
                  <p className="text-brand-green-dark/70 text-xs sm:text-sm">
                    "{req.deviceName}" wants to access your polls.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-white/50 px-3 py-1.5 rounded-lg border border-brand-green/20 font-mono font-bold text-brand-green-dark tracking-wider">
                    <PendingCodeDisplay publicKey={req.publicKey} />
                  </div>
                  <button 
                    onClick={() => handleReject(req)}
                    className="p-2 text-neutral-500 hover:text-brand-red transition-colors"
                    title="Reject"
                  >
                    <X size={20} />
                  </button>
                  <button 
                    onClick={() => handleApprove(req)}
                    disabled={approvingId === req.deviceId}
                    data-testid="approve-auth-btn"
                    className="bg-brand-green text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-brand-green-dark transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(() => {
          const adminToken = searchParams.get("adminToken");
          if (!adminToken || isClaimed) return null;
          const pollIdMatch = location.pathname.match(/\/poll\/([^/]+)/);
          const pollId = pollIdMatch ? pollIdMatch[1] : null;
          
          if (!adminToken || !pollId) return null;
          
          return (
            <div className="max-w-5xl mx-auto px-4 mt-6 animate-fade-in-up" data-testid="claim-banner">
              <div className="mb-8 p-6 bg-brand-green-light/30 border border-brand-green-light rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-green text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand-green/20">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-900">Claim this Poll</h3>
                    <p className="text-sm text-neutral-600">You have the administrative link. Add this poll to your dashboard to manage it from any device.</p>
                  </div>
                </div>
                <button
                  data-testid="claim-button"
                  onClick={async () => {
                    try {
                      console.log("CLAIM DEBUG: Claim button clicked");
                      if (!user || user.isAnonymous) {
                        console.log("CLAIM DEBUG: User not signed in, redirecting to sign in...");
                        await signInWithGoogle();
                        return;
                      }
                      
                      console.log("CLAIM DEBUG: pollId:", pollId, "adminToken:", adminToken);
                      if (!pollId) {
                        console.error("CLAIM DEBUG: No pollId found in path");
                        return;
                      }

                      let id = await loadIdentity(pollId);
                      const symKeyString = extractKeyFromFragment();
                      console.log("CLAIM DEBUG: initial id:", id, "symKeyString present:", !!symKeyString);
                      
                      if (!id && symKeyString) {
                         const symKey = await importSymmetricKey(symKeyString);
                         console.log("CLAIM DEBUG: attempting loadIdentityFromToken...");
                         id = await loadIdentityFromToken(pollId, adminToken, symKey);
                         console.log("CLAIM DEBUG: loadIdentityFromToken result:", id);
                      }

                      if (id && symKeyString) {
                        const priv = await exportPrivateKey(id.privateKey);
                        const pub = await exportPublicKey(id.publicKey);
                        console.log("CLAIM DEBUG: saving to keystore...");
                        try {
                          await saveToKeystore(pollId, {
                            symmetricPollKey: symKeyString,
                            ecdsaPrivateKey: priv,
                            ecdsaPublicKey: pub
                          });
                        } catch (e) {
                          console.warn("CLAIM DEBUG: saveToKeystore failed, falling back to IndexedDB:", e);
                          await saveToIndexedDB(pollId, { 
                            privateKey: priv, 
                            publicKey: pub 
                          });
                        }
                        
                        console.log("CLAIM DEBUG: claim successful, updating state and URL");
                        setIsClaimed(true);
                        setSearchParams(prev => {
                          const next = new URLSearchParams(prev);
                          next.delete("adminToken");
                          return next;
                        }, { replace: true });
                      } else {
                        console.error("CLAIM DEBUG: Failed to recover identity or symKey missing. id:", id, "symKeyString:", !!symKeyString);
                      }
                    } catch (error) {
                      console.error("CLAIM DEBUG: Error during claim process:", error);
                    }
                  }}
                  className="bg-brand-green text-white px-8 py-3 rounded-2xl font-bold hover:bg-brand-green-dark transition-all shadow-md active:scale-95 whitespace-nowrap"
                >
                  Add to My Dashboard
                </button>
              </div>
            </div>
          );
        })()}
        
        <Outlet />
      </main>

      {keyMismatchError && !searchParams.get("adminToken") && (
        <div data-testid="mismatch-error" className="fixed inset-0 z-[200] bg-brand-charcoal/98 backdrop-blur-xl flex items-center justify-center p-6 text-white text-center">
          {!showPhraseInput ? (
            <div className="max-w-md w-full animate-fade-in-up">
              {keyMismatchError.startsWith("UNRECOGNIZED_DEVICE") ? (
                <>
                  <div className="w-20 h-20 bg-brand-green/20 text-brand-green rounded-3xl flex items-center justify-center mx-auto mb-8">
                    <Key size={40} />
                  </div>
                  <h2 className="text-3xl font-black mb-4">Unrecognized Device</h2>
                  <p className="text-neutral-400 mb-8 leading-relaxed">
                    Welcome back! This browser instance hasn't been authorized yet. To access your encrypted polls, please use your recovery phrase.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-8">
                    <AlertTriangle size={40} />
                  </div>
                  <h2 className="text-3xl font-black mb-4">Identity Key Mismatch</h2>
                  <p className="text-neutral-400 mb-8 leading-relaxed">
                    The passkey you just used is different from the one originally used to secure your account. 
                  </p>
                </>
              )}
              
              {isWaitingForAuth ? (
                <div className="py-8">
                  <div className="w-16 h-16 bg-brand-green/20 text-brand-green rounded-full flex items-center justify-center mx-auto mb-6" data-testid="auth-pending-msg">
                    <Loader2 className="animate-spin" size={32} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Waiting for Authorization</h3>
                  <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
                    Please open LetUsMeet on your other device and approve this request.<br/>
                    Confirm the verification code matches:
                  </p>
                  
                  {verificationCode && (
                    <div className="bg-white/10 px-6 py-4 rounded-2xl font-mono text-3xl font-black tracking-[0.5em] text-brand-green mb-8 border border-white/5">
                      {verificationCode}
                    </div>
                  )}
                  <button 
                    onClick={() => setIsWaitingForAuth(false)}
                    className="text-brand-green font-bold text-sm hover:underline"
                  >
                    Cancel Request
                  </button>
                </div>
              ) : (
                <div className="grid gap-4">
                  <button 
                    onClick={() => setShowPhraseInput(true)}
                    className="w-full bg-white text-brand-charcoal py-4 rounded-2xl font-bold hover:bg-neutral-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Key size={18} /> Use Recovery Phrase
                  </button>

                  <button 
                    onClick={handleRequestAuth}
                    disabled={isRecovering}
                    data-testid="request-auth-btn"
                    className="w-full bg-brand-green/10 text-brand-green border border-brand-green/20 py-4 rounded-2xl font-bold hover:bg-brand-green/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isRecovering ? <Loader2 className="animate-spin" size={18} /> : <Monitor size={18} />}
                    Authorize from Another Device
                  </button>

                  <button 
                    onClick={signOutUser}
                    className="w-full bg-neutral-800 text-white border border-white/10 py-4 rounded-2xl font-bold hover:bg-neutral-700 transition-colors"
                  >
                    Sign Out & Try Again
                  </button>
                </div>
              )}

              <div className="pt-4 border-t border-white/10 mt-4">
                <p className="text-sm text-neutral-500 mb-4">Lost your original passkey and phrase?</p>
                <button 
                  onClick={() => {
                    if (confirm("WARNING: This will permanently delete ALL your encrypted polls and reset your account. This cannot be undone. Are you sure?")) {
                      resetAccount();
                    }
                  }}
                  className="w-full bg-red-500/10 text-red-500 border border-red-500/20 py-4 rounded-2xl font-bold hover:bg-red-500/20 transition-colors"
                >
                  Reset My Account & Delete All Data
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-lg w-full animate-fade-in-up">
              <h2 className="text-3xl font-black mb-4">Enter Recovery Phrase</h2>
              <p className="text-neutral-400 mb-8 leading-relaxed">
                Enter your 24-word recovery phrase to restore access to your polls. 
              </p>

              <textarea
                value={mnemonicInput}
                onChange={(e) => setMnemonicInput(e.target.value)}
                placeholder="word1 word2 word3..."
                className="w-full h-32 bg-neutral-800 border border-white/10 rounded-2xl p-4 text-white font-mono text-sm focus:ring-2 focus:ring-brand-green/50 outline-none mb-6"
                disabled={isRecovering}
              />

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowPhraseInput(false)}
                  className="flex-1 bg-neutral-800 text-white py-4 rounded-2xl font-bold hover:bg-neutral-700 transition-colors"
                  disabled={isRecovering}
                >
                  Back
                </button>
                <button 
                  onClick={handleRecover}
                  disabled={isRecovering || !mnemonicInput.trim()}
                  className="flex-[2] bg-brand-green text-white py-4 rounded-2xl font-bold hover:bg-brand-green-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRecovering && <Loader2 className="w-5 h-5 animate-spin" />}
                  Recover Account
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <footer className="border-t border-neutral-200 py-8 mt-auto w-full bg-neutral-50">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-neutral-600 font-medium">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
            <p>© 2026 Benson Tsai • <span className="text-brand-green-dark font-bold">LetUs</span><span className="text-brand-red font-bold">Meet</span></p>
            <div className="flex items-center gap-6">
              <Link to="/privacy" className="hover:text-brand-green transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-brand-green transition-colors">Terms</Link>
            </div>
          </div>
          <a 
            href="https://github.com/vrwarp/LetUsMeet" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-2 hover:text-brand-green transition-all group"
          >
            <ExternalLink size={16} className="text-neutral-400 group-hover:text-brand-green transition-colors" />
            <span>GitHub Repository</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
