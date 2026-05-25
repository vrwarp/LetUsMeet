import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { subscribeToUserKeystore, getLedgerSession, archiveKeystoreEntry, unarchiveKeystoreEntry } from "@/lib/pollService";
import {
  getRecoveryStatus,
  enablePrfRecovery,
  getDeviceId,
  approveDeviceAuthorization,
  revokeDevice,
  generateVerificationCode,
  setupPhraseRecovery,
  subscribeAuthorizedDevices,
  rejectDeviceRequest
} from "@letusmeet/zero-knowledge";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Calendar, MapPin, ExternalLink, Activity, Lock, ShieldCheck, Clipboard, CheckCircle2, Monitor, XCircle, User, Users, Fingerprint, Key, Archive, ArchiveRestore, ChevronDown } from "lucide-react";
import type { PollMetadata, PendingDevice } from "../types";

function PendingCodeDisplay({ publicKey }: { publicKey: string }) {
  const [code, setCode] = useState<string>("......");
  useEffect(() => {
    generateVerificationCode(publicKey).then(setCode);
  }, [publicKey]);
  return <>{code}</>;
}

interface DecryptedDashboardEntry {
  pollId: string;
  symmetricKey: string;
  metadata: PollMetadata;
  isOrganizer: boolean;
  isArchived?: boolean;
}

export default function DashboardPage() {
  const { user, loading, pendingRequests } = useAuth();
  const [entries, setEntries] = useState<DecryptedDashboardEntry[]>([]);
  
  const activeEntries = entries.filter(e => !e.isArchived);
  const archivedEntries = entries.filter(e => e.isArchived);
  const hasArchivedPolls = archivedEntries.length > 0;
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false);
  
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const handleArchive = async (pollId: string, title: string) => {
    const entry = activeEntries.find(e => e.pollId === pollId);
    const isOrganizer = entry?.isOrganizer;
    const warningMsg = isOrganizer
      ? `Archive poll "${title}"?\n\nThis will hide the poll from your main dashboard. Because you are the Organizer, you will not be able to manage, edit, or close this poll unless you restore it from the Archive section first.`
      : `Archive poll "${title}"?\n\nThis will hide the poll from your main dashboard view. You can restore it and adjust your responses at any time from the Archive section at the bottom.`;

    if (!window.confirm(warningMsg)) return;

    try {
      setActionInProgress(pollId);
      await archiveKeystoreEntry(pollId);
    } catch (e) {
      console.error("Failed to archive poll:", e);
      alert("Failed to archive poll.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUnarchive = async (pollId: string) => {
    try {
      setActionInProgress(pollId);
      await unarchiveKeystoreEntry(pollId);
    } catch (e) {
      console.error("Failed to restore poll:", e);
      alert("Failed to restore poll.");
    } finally {
      setActionInProgress(null);
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") === "participant") ? "participant" : "organizer";

  const setActiveTab = (tab: "organizer" | "participant") => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", tab);
    setSearchParams(newParams);
  };
  const [fetching, setFetching] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);
  const [accountData, setAccountData] = useState<any>(null);
  const [showRotationSuccess, setShowRotationSuccess] = useState(false);


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
  const [recoveryStatus, setRecoveryStatus] = useState<{ isSealed: boolean, methods: string[] }>({ isSealed: false, methods: [] });
  const [enablingRecovery, setEnablingRecovery] = useState(false);

  const [showPhraseModal, setShowPhraseModal] = useState(false);
  const [generatedMnemonic, setGeneratedMnemonic] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeModal, setActiveModal] = useState<"passkey" | "backup" | "devices" | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const passkeyRef = useRef<any>(null);
  const backupRef = useRef<any>(null);
  const masterRef = useRef<HTMLDivElement>(null);
  const deviceRefs = useRef<{ [key: string]: any }>({});

  const [paths, setPaths] = useState<{
    passkey: string;
    backup: string;
    devices: { [key: string]: string };
  }>({ passkey: '', backup: '', devices: {} });

  const updatePaths = useCallback(() => {
    if (!containerRef.current || !masterRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const masterRect = masterRef.current.getBoundingClientRect();
    
    const masterY = (masterRect.top - containerRect.top) + masterRect.height / 2;
    const masterLeftX = masterRect.left - containerRect.left;
    const masterRightX = masterRect.right - containerRect.left;
    
    const isMobile = window.innerWidth < 768;
    
    let passkeyPath = '';
    if (passkeyRef.current) {
      const rect = passkeyRef.current.getBoundingClientRect();
      const centerX = (rect.left - containerRect.left) + rect.width / 2;
      const x = isMobile ? centerX + 24 : rect.right - containerRect.left;
      const y = (rect.top - containerRect.top) + rect.height / 2;
      passkeyPath = `M ${x} ${y} C ${(x + masterLeftX) / 2} ${y}, ${(x + masterLeftX) / 2} ${masterY}, ${masterLeftX} ${masterY}`;
    }
    
    let backupPath = '';
    if (backupRef.current) {
      const rect = backupRef.current.getBoundingClientRect();
      const centerX = (rect.left - containerRect.left) + rect.width / 2;
      const x = isMobile ? centerX + 24 : rect.right - containerRect.left;
      const y = (rect.top - containerRect.top) + rect.height / 2;
      backupPath = `M ${x} ${y} C ${(x + masterLeftX) / 2} ${y}, ${(x + masterLeftX) / 2} ${masterY}, ${masterLeftX} ${masterY}`;
    }
    
    const devicesPaths: { [key: string]: string } = {};
    const devices = accountData?.devices ? Object.values(accountData.devices) : [];
    devices.forEach((device: any) => {
      const el = deviceRefs.current[device.deviceId];
      if (el) {
        const rect = el.getBoundingClientRect();
        const centerX = (rect.left - containerRect.left) + rect.width / 2;
        const x = isMobile ? centerX - 24 : rect.left - containerRect.left;
        const y = (rect.top - containerRect.top) + rect.height / 2;
        devicesPaths[device.deviceId] = `M ${masterRightX} ${masterY} C ${(masterRightX + x) / 2} ${masterY}, ${(masterRightX + x) / 2} ${y}, ${x} ${y}`;
      }
    });
    
    setPaths(prev => {
      const changed = 
        prev.passkey !== passkeyPath ||
        prev.backup !== backupPath ||
        Object.keys(prev.devices).length !== Object.keys(devicesPaths).length ||
        Object.keys(devicesPaths).some(key => prev.devices[key] !== devicesPaths[key]);
      
      if (!changed) return prev;
      return {
        passkey: passkeyPath,
        backup: backupPath,
        devices: devicesPaths
      };
    });
  }, [accountData]);

  useEffect(() => {
    // 1. Initial draw scheduled on the next browser paint cycle
    const frame = requestAnimationFrame(updatePaths);
    
    // 2. React to font loading reflows using standard Fonts API
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(updatePaths);
    }
    
    // 3. Dynamic ResizeObserver to watch for layout viewport changes
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(() => {
        updatePaths();
      });
      observer.observe(containerRef.current);
    }
    
    // 4. Single short-term fallback timer to capture state transition settles
    const timer = setTimeout(updatePaths, 150);
    
    window.addEventListener('resize', updatePaths);
    
    return () => {
      cancelAnimationFrame(frame);
      if (observer) {
        observer.disconnect();
      }
      clearTimeout(timer);
      window.removeEventListener('resize', updatePaths);
    };
  }, [accountData, recoveryStatus, fetching, loading, updatePaths]);

  useEffect(() => {
    if (loading || !user || user.isAnonymous) {
      setFetching(false);
      return;
    }

    setFetching(true);

    // Listen to account keys using clean facade
    const unsubAccount = subscribeAuthorizedDevices((devices) => {
      const devicesRecord: Record<string, any> = {};
      for (const dev of devices) {
        devicesRecord[dev.deviceId] = dev;
      }
      setAccountData({ devices: devicesRecord } as any);
      getRecoveryStatus().then(setRecoveryStatus);
    });

const unsubscribe = subscribeToUserKeystore(async (keystoreEntries) => {
      const decryptedResults = await Promise.all(
        keystoreEntries.map(async (entry) => {
          try {
            if (!entry.ledgerId) return null;
            const session = await getLedgerSession(entry.ledgerId);
            const genesis = await session.getGenesisEvent();
            if (genesis?.action?.type === "POLL_CREATED") {
              const isOrganizer = session.getSignerPublicKey() === genesis.signerPublicKey;
              return {
                pollId: entry.ledgerId,
                symmetricKey: session.exportSessionKey(),
                metadata: genesis.action.payload,
                isOrganizer,
                isArchived: entry.isArchived
              } as DecryptedDashboardEntry;
            }
          } catch (e) {
            console.warn("Failed to decrypt dashboard entry", entry.ledgerId, e);
          }
          return null;
        })
      );

      const decryptedEntries = decryptedResults.filter(
        (entry): entry is DecryptedDashboardEntry => entry !== null
      );

      setEntries(decryptedEntries);
      setFetching(false);
    });

    return () => {
      unsubAccount();
      unsubscribe();
    };
  }, [user, loading]);

  const handleEnableRecovery = async () => {
    setEnablingRecovery(true);
    try {
      await enablePrfRecovery();
      const status = await getRecoveryStatus();
      setRecoveryStatus(status);
    } catch (e) {
      console.error("Failed to enable recovery:", e);
      alert("Failed to enable recovery. Make sure your browser supports passkeys and you have one set up.");
    } finally {
      setEnablingRecovery(false);
    }
  };

  const handleGeneratePhrase = async () => {
    setEnablingRecovery(true);
    try {
      const phrase = await setupPhraseRecovery();
      setGeneratedMnemonic(phrase);
      setShowPhraseModal(true);
      const status = await getRecoveryStatus();
      setRecoveryStatus(status);
    } catch (e) {
      console.error("Failed to setup phrase recovery:", e);
      alert("Failed to setup phrase recovery.");
    } finally {
      setEnablingRecovery(false);
    }
  };

  const handleRevoke = async (deviceId: string) => {
    if (!confirm("Are you sure you want to revoke this device? It will lose access to all your polls immediately.")) return;
    try {
      await revokeDevice(deviceId);
      setShowRotationSuccess(true);
      setTimeout(() => setShowRotationSuccess(false), 5000);
    } catch (e) {
      console.error("Failed to revoke device:", e);
      alert("Failed to revoke device.");
    }
  };

  const copyToClipboard = () => {
    if (generatedMnemonic) {
      navigator.clipboard.writeText(generatedMnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-brand-green animate-spin" />
        <p className="text-neutral-500 font-medium">Decrypting your dashboard...</p>
      </div>
    );
  }

  if (!user || user.isAnonymous) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="bg-neutral-50 rounded-[3rem] p-10 border border-neutral-100">
          <Lock className="w-12 h-12 text-neutral-300 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-neutral-800 mb-4">Organizer Access Only</h2>
          <p className="text-neutral-600 mb-8">Sign in with Google to sync your polls across devices and access your dashboard.</p>
          <Link to="/" className="btn-primary-green inline-block">Back to Home</Link>
        </div>
      </div>
    );
  }

  const hasPhrase = recoveryStatus.methods.some(m => m.toLowerCase().includes("phrase"));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* E2E Test Compatibility Hook */}
      <div data-testid="recovery-status" className="hidden">
        {recoveryStatus.methods.map((method, i) => (
          <span key={i}>{method} Active</span>
        ))}
      </div>

      {/* 1. Polls Section (at the very top) */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-6 px-3 sm:px-4">
        <div>
          <h1 data-testid="dashboard-title" className="text-4xl font-black text-neutral-900 tracking-tight">Your Polls</h1>
          <p className="text-neutral-500 font-medium">Manage and view your meeting schedules</p>
        </div>
      </div>

      {activeEntries.length === 0 ? (
        <div className="bg-white p-12 rounded-[3rem] border border-neutral-100 text-center shadow-xl shadow-neutral-100/50">
          <div className="w-16 h-16 bg-brand-green-light/30 text-brand-green rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Calendar size={32} />
          </div>
          <h2 className="text-xl font-bold text-neutral-800 mb-2">No polls</h2>
          <p className="text-neutral-500 max-w-md mx-auto mb-8 font-medium">
            Created polls will appear here automatically when you're signed in.
          </p>
          <Link to="/create" className="btn-primary-green inline-block">
            Create New Poll
          </Link>
        </div>
      ) : (
        <>
          {/* Beautiful and responsive tab navigation */}
          <div className="border-b border-neutral-100 mb-6">
            <div className="grid grid-cols-2 sm:flex gap-4 sm:gap-6 px-3 sm:px-4 -mb-px">
            <button
              onClick={() => setActiveTab("organizer")}
              data-testid="tab-organizer"
              className={`pb-3 sm:pb-4 font-black text-sm sm:text-lg transition-all border-b-2 relative flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 focus:outline-none whitespace-nowrap ${
                activeTab === "organizer"
                  ? "text-brand-green border-brand-green"
                  : "text-neutral-400 border-transparent hover:text-neutral-600"
              }`}
            >
              <User size={18} />
              <span>Organized by Me</span>
              <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
                activeTab === "organizer" ? "bg-brand-green/10 text-brand-green" : "bg-neutral-100 text-neutral-500"
              }`}>
                {activeEntries.filter(e => e.isOrganizer).length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("participant")}
              data-testid="tab-participant"
              className={`pb-3 sm:pb-4 font-black text-sm sm:text-lg transition-all border-b-2 relative flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 focus:outline-none whitespace-nowrap ${
                activeTab === "participant"
                  ? "text-brand-green border-brand-green"
                  : "text-neutral-400 border-transparent hover:text-neutral-600"
              }`}
            >
              <Users size={18} />
              <span>Joined & Voted</span>
              <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
                activeTab === "participant" ? "bg-brand-green/10 text-brand-green" : "bg-neutral-100 text-neutral-500"
              }`}>
                {activeEntries.filter(e => !e.isOrganizer).length}
              </span>
            </button>
          </div>
        </div>

          {activeTab === "organizer" && activeEntries.filter(e => e.isOrganizer).length === 0 ? (
            <div className="bg-white p-12 rounded-[3rem] border border-neutral-100 text-center shadow-xl shadow-neutral-100/50 mb-10">
              <div className="w-16 h-16 bg-neutral-50 text-neutral-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Calendar size={32} />
              </div>
              <h2 className="text-xl font-bold text-neutral-800 mb-2 font-black">No Organized Polls</h2>
              <p className="text-neutral-500 max-w-md mx-auto mb-8 font-medium">
                You haven't organized any polls yet. Tap below to create your first meeting poll!
              </p>
              <Link to="/create" className="btn-primary-green inline-block">
                Create New Poll
              </Link>
            </div>
          ) : activeTab === "participant" && activeEntries.filter(e => !e.isOrganizer).length === 0 ? (
            <div className="bg-white p-12 rounded-[3rem] border border-neutral-100 text-center shadow-xl shadow-neutral-100/50 mb-10">
              <div className="w-16 h-16 bg-neutral-50 text-neutral-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Users size={32} />
              </div>
              <h2 className="text-xl font-bold text-neutral-800 mb-2 font-black">No Joined Polls</h2>
              <p className="text-neutral-500 max-w-md mx-auto mb-8 font-medium">
                Polls you view, vote in, or participate in will automatically be stored securely and displayed here.
              </p>
            </div>
          ) : (
            <div className="grid gap-6">
              {activeEntries
                .filter(e => (activeTab === "organizer" ? e.isOrganizer : !e.isOrganizer))
                .map((entry) => (
                  <div key={entry.pollId} className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-neutral-100 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <h2 className="text-xl sm:text-2xl font-black text-neutral-800 group-hover:text-brand-green transition-colors">{entry.metadata.title}</h2>
                          {entry.isOrganizer ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-brand-green/10 text-brand-green-dark border border-brand-green/20">
                              <User size={12} />
                              Organizer
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                              <Users size={12} />
                              Participant
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-5 text-sm font-bold text-neutral-400">
                          {entry.metadata.location && (
                            <div className="flex items-center gap-2">
                              <MapPin size={16} className="text-neutral-300" />
                              <span>{entry.metadata.location}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Activity size={16} className="text-neutral-300" />
                            <span>{entry.metadata.schedulingMode === "EXACT" ? "Exact Times" : "Flexible Windows"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3">
                        <button
                          onClick={() => handleArchive(entry.pollId, entry.metadata.title)}
                          disabled={actionInProgress === entry.pollId}
                          className="p-2.5 sm:p-3 text-neutral-400 hover:text-red-500 rounded-xl sm:rounded-2xl border border-neutral-100 hover:border-red-100 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Archive Poll"
                        >
                          <Archive size={18} />
                        </button>
                        <Link
                          to={`/poll/${entry.pollId}#key=${entry.symmetricKey}`}
                          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-neutral-50 text-neutral-600 rounded-xl sm:rounded-2xl font-bold hover:bg-neutral-100 transition-colors text-sm sm:text-base whitespace-nowrap"
                        >
                          View
                        </Link>
                        <Link
                          to={`/poll/${entry.pollId}/results#key=${entry.symmetricKey}`}
                          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-brand-green text-white rounded-xl sm:rounded-2xl font-bold hover:bg-brand-green-dark flex items-center gap-1.5 sm:gap-2 shadow-lg shadow-brand-green/20 transition-all hover:scale-[1.02] text-sm sm:text-base whitespace-nowrap"
                        >
                          <ExternalLink size={16} /> Results
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {/* 2. Archived Polls Section */}
      {hasArchivedPolls && (
        <div className="mt-8 bg-neutral-50/50 border border-neutral-100 rounded-[2.5rem] p-6 sm:p-8 mb-10">
          <button
            onClick={() => setIsArchivedExpanded(!isArchivedExpanded)}
            className="flex items-center justify-between w-full text-left focus:outline-none group/btn cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Archive className="text-neutral-400 group-hover/btn:text-brand-green transition-colors" size={24} />
              <div>
                <h3 className="text-xl font-black text-neutral-800 group-hover/btn:text-brand-green transition-colors">Archived Polls</h3>
                <p className="text-sm font-medium text-neutral-400">These polls are hidden from your active lists. You can restore them to your active dashboard at any time.</p>
              </div>
            </div>
            <div className={`p-2 bg-white rounded-xl border border-neutral-100 text-neutral-400 group-hover/btn:text-brand-green group-hover/btn:border-brand-green/20 transition-all duration-200 ${isArchivedExpanded ? 'rotate-180 text-brand-green' : ''}`}>
              <ChevronDown size={20} />
            </div>
          </button>

          {isArchivedExpanded && (
            <div className="grid gap-4 mt-6 animate-fade-in-down">
              {archivedEntries.map((entry) => (
                <div key={entry.pollId} className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[1.5rem] border border-neutral-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="text-lg font-bold text-neutral-700">{entry.metadata.title}</h4>
                      {entry.isOrganizer ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-green/10 text-brand-green font-black">
                          Organizer
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600">
                          Participant
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-neutral-400">
                      Location: {entry.metadata.location || "None"} • Mode: {entry.metadata.schedulingMode === "EXACT" ? "Exact Times" : "Flexible"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                    <button
                      onClick={() => handleUnarchive(entry.pollId)}
                      disabled={actionInProgress === entry.pollId}
                      className="p-2 text-neutral-400 hover:text-brand-green rounded-xl border border-neutral-100 hover:border-brand-green/20 hover:bg-brand-green/5 transition-colors disabled:opacity-50"
                      title="Restore to Active Dashboard"
                    >
                      <ArchiveRestore size={16} />
                    </button>
                    <Link
                      to={`/poll/${entry.pollId}#key=${entry.symmetricKey}`}
                      className="px-3 py-1.5 bg-neutral-50 text-neutral-600 rounded-xl font-bold hover:bg-neutral-100 transition-colors text-xs"
                    >
                      View
                    </Link>
                    <Link
                      to={`/poll/${entry.pollId}/results#key=${entry.symmetricKey}`}
                      className="px-3 py-1.5 bg-brand-green text-white rounded-xl font-bold hover:bg-brand-green-dark transition-colors text-xs"
                    >
                      Results
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Spacing / Divider */}
      <hr className="my-8 border-t border-neutral-100" />

      {/* 2. Security & Devices Section (at the bottom) */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 px-3 sm:px-4">
          <div>
            <h2 className="text-3xl font-black text-neutral-900 tracking-tight">Security & Devices</h2>
            <p className="text-neutral-500 font-medium">Manage your cryptographic keys, recovery backups, and authorized devices</p>
          </div>
          {showRotationSuccess && (
            <div data-testid="rotation-success-toast" className="bg-brand-green text-white px-4 py-2 rounded-xl text-sm font-bold animate-fade-in-up self-start sm:self-auto">
              AMK Rotated & Devices Migrated!
            </div>
          )}
        </div>

        {/* Access Requests Banners */}
        {pendingRequests.length > 0 && (
          <div className="space-y-4 mb-6">
            {pendingRequests.map(req => (
              <div key={req.deviceId} data-testid="pending-auth-request" className="bg-amber-50 border border-amber-200 p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Monitor size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900 text-sm">Authorize New Device?</h4>
                    <p className="text-amber-800 text-xs mt-0.5 font-semibold">
                      "{(req as any).decryptedDeviceName || "Unknown Device"}" wants access. Confirm code: <span className="font-mono font-bold bg-amber-100 px-2 py-0.5 rounded ml-1"><PendingCodeDisplay publicKey={req.publicKey} /></span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleReject(req)}
                    disabled={!isReady}
                    data-testid="reject-auth-btn"
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-white text-neutral-600 rounded-xl text-xs font-bold hover:bg-neutral-50 transition-colors border border-neutral-100"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(req)}
                    disabled={!isReady || approvingId === req.deviceId}
                    data-testid="approve-auth-btn"
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-brand-green text-white rounded-xl text-xs font-black hover:bg-brand-green-dark transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {approvingId === req.deviceId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Security Key Topology Map Container */}
        <div className="bg-white border border-neutral-100 rounded-[2rem] p-6 sm:p-8 shadow-sm overflow-hidden">
          {/* Desktop View: Interactive visual topology web */}
          <div ref={containerRef} className="grid grid-cols-3 gap-2 sm:gap-6 items-center relative px-1 sm:px-6">
            {/* SVG Connector Lines Overlay */}
            <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none block" xmlns="http://www.w3.org/2000/svg">
              {/* Biometric Passkey (top-left) to Master Key (center) */}
              {paths.passkey && (
                recoveryStatus.isSealed ? (
                  <>
                    {/* Base Track */}
                    <path d={paths.passkey} stroke="#22C55E" strokeWidth="1.2" strokeLinecap="round" fill="none" className="opacity-15" />
                    {/* Glowing Pulse */}
                    <path d={paths.passkey} stroke="#22C55E" strokeWidth="1.5" strokeDasharray="30 130" strokeLinecap="round" fill="none" className="opacity-95 animate-line-pulse" style={{ animationDelay: '0s' }} />
                  </>
                ) : (
                  <>
                    {/* Warning Base Track */}
                    <path d={paths.passkey} stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round" fill="none" className="opacity-20 animate-pulse" />
                    {/* Warning Pulse */}
                    <path d={paths.passkey} stroke="#EF4444" strokeWidth="1.5" strokeDasharray="2 4" strokeLinecap="round" fill="none" className="opacity-75 animate-pulse" />
                  </>
                )
              )}
              
              {/* Cold Backup (bottom-left) to Master Key (center) */}
              {paths.backup && (
                hasPhrase ? (
                  <>
                    {/* Secured Base Track */}
                    <path d={paths.backup} stroke="#22C55E" strokeWidth="1.2" strokeLinecap="round" fill="none" className="opacity-15" />
                    {/* Secured Pulse */}
                    <path d={paths.backup} stroke="#22C55E" strokeWidth="1.5" strokeDasharray="30 130" strokeLinecap="round" fill="none" className="opacity-95 animate-line-pulse" style={{ animationDelay: '-1.5s' }} />
                  </>
                ) : (
                  <>
                    {/* Pending Warning Base Track */}
                    <path d={paths.backup} stroke="#F59E0B" strokeWidth="1.2" strokeLinecap="round" fill="none" className="opacity-20 animate-pulse" />
                    {/* Pending Warning Inactive Pulse */}
                    <path d={paths.backup} stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="2 4" strokeLinecap="round" fill="none" className="opacity-75 animate-pulse" />
                  </>
                )
              )}
              
              {/* Master Key (center) to Active Devices (right) */}
              {(() => {
                const devicesList = accountData?.devices ? Object.values(accountData.devices) : [];
                return devicesList.map((device: any, index: number) => {
                  const p = paths.devices[device.deviceId];
                  if (!p) return null;
                  return (
                    <g key={device.deviceId}>
                      {/* Active Endpoint Base Track */}
                      <path d={p} stroke="#22C55E" strokeWidth="1.2" strokeLinecap="round" fill="none" className="opacity-15" />
                      {/* Active Endpoint Glowing Pulse */}
                      <path d={p} stroke="#22C55E" strokeWidth="1.5" strokeDasharray="30 130" strokeLinecap="round" fill="none" className="opacity-95 animate-line-pulse" style={{ animationDelay: `${-0.75 - index * 0.9}s` }} />
                    </g>
                  );
                });
              })()}
            </svg>
            
            {/* COLUMN 1: ACCESS & RECOVERY CHANNELS (LEFT) */}
            <div className="flex flex-col items-center md:items-end justify-center gap-6 sm:space-y-4 md:space-y-4 z-10 w-full">
              {/* Node A: Biometric Passkey */}
              <div 
                ref={passkeyRef}
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setActiveModal("passkey");
                  }
                }}
                className={`transition-[background-color,border-color,text-color,transform,box-shadow] duration-200 md:cursor-default cursor-pointer flex flex-col justify-center items-center relative
                  /* Mobile styles: circular button */
                  w-12 h-12 rounded-full border shadow-md active:scale-95 flex-shrink-0
                  ${recoveryStatus.isSealed 
                    ? 'bg-brand-green border-brand-green text-white max-md:hover:bg-brand-green-dark shadow-brand-green/20' 
                    : 'bg-red-500 border-red-600 text-white animate-pulse shadow-red-500/20 max-md:hover:bg-red-600'
                  }
                  /* Desktop override styles */
                  md:w-full md:max-w-[220px] md:h-auto md:rounded-2xl md:p-3 md:shadow-none md:active:scale-100 md:border md:block
                  ${recoveryStatus.isSealed 
                    ? 'md:bg-brand-green/5 md:border-brand-green/20 md:text-neutral-800 md:hover:bg-brand-green/[0.08] md:hover:border-brand-green/30' 
                    : 'md:bg-red-50/50 md:border-red-200 md:text-neutral-800 md:hover:bg-red-50/80 md:hover:border-red-300'
                  }
                `}
              >
                {/* Desktop layout content */}
                <div className="hidden md:flex items-center gap-2.5 w-full">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    recoveryStatus.isSealed ? 'bg-brand-green text-white' : 'bg-red-500 text-white'
                  }`}>
                    <ShieldCheck size={16} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h4 className="font-bold text-neutral-800 text-xs truncate">Biometric Passkey</h4>
                    <p className={`text-[9px] font-semibold ${recoveryStatus.isSealed ? 'text-brand-green-dark' : 'text-red-600'}`}>
                      {recoveryStatus.isSealed ? 'Linked & Synced' : 'Passkey Missing'}
                    </p>
                  </div>
                </div>
                {/* Desktop action button */}
                <div className="hidden md:block w-full">
                  {!recoveryStatus.isSealed && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEnableRecovery(); }}
                      disabled={!isReady || enablingRecovery}
                      className="w-full mt-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[9px] font-black rounded-lg transition-colors shadow-sm shadow-red-200 animate-pulse"
                    >
                      {enablingRecovery ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Enable Passkey'}
                    </button>
                  )}
                </div>

                {/* Mobile circular layout: Fingerprint Icon */}
                <div className="md:hidden flex items-center justify-center">
                  <Fingerprint size={20} />
                </div>
              </div>

              {/* Node B: Cold Recovery Phrase */}
              <div 
                ref={backupRef}
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setActiveModal("backup");
                  }
                }}
                className={`transition-[background-color,border-color,text-color,transform,box-shadow] duration-200 md:cursor-default cursor-pointer flex flex-col justify-center items-center relative
                  /* Mobile styles: circular button */
                  w-12 h-12 rounded-full border shadow-md active:scale-95 flex-shrink-0
                  ${hasPhrase 
                    ? 'bg-brand-green border-brand-green text-white max-md:hover:bg-brand-green-dark shadow-brand-green/20' 
                    : 'bg-amber-500 border-amber-600 text-white shadow-amber-500/20 max-md:hover:bg-amber-600'
                  }
                  /* Desktop override styles */
                  md:w-full md:max-w-[220px] md:h-auto md:rounded-2xl md:p-3 md:shadow-none md:active:scale-100 md:border md:block
                  ${hasPhrase 
                    ? 'md:bg-brand-green/5 md:border-brand-green/20 md:text-neutral-800 md:hover:bg-brand-green/[0.08] md:hover:border-brand-green/30' 
                    : 'md:bg-amber-50/50 md:border-amber-200 md:text-neutral-800 md:hover:bg-amber-50/80 md:hover:border-amber-300'
                  }
                `}
              >
                {/* Desktop layout content */}
                <div className="hidden md:flex items-center gap-2.5 w-full text-left">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    hasPhrase ? 'bg-brand-green text-white' : 'bg-amber-500 text-white'
                  }`}>
                    <Clipboard size={16} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h4 className="font-bold text-neutral-800 text-xs truncate">Cold Storage Backup</h4>
                    <p className={`text-[9px] font-semibold ${hasPhrase ? 'text-brand-green-dark' : 'text-amber-600'}`}>
                      {hasPhrase ? 'Offline Phrase Secured' : 'Backup Required'}
                    </p>
                  </div>
                </div>
                {/* Desktop action button */}
                <div className="hidden md:block w-full">
                  {!hasPhrase ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleGeneratePhrase(); }}
                      disabled={!isReady || enablingRecovery}
                      className="w-full mt-2.5 py-1.5 bg-neutral-900 hover:bg-black text-white text-[9px] font-black rounded-lg transition-colors shadow-sm"
                    >
                      {enablingRecovery ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Generate Backup'}
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Would you like to regenerate your recovery phrase? This will create a NEW 24-word phrase and invalidate the old one. Make sure you write down the new phrase.")) {
                          handleGeneratePhrase();
                        }
                      }}
                      disabled={!isReady || enablingRecovery}
                      className="w-full mt-2.5 py-1.5 bg-white border border-brand-green/20 text-brand-green-dark hover:bg-brand-green/5 text-[9px] font-bold rounded-lg transition-colors"
                    >
                      {enablingRecovery ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Regenerate Phrase'}
                    </button>
                  )}
                </div>

                {/* Mobile circular layout: Key Icon */}
                <div className="md:hidden flex items-center justify-center">
                  <Key size={20} />
                </div>
              </div>
            </div>

            {/* COLUMN 2: KEYRING CORE SHIELD (CENTER) */}
            <div className="flex flex-col items-center justify-center py-2 md:py-0 z-10">
              <div ref={masterRef} className="relative flex items-center justify-center w-16 h-16 md:w-24 md:h-24">
                {/* Dynamic neon halo */}
                <div className={`absolute inset-0 rounded-full border border-dashed md:border-2 md:border-solid animate-pulse-gentle ${
                  recoveryStatus.isSealed ? 'border-brand-green/30' : 'border-red-500/30'
                }`} />
                <div className={`absolute -inset-1 rounded-full border opacity-5 hidden md:block ${
                  recoveryStatus.isSealed ? 'border-brand-green' : 'border-red-500'
                }`} />
                
                {/* Center Pulse Core */}
                <div className={`rounded-full flex flex-col items-center justify-center shadow-lg border text-center transition-all
                  w-12 h-12 p-1
                  md:w-20 md:h-20 md:p-2.5
                  ${recoveryStatus.isSealed 
                    ? 'bg-brand-green text-white border-brand-green-dark shadow-brand-green/20' 
                    : 'bg-red-500 text-white border-red-600 shadow-red-500/20'
                  }
                `}>
                  <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" />
                  <span className="text-[6px] md:text-[8px] font-black uppercase tracking-widest leading-none mt-0.5 md:mt-1">Key</span>
                  <span className="text-[5px] md:text-[7px] opacity-85 leading-none mt-0.5 font-semibold hidden md:inline">
                    {recoveryStatus.isSealed ? 'Secured' : 'At Risk'}
                  </span>
                </div>
              </div>
            </div>

            {/* COLUMN 3: AUTHORIZED ENDPOINTS / ACTIVE SESSIONS (RIGHT) */}
            <div data-testid="device-list" className="space-y-4 md:space-y-4 flex flex-col items-center md:items-start justify-center z-10 w-full">
              {accountData?.devices && Object.values(accountData.devices).map((device: any) => {
                const isCurrent = device.deviceId === getDeviceId();
                return (
                  <div 
                    key={device.deviceId}
                    data-testid="device-item"
                    ref={el => { deviceRefs.current[device.deviceId] = el; }}
                    onClick={() => {
                      if (window.innerWidth < 768) {
                        setActiveModal("devices");
                      }
                    }}
                    className={`transition-[background-color,border-color,text-color,transform,box-shadow] duration-200 md:cursor-default cursor-pointer flex flex-col justify-center items-center relative
                      /* Mobile styles: circular button */
                      w-12 h-12 rounded-full border shadow-md active:scale-95 flex-shrink-0
                      ${isCurrent 
                        ? 'bg-brand-green border-brand-green text-white shadow-brand-green/20 max-md:hover:bg-brand-green-dark' 
                        : 'bg-neutral-900 border-black text-white shadow-neutral-950/20 max-md:hover:bg-neutral-800'
                      }
                      /* Desktop override styles */
                      md:w-full md:max-w-[220px] md:h-auto md:rounded-2xl md:p-3 md:shadow-sm md:active:scale-100 md:border md:block
                      ${isCurrent 
                        ? 'md:bg-brand-green/5 md:border-brand-green/20 md:text-neutral-800 md:hover:bg-brand-green/[0.08] md:hover:border-brand-green/30' 
                        : 'md:bg-white md:border-neutral-100 md:text-neutral-800 md:hover:bg-neutral-50/80 md:hover:border-neutral-200 md:hover:border-brand-red/20'
                      }
                    `}
                  >
                    {/* Desktop Content */}
                    <div className="hidden md:flex items-center gap-2.5 w-full text-left">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isCurrent ? 'bg-brand-green text-white' : 'bg-neutral-100 text-neutral-400'
                      }`}>
                        <Monitor size={16} />
                      </div>
                      <div className="flex-1 min-w-0 pr-6 text-left">
                        <h4 className="font-bold text-neutral-800 text-xs truncate">
                          {device.decryptedDeviceName}{isCurrent ? ' (Current)' : ''}
                        </h4>
                        <p className="text-[8px] text-neutral-400 font-semibold mt-0.5">
                          {isCurrent ? 'Current Session' : 'Authorized Endpoint'}
                        </p>
                      </div>
                    </div>
                    {/* Desktop Revoke Button */}
                    {!isCurrent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRevoke(device.deviceId);
                        }}
                        disabled={!isReady}
                        data-testid="revoke-device-btn"
                        className="hidden md:flex absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-brand-red hover:bg-red-50 rounded-lg transition-all"
                        title="Revoke Access"
                      >
                        <XCircle size={15} />
                      </button>
                    )}

                    {/* Mobile Content: Monitor Icon */}
                    <div className="md:hidden flex items-center justify-center relative">
                      <Monitor size={20} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile Caption Indicator */}
          <div className="md:hidden flex justify-center mt-6">
            <p className="text-[9px] text-neutral-400 font-bold tracking-wide text-center">
              Tap any node to manage credentials & devices
            </p>
          </div>
        </div>
      </div>

        {/* Tap-to-Open Modals */}
        {activeModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-neutral-900/40 overflow-y-auto text-center">
            <div 
              className="max-w-md w-full max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-y-auto bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-neutral-200/60 text-brand-charcoal animate-pop-in flex flex-col relative mx-4 sm:mx-0 text-left p-6 sm:p-10"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                backgroundImage: "linear-gradient(rgba(228, 233, 229, 0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(228, 233, 229, 0.7) 1px, transparent 1px)",
                backgroundSize: "32px 32px"
              }}
            >
              {/* Passkey Modal Content */}
              {activeModal === "passkey" && (
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        recoveryStatus.isSealed ? 'bg-brand-green text-white' : 'bg-red-500 text-white animate-pulse'
                      }`}>
                        <Fingerprint size={20} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-black text-neutral-900 truncate">Biometric Passkey</h3>
                        <p className={`text-[10px] font-bold ${recoveryStatus.isSealed ? 'text-brand-green-dark' : 'text-red-600'}`}>
                          {recoveryStatus.isSealed ? 'Linked & Synced' : 'Passkey Missing'}
                        </p>
                      </div>
                    </div>
                    {/* Inline Close Button */}
                    <button
                      onClick={() => setActiveModal(null)}
                      className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition-all flex-shrink-0"
                    >
                      <XCircle size={20} />
                    </button>
                  </div>
                  <p className="text-neutral-500 text-xs mb-6 leading-relaxed font-medium">
                    Passkeys use biometric verification (like Touch ID or Face ID) to cryptographically sync and authorize new devices without exposing your master identity keys.
                  </p>
                  {!recoveryStatus.isSealed ? (
                    <button 
                      onClick={() => {
                        setActiveModal(null);
                        handleEnableRecovery();
                      }}
                      disabled={!isReady || enablingRecovery}
                      className="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl transition-colors shadow-sm animate-pulse flex items-center justify-center gap-2"
                    >
                      {enablingRecovery ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enable Passkey'}
                    </button>
                  ) : (
                    <div className="py-3 px-4 bg-brand-green/10 border border-brand-green/30 rounded-xl text-center backdrop-blur-sm">
                      <span className="text-[10px] text-brand-green-dark font-black">Your passkey is fully active and protecting your identity.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Cold Storage Backup Modal Content */}
              {activeModal === "backup" && (
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        hasPhrase ? 'bg-brand-green text-white' : 'bg-amber-500 text-white'
                      }`}>
                        <Key size={20} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-black text-neutral-900 truncate">Cold Storage Backup</h3>
                        <p className={`text-[10px] font-bold ${hasPhrase ? 'text-brand-green-dark' : 'text-amber-600'}`}>
                          {hasPhrase ? 'Offline Phrase Secured' : 'Backup Required'}
                        </p>
                      </div>
                    </div>
                    {/* Inline Close Button */}
                    <button
                      onClick={() => setActiveModal(null)}
                      className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition-all flex-shrink-0"
                    >
                      <XCircle size={20} />
                    </button>
                  </div>
                  <p className="text-neutral-500 text-xs mb-6 leading-relaxed font-medium">
                    Your 24-word recovery phrase is an offline backup. Write these words on physical paper and store them in a secure physical vault or safe.
                  </p>
                  {!hasPhrase ? (
                    <button 
                      onClick={() => {
                        setActiveModal(null);
                        handleGeneratePhrase();
                      }}
                      disabled={!isReady || enablingRecovery}
                      className="w-full py-3 bg-neutral-900 hover:bg-black text-white text-xs font-black rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      {enablingRecovery ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Backup'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (confirm("Would you like to regenerate your recovery phrase? This will create a NEW 24-word phrase and invalidate the old one. Make sure you write down the new phrase.")) {
                          setActiveModal(null);
                          handleGeneratePhrase();
                        }
                      }}
                      disabled={!isReady || enablingRecovery}
                      className="w-full py-3 bg-white border border-brand-green/20 text-brand-green-dark hover:bg-brand-green/5 text-xs font-black rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {enablingRecovery ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Regenerate Phrase'}
                    </button>
                  )}
                </div>
              )}

              {/* Devices Modal Content */}
              {activeModal === "devices" && (
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center flex-shrink-0">
                        <Monitor size={20} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-black text-neutral-900 truncate">Authorized Devices</h3>
                        <p className="text-[10px] font-bold text-neutral-400">
                          {Object.keys(accountData?.devices || {}).length} sessions active
                        </p>
                      </div>
                    </div>
                    {/* Inline Close Button */}
                    <button
                      onClick={() => setActiveModal(null)}
                      className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition-all flex-shrink-0"
                    >
                      <XCircle size={20} />
                    </button>
                  </div>
                  <div className="max-h-[240px] overflow-y-auto px-1.5 py-2 space-y-2 mb-4">
                    {accountData?.devices && Object.values(accountData.devices).map((device: any) => {
                      const isCurrent = device.deviceId === getDeviceId();
                      return (
                        <div 
                          key={device.deviceId}
                          className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all backdrop-blur-sm ${
                            isCurrent 
                              ? 'bg-brand-green/10 border-brand-green/30 text-neutral-800' 
                              : 'bg-white/80 border-neutral-200/60 shadow-sm hover:border-brand-green/20 text-neutral-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isCurrent ? 'bg-brand-green text-white' : 'bg-neutral-250 text-neutral-500'
                            }`}>
                              <Monitor size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-neutral-800 text-xs truncate">
                                {device.decryptedDeviceName}{isCurrent ? ' (Current)' : ''}
                              </h4>
                              <p className="text-[8px] text-neutral-400 font-semibold mt-0.5">
                                {isCurrent ? 'Current Session' : 'Authorized Endpoint'}
                              </p>
                            </div>
                          </div>
                          {!isCurrent && (
                            <button
                              onClick={() => {
                                if (confirm("Are you sure you want to revoke this device?")) {
                                  handleRevoke(device.deviceId);
                                  // Close modal if last revoked
                                  if (Object.keys(accountData?.devices || {}).length <= 2) {
                                    setActiveModal(null);
                                  }
                                }
                              }}
                              disabled={!isReady}
                              className="p-1.5 text-neutral-400 hover:text-brand-red hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                              title="Revoke Access"
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Phrase Modal */}
      {showPhraseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-brand-charcoal/80 overflow-y-auto">
          <div className="bg-white rounded-[3rem] p-8 sm:p-12 max-w-2xl w-full shadow-2xl relative animate-pop-in">
            <h2 className="text-3xl font-black text-neutral-900 mb-4">Your Recovery Phrase</h2>
            <p className="text-neutral-600 mb-8 font-medium">
              Write these 24 words down in order and store them in a secure, physical location.
              <span className="text-brand-red font-bold"> Do not share this with anyone or save it online.</span>
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
              {generatedMnemonic?.split(' ').map((word, i) => (
                <div key={i} className="bg-neutral-50 p-3 rounded-xl border border-neutral-100 flex items-center gap-3">
                  <span className="text-neutral-400 text-xs font-black w-4">{i + 1}</span>
                  <span className="font-bold text-neutral-800 tracking-tight">{word}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={copyToClipboard}
                disabled={!isReady}
                className="flex-1 px-8 py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-black hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {copied ? <CheckCircle2 size={20} className="text-brand-green" /> : <Clipboard size={20} />}
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
              <button
                onClick={() => setShowPhraseModal(false)}
                disabled={!isReady}
                className="flex-1 px-8 py-4 bg-brand-green text-white rounded-2xl font-black hover:bg-brand-green-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                I've Saved It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
