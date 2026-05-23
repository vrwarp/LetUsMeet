import { useEffect, useState, useRef } from "react";
import { Outlet, Link, useLocation, useSearchParams, useNavigate, useNavigation } from "react-router-dom";
import { LogIn, LogOut, LayoutDashboard, PlusCircle, ChevronDown, ExternalLink, AlertTriangle, X, Trash2, Loader2, Monitor } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logoImg from "@/assets/meat-lettuce-logo-transparent.webp";
import dataGardenImg from "@/assets/data-garden-compressed.webp";
import ScrollToTop from "./ScrollToTop";
import { 
  getLocalPublicKey, 
  requestDeviceAuthorization, 
  approveDeviceAuthorization,
  generateVerificationCode,
  subscribeCurrentDeviceStatus,
  rejectDeviceRequest
} from "@letusmeet/zero-knowledge";
import type { PendingDevice } from "@/types";

declare global {
  interface Window {
    __APP_STATUS__?: {
      routerIdle: boolean;
    };
  }
}

function PendingCodeDisplay({ publicKey }: { publicKey: string }) {
  const [code, setCode] = useState<string>("......");
  useEffect(() => {
    generateVerificationCode(publicKey).then(setCode);
  }, [publicKey]);
  return <>{code}</>;
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [showPhraseInput, setShowPhraseInput] = useState(false);
  const [mnemonicInput, setMnemonicInput] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const { user, loading, keyMismatchError, signInWithGoogle, signOutUser, resetAccount, deleteAccount, recoverWithPhrase, pendingRequests } = useAuth();
  const [isWaitingForAuth, setIsWaitingForAuth] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [isClaimed, setIsClaimed] = useState(false);
  const [activeAdminToken, setActiveAdminToken] = useState<string | null>(null);

  useEffect(() => {
    window.__APP_STATUS__ = {
      routerIdle: navigation.state === "idle",
    };
  }, [navigation.state]);

  useEffect(() => {
    const token = searchParams.get("adminToken");
    if (token) {
      setActiveAdminToken(token);
      
      const cleanParams = new URLSearchParams(searchParams);
      cleanParams.delete("adminToken");
      const searchString = cleanParams.toString();
      
      navigate({
        pathname: location.pathname,
        search: searchString ? `?${searchString}` : "",
        hash: location.hash
      }, { replace: true });
    }
  }, [searchParams, location.pathname, location.hash, navigate]);

  useEffect(() => {
    if (!isWaitingForAuth || !user || !keyMismatchError) return;
    
    const unsub = subscribeCurrentDeviceStatus(() => {
      window.location.reload();
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
      await rejectDeviceRequest(req.deviceId);
    } catch (e) {
      console.error("Failed to reject device:", e);
    }
  };
  const [authError, setAuthError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
                    "{(req as any).decryptedDeviceName || "Unknown Device"}" wants to access your polls.
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

        <Outlet context={{ activeAdminToken, isClaimed, setIsClaimed }} />
      </main>

      {keyMismatchError && !activeAdminToken && (
        <div data-testid="mismatch-error" className="fixed inset-0 z-[200] bg-neutral-900/40 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 text-center">
          {!showPhraseInput ? (
            <div 
              className="max-w-md w-full max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-y-auto bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-neutral-100/80 text-brand-charcoal animate-fade-in-up flex flex-col relative mx-4 sm:mx-0"
              style={{
                backgroundColor: "#ffffff",
                backgroundImage: "linear-gradient(#f0f4f1 1.5px, transparent 1.5px), linear-gradient(90deg, #f0f4f1 1.5px, transparent 1.5px)",
                backgroundSize: "32px 32px"
              }}
            >
              {/* Illustration Banner */}
              {keyMismatchError.startsWith("UNRECOGNIZED_DEVICE") && (
                <div className="w-full relative aspect-[2.3] sm:aspect-[1.7] flex items-center justify-center bg-white/40 border-b border-neutral-100 p-2 sm:p-4 overflow-hidden">
                  <img 
                    src={dataGardenImg} 
                    alt="Data Garden Illustration" 
                    className="w-full h-full object-contain max-h-[100px] sm:max-h-[190px] drop-shadow-[0_8px_16px_rgba(36,102,39,0.06)]"
                  />
                </div>
              )}

              <div className="p-5 sm:p-10 flex flex-col items-center">
                {keyMismatchError.startsWith("UNRECOGNIZED_DEVICE") ? (
                  <>
                    <span className="sr-only">Unrecognized Device</span>
                    <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight leading-tight">
                      Unlock Your Data Garden
                    </h2>
                    {!isWaitingForAuth && (
                      <p className="text-neutral-500 text-xs sm:text-sm font-medium mt-2.5 leading-relaxed max-w-sm">
                        Your meeting garden is locked. Since it’s fully private, even we can’t unlock it for you! Let’s restore your keys using another device or your recovery phrase.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <span className="sr-only">Identity Key Mismatch</span>
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-50 text-brand-red rounded-2xl sm:rounded-3xl flex items-center justify-center mb-3 border border-red-100 shadow-sm shadow-red-50">
                      <AlertTriangle size={28} />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight leading-tight">
                      Identity Key Mismatch
                    </h2>
                    <p className="text-neutral-500 text-xs sm:text-sm font-medium mt-2.5 leading-relaxed max-w-sm">
                      The passkey you just used is different from the one originally used to secure your account.
                    </p>
                  </>
                )}
                
                {isWaitingForAuth ? (
                  <div className="py-4 sm:py-6 flex flex-col items-center w-full">
                    <div className="w-12 h-12 bg-brand-green/10 text-brand-green rounded-full flex items-center justify-center mb-3" data-testid="auth-pending-msg">
                      <Loader2 className="animate-spin" size={24} />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-neutral-800 mb-1">Waiting for Authorization</h3>
                    <p className="text-neutral-500 text-[11px] sm:text-xs mb-4 leading-relaxed max-w-xs text-center">
                      Please open LetUsMeet on your other device and approve this request.<br/>
                      Confirm the verification code matches:
                    </p>
                    
                    {verificationCode && (
                      <div className="w-full bg-brand-green-light/80 text-brand-green-dark px-4 py-3 sm:px-6 sm:py-4 rounded-xl sm:rounded-2xl font-mono text-3xl font-black tracking-[0.5em] mb-4 border border-brand-green/10 shadow-inner">
                        {verificationCode}
                      </div>
                    )}
                    <button 
                      onClick={() => setIsWaitingForAuth(false)}
                      className="text-brand-green font-bold text-xs sm:text-sm hover:underline hover:text-brand-green-dark transition-colors"
                    >
                      Cancel Request
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-2.5 w-full mt-6 sm:mt-8">
                    <button 
                      onClick={handleRequestAuth}
                      disabled={isRecovering}
                      data-testid="request-auth-btn"
                      className="w-full bg-brand-green text-white py-3 sm:py-3.5 rounded-full font-bold shadow-lg shadow-brand-green/10 hover:bg-brand-green-dark hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-xs sm:text-sm"
                    >
                      {isRecovering ? <Loader2 className="animate-spin" size={16} /> : null}
                      Authorize from Another Device
                    </button>

                    <button 
                      onClick={() => setShowPhraseInput(true)}
                      className="w-full bg-white text-brand-green border-2 border-brand-green py-2.5 sm:py-3 rounded-full font-bold hover:bg-[#edf4f0] hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
                    >
                      Use Recovery Phrase
                    </button>

                    <button 
                      onClick={signOutUser}
                      className="w-full bg-white text-neutral-600 border border-neutral-250 py-2.5 rounded-full font-bold hover:bg-neutral-50 hover:text-neutral-800 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
                    >
                      Sign Out & Try Again
                    </button>
                  </div>
                )}

                <div className="pt-4 border-t border-neutral-100 mt-5 sm:mt-6 w-full flex flex-col items-center">
                  <button 
                    onClick={() => {
                      if (confirm("WARNING: This will permanently delete ALL your encrypted polls and reset your account. This cannot be undone. Are you sure?")) {
                        resetAccount();
                      }
                    }}
                    className="group flex flex-col items-center cursor-pointer"
                  >
                    <span className="text-xs sm:text-sm font-bold text-neutral-500 group-hover:text-brand-red transition-colors">
                      Reset Account
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-neutral-400 mt-0.5 font-medium group-hover:text-brand-red/85 transition-colors">
                      (Warning: Permanent Data Loss)
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div 
              className="max-w-md w-full max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-y-auto bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-neutral-100/80 text-brand-charcoal animate-fade-in-up flex flex-col relative mx-4 sm:mx-0"
              style={{
                backgroundColor: "#ffffff",
                backgroundImage: "linear-gradient(#f0f4f1 1.5px, transparent 1.5px), linear-gradient(90deg, #f0f4f1 1.5px, transparent 1.5px)",
                backgroundSize: "32px 32px"
              }}
            >
              {/* Illustration Banner */}
              <div className="w-full relative aspect-[2.3] sm:aspect-[1.7] flex items-center justify-center bg-white/40 border-b border-neutral-100 p-2 sm:p-4 overflow-hidden">
                <img 
                  src={dataGardenImg} 
                  alt="Data Garden Illustration" 
                  className="w-full h-full object-contain max-h-[100px] sm:max-h-[190px] drop-shadow-[0_8px_16px_rgba(36,102,39,0.06)]"
                />
              </div>

              <div className="p-5 sm:p-10 flex flex-col items-center">
                <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight leading-tight text-center">
                  Enter Recovery Phrase
                </h2>
                <p className="text-neutral-500 text-xs sm:text-sm font-medium mt-2 leading-relaxed text-center px-2">
                  Enter your 24-word recovery phrase to restore access to your encrypted polls. 
                </p>

                <textarea
                  value={mnemonicInput}
                  onChange={(e) => setMnemonicInput(e.target.value)}
                  placeholder="word1 word2 word3..."
                  className="w-full h-24 bg-neutral-50 border border-neutral-200 rounded-xl sm:rounded-2xl p-4 text-neutral-800 font-mono text-xs sm:text-sm focus:ring-2 focus:ring-brand-green/20 outline-none mt-4 mb-4"
                  disabled={isRecovering}
                />

                <div className="flex gap-2.5 w-full">
                  <button 
                    onClick={() => setShowPhraseInput(false)}
                    className="flex-1 bg-white text-neutral-500 border border-neutral-200 py-3 rounded-full font-bold hover:bg-neutral-50 hover:text-neutral-800 transition-all cursor-pointer text-xs sm:text-sm"
                    disabled={isRecovering}
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleRecover}
                    disabled={isRecovering || !mnemonicInput.trim()}
                    className="flex-[2] bg-brand-green text-white py-3 rounded-full font-bold hover:bg-brand-green-dark shadow-lg shadow-brand-green/10 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
                  >
                    {isRecovering && <Loader2 className="w-4 h-4 animate-spin" />}
                    Recover Account
                  </button>
                </div>
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
