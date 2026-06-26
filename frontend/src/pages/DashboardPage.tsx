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
} from "charproof";
import type { DecryptedDevice } from "charproof";
import { useAuth } from "@/hooks/useAuth";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/components/toast/toastContext";
import { useConfirm } from "@/components/confirm/confirmContext";
import { copyToClipboard } from "@/lib/clipboard";
import { Loader2, Calendar, MapPin, ExternalLink, Activity, Lock, ShieldCheck, Clipboard, CheckCircle2, Monitor, XCircle, User, Users, Fingerprint, Key, Archive, ArchiveRestore, ChevronDown, Edit3 } from "lucide-react";
import { buttonClasses } from "@/components/buttonStyles";
import PageLoader from "@/components/PageLoader";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import type { PollMetadata, PendingDevice } from "../types";

type AccountData = { devices: Record<string, DecryptedDevice> };

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
  useDocumentTitle('Dashboard · LetUsMeet');
  const { user, loading, pendingRequests } = useAuth();
  const { toast } = useToast();
  const askConfirm = useConfirm();
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
      ? "This hides the poll from your main dashboard. Because you're the Organizer, you won't be able to manage, edit, or close it unless you restore it from the Archive section first."
      : "This hides the poll from your main dashboard. You can restore it and adjust your responses anytime from the Archive section at the bottom.";

    if (!(await askConfirm({
      title: `Archive poll "${title}"?`,
      body: warningMsg,
      confirmLabel: "Archive",
      variant: "warning",
    }))) return;

    try {
      setActionInProgress(pollId);
      await archiveKeystoreEntry(pollId);
      toast({ variant: "success", message: "Poll archived." });
    } catch (e) {
      console.error("Failed to archive poll:", e);
      toast({ variant: "error", message: "Failed to archive poll." });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUnarchive = async (pollId: string) => {
    try {
      setActionInProgress(pollId);
      await unarchiveKeystoreEntry(pollId);
      toast({ variant: "success", message: "Poll restored." });
    } catch (e) {
      console.error("Failed to restore poll:", e);
      toast({ variant: "error", message: "Failed to restore poll." });
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
    // Mount gate: enable interactive controls only after hydration to avoid click-before-ready.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReady(true);
  }, []);
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [showRotationSuccess, setShowRotationSuccess] = useState(false);


  const handleApprove = async (req: PendingDevice) => {
    try {
      setApprovingId(req.deviceId);
      await approveDeviceAuthorization(req);
    } catch (e) {
      console.error("Failed to approve device:", e);
      toast({ variant: "error", message: "Failed to authorize device." });
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
  const passkeyRef = useRef<HTMLDivElement>(null);
  const backupRef = useRef<HTMLDivElement>(null);
  const masterRef = useRef<HTMLDivElement>(null);
  const deviceRefs = useRef<Record<string, HTMLElement | null>>({});

  // The active-node modal and recovery-phrase modal use the shared <Modal>,
  // which centralizes focus trap, Escape-to-close, and focus restore.

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
    devices.forEach((device: DecryptedDevice) => {
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
      // Async subscription guard: nothing to fetch for signed-out/anon users; clear loading.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFetching(false);
      return;
    }

    setFetching(true);

    // Listen to account keys using clean facade
    const unsubAccount = subscribeAuthorizedDevices((devices) => {
      const devicesRecord: Record<string, DecryptedDevice> = {};
      for (const dev of devices) {
        devicesRecord[dev.deviceId] = dev;
      }
      setAccountData({ devices: devicesRecord });
      getRecoveryStatus().then(setRecoveryStatus).catch((e) => {
        console.error("Failed to load recovery status:", e);
      });
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
          } catch {
            // Entry failed to decrypt (e.g. a poll this device can't read) — skip it.
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
      toast({ variant: "error", message: "Failed to enable recovery. Make sure your browser supports passkeys and you have one set up." });
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
      toast({ variant: "error", message: "Failed to setup phrase recovery." });
    } finally {
      setEnablingRecovery(false);
    }
  };

  const handleRevoke = async (deviceId: string) => {
    if (!(await askConfirm({
      title: "Revoke this device?",
      body: "It will lose access to all your polls immediately.",
      confirmLabel: "Revoke device",
      variant: "danger",
    }))) return;
    try {
      await revokeDevice(deviceId);
      setShowRotationSuccess(true);
      setTimeout(() => setShowRotationSuccess(false), 5000);
    } catch (e) {
      const err = e instanceof Error ? e : undefined;
      console.error("Failed to revoke device:", err?.message || String(e), err?.stack);
      toast({ variant: "error", message: "Failed to revoke device." });
    }
  };

  const handleCopyMnemonic = async () => {
    if (generatedMnemonic) {
      const ok = await copyToClipboard(generatedMnemonic);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast({ variant: "error", message: "We couldn't copy your phrase. Please copy it manually." });
      }
    }
  };

  // Activate a role="button" node via Enter/Space, mirroring native button keys.
  const handleNodeActivation = (
    e: React.KeyboardEvent<HTMLDivElement>,
    action: () => void
  ) => {
    // Only react when the node itself is focused, not a nested control.
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      action();
    }
  };

  if (loading || fetching) {
    return (
      <PageLoader
        statusOnWrapper
        message="Loading your polls..."
        messageClassName="text-neutral-500"
      />
    );
  }

  if (!user || user.isAnonymous) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="bg-neutral-50 rounded-[3rem] p-10 border border-neutral-100">
          <Lock className="w-12 h-12 text-neutral-300 mx-auto mb-6" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-neutral-800 mb-4">Sign in to see your polls</h1>
          <p className="text-neutral-600 mb-8">Sign in with Google to sync your polls across all your devices.</p>
          <Link to="/" className={buttonClasses("primary", "lg")}>Back to Home</Link>
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
          <p className="text-neutral-500 font-medium">View and manage your polls</p>
        </div>
      </div>

      {activeEntries.length === 0 ? (
        <EmptyState
          icon={
            <div className="w-16 h-16 bg-brand-green-light/30 text-brand-green rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Calendar size={32} aria-hidden="true" />
            </div>
          }
          title="No polls yet"
          body="Polls you create or vote in will show up here automatically."
          action={
            <Link to="/create" className={buttonClasses("primary", "lg")}>
              Create New Poll
            </Link>
          }
        />
      ) : (
        <>
          {/* Beautiful and responsive tab navigation */}
          <div className="border-b border-neutral-100 mb-6">
            <div role="tablist" aria-label="Poll categories" className="grid grid-cols-2 sm:flex gap-4 sm:gap-6 px-3 sm:px-4 -mb-px">
            <button
              role="tab"
              id="tab-organizer"
              aria-selected={activeTab === "organizer"}
              aria-controls="tabpanel-organizer"
              onClick={() => setActiveTab("organizer")}
              data-testid="tab-organizer"
              className={`focus-ring pb-3 sm:pb-4 font-black text-sm sm:text-lg transition-all border-b-2 relative flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 whitespace-nowrap ${
                activeTab === "organizer"
                  ? "text-brand-green border-brand-green"
                  : "text-neutral-600 border-transparent hover:text-neutral-600"
              }`}
            >
              <User size={18} aria-hidden="true" />
              <span>Organized by Me</span>
              <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
                activeTab === "organizer" ? "bg-brand-green/10 text-brand-green" : "bg-neutral-100 text-neutral-500"
              }`}>
                {activeEntries.filter(e => e.isOrganizer).length}
              </span>
            </button>
            <button
              role="tab"
              id="tab-participant"
              aria-selected={activeTab === "participant"}
              aria-controls="tabpanel-participant"
              onClick={() => setActiveTab("participant")}
              data-testid="tab-participant"
              className={`focus-ring pb-3 sm:pb-4 font-black text-sm sm:text-lg transition-all border-b-2 relative flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 whitespace-nowrap ${
                activeTab === "participant"
                  ? "text-brand-green border-brand-green"
                  : "text-neutral-600 border-transparent hover:text-neutral-600"
              }`}
            >
              <Users size={18} aria-hidden="true" />
              <span>Joined & Voted</span>
              <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
                activeTab === "participant" ? "bg-brand-green/10 text-brand-green" : "bg-neutral-100 text-neutral-500"
              }`}>
                {activeEntries.filter(e => !e.isOrganizer).length}
              </span>
            </button>
          </div>
        </div>

        <div
          role="tabpanel"
          id={activeTab === "organizer" ? "tabpanel-organizer" : "tabpanel-participant"}
          aria-labelledby={activeTab === "organizer" ? "tab-organizer" : "tab-participant"}
        >
          {activeTab === "organizer" && activeEntries.filter(e => e.isOrganizer).length === 0 ? (
            <EmptyState
              className="bg-white p-12 rounded-[3rem] border border-neutral-100 text-center shadow-xl shadow-neutral-100/50 mb-10"
              icon={
                <div className="w-16 h-16 bg-neutral-50 text-neutral-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Calendar size={32} aria-hidden="true" />
                </div>
              }
              title="No Organized Polls"
              titleClassName="text-xl font-bold text-neutral-800 mb-2 font-black"
              body="You haven't created any polls yet. Make your first one below."
              action={
                <Link to="/create" className="btn-primary-green inline-block">
                  Create New Poll
                </Link>
              }
            />
          ) : activeTab === "participant" && activeEntries.filter(e => !e.isOrganizer).length === 0 ? (
            <EmptyState
              className="bg-white p-12 rounded-[3rem] border border-neutral-100 text-center shadow-xl shadow-neutral-100/50 mb-10"
              icon={
                <div className="w-16 h-16 bg-neutral-50 text-neutral-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Users size={32} aria-hidden="true" />
                </div>
              }
              title="No Joined Polls"
              titleClassName="text-xl font-bold text-neutral-800 mb-2 font-black"
              body="Polls you view, vote in, or participate in will automatically be stored securely and displayed here."
            />
          ) : (
            <ul className="grid gap-6 list-none p-0 m-0">
              {activeEntries
                .filter(e => (activeTab === "organizer" ? e.isOrganizer : !e.isOrganizer))
                .map((entry) => (
                  <li key={entry.pollId} className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-neutral-100 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <h2 className="text-xl sm:text-2xl font-black text-neutral-800 group-hover:text-brand-green transition-colors">{entry.metadata.title}</h2>
                          {entry.isOrganizer ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-brand-green/10 text-brand-green-dark border border-brand-green/20">
                              <User size={12} aria-hidden="true" />
                              Organizer
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                              <Users size={12} aria-hidden="true" />
                              Participant
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-5 text-sm font-bold text-neutral-600">
                          {entry.metadata.location && (
                            <div className="flex items-center gap-2">
                              <MapPin size={16} className="text-neutral-300" aria-hidden="true" />
                              <span>{entry.metadata.location}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Activity size={16} className="text-neutral-300" aria-hidden="true" />
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
                          aria-label={`Archive poll ${entry.metadata.title}`}
                        >
                          <Archive size={18} aria-hidden="true" />
                        </button>
                        <Link
                          to={`/poll/${entry.pollId}#key=${entry.symmetricKey}`}
                          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-neutral-50 text-neutral-600 rounded-xl sm:rounded-2xl font-bold hover:bg-neutral-100 transition-colors text-sm sm:text-base whitespace-nowrap"
                        >
                          View
                        </Link>
                        {entry.isOrganizer && entry.symmetricKey && (
                          <Link
                            to={`/poll/${entry.pollId}/edit#key=${entry.symmetricKey}`}
                            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-neutral-50 text-neutral-600 rounded-xl sm:rounded-2xl font-bold hover:bg-neutral-100 transition-colors flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base whitespace-nowrap"
                          >
                            <Edit3 size={16} aria-hidden="true" /> Edit
                          </Link>
                        )}
                        <Link
                          to={`/poll/${entry.pollId}/results#key=${entry.symmetricKey}`}
                          className="focus-ring px-4 sm:px-6 py-2.5 sm:py-3 bg-brand-green text-white rounded-xl sm:rounded-2xl font-bold hover:bg-brand-green-dark flex items-center gap-1.5 sm:gap-2 shadow-lg shadow-brand-green/20 transition-all hover:scale-[1.02] text-sm sm:text-base whitespace-nowrap"
                        >
                          <ExternalLink size={16} aria-hidden="true" /> Results
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
        </>
      )}

      {/* 2. Archived Polls Section */}
      {hasArchivedPolls && (
        <div className="mt-8 bg-neutral-50/50 border border-neutral-100 rounded-[2.5rem] p-6 sm:p-8 mb-10">
          <button
            onClick={() => setIsArchivedExpanded(!isArchivedExpanded)}
            aria-expanded={isArchivedExpanded}
            aria-controls="archived-polls-region"
            className="focus-ring flex items-center justify-between w-full text-left group/btn cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Archive className="text-neutral-400 group-hover/btn:text-brand-green transition-colors" size={24} aria-hidden="true" />
              <div>
                <h3 className="text-xl font-black text-neutral-800 group-hover/btn:text-brand-green transition-colors">Archived Polls</h3>
                <p className="text-sm font-medium text-neutral-600">These polls are hidden from your active lists. You can restore them to your active dashboard at any time.</p>
              </div>
            </div>
            <div className={`p-2 bg-white rounded-xl border border-neutral-100 text-neutral-400 group-hover/btn:text-brand-green group-hover/btn:border-brand-green/20 transition-all duration-200 ${isArchivedExpanded ? 'rotate-180 text-brand-green' : ''}`}>
              <ChevronDown size={20} aria-hidden="true" />
            </div>
          </button>

          {isArchivedExpanded && (
            <ul id="archived-polls-region" className="grid gap-4 mt-6 animate-fade-in-down list-none p-0 m-0">
              {archivedEntries.map((entry) => (
                <li key={entry.pollId} className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[1.5rem] border border-neutral-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
                    <p className="text-xs font-bold text-neutral-600">
                      Location: {entry.metadata.location || "None"} • Mode: {entry.metadata.schedulingMode === "EXACT" ? "Exact Times" : "Flexible"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                    <button
                      onClick={() => handleUnarchive(entry.pollId)}
                      disabled={actionInProgress === entry.pollId}
                      className="p-2 text-neutral-400 hover:text-brand-green rounded-xl border border-neutral-100 hover:border-brand-green/20 hover:bg-brand-green/5 transition-colors disabled:opacity-50"
                      title="Restore to Active Dashboard"
                      aria-label={`Restore poll ${entry.metadata.title} to active dashboard`}
                    >
                      <ArchiveRestore size={16} aria-hidden="true" />
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
                </li>
              ))}
            </ul>
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
            <p className="text-neutral-500 font-medium">Manage your passkey, recovery phrase, and the devices that can open your polls.</p>
          </div>
          {showRotationSuccess && (
            <div role="status" aria-live="polite" data-testid="rotation-success-toast" className="bg-brand-green text-white px-4 py-2 rounded-xl text-sm font-bold animate-fade-in-up self-start sm:self-auto">
              Device removed. Your other devices are still secure.
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
                    <Monitor size={20} aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900 text-sm">Authorize New Device?</h4>
                    <p className="text-amber-800 text-xs mt-0.5 font-semibold">
                      "{(req as PendingDevice & { decryptedDeviceName?: string }).decryptedDeviceName || "Unknown Device"}" wants access. Confirm code: <span className="font-mono font-bold bg-amber-100 px-2 py-0.5 rounded ml-1"><PendingCodeDisplay publicKey={req.publicKey} /></span>
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
                    {approvingId === req.deviceId ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : null}
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
                return devicesList.map((device: DecryptedDevice, index: number) => {
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
                role="button"
                tabIndex={0}
                aria-label="Manage biometric passkey"
                onClick={() => {
                  setActiveModal("passkey");
                }}
                onKeyDown={(e) => handleNodeActivation(e, () => setActiveModal("passkey"))}
                className={`focus-ring transition-[background-color,border-color,text-color,transform,box-shadow] duration-200 md:cursor-default cursor-pointer flex flex-col justify-center items-center relative
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
                    <ShieldCheck size={16} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h4 className="font-bold text-neutral-800 text-xs truncate">Biometric Passkey</h4>
                    <p className={`text-[10px] font-semibold ${recoveryStatus.isSealed ? 'text-brand-green-dark' : 'text-red-600'}`}>
                      {recoveryStatus.isSealed ? 'Linked & Synced' : 'Set up your passkey'}
                    </p>
                  </div>
                </div>
                {/* Desktop action button */}
                <div className="hidden md:block w-full">
                  {!recoveryStatus.isSealed && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEnableRecovery(); }}
                      disabled={!isReady || enablingRecovery}
                      className="w-full mt-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black rounded-lg transition-colors shadow-sm shadow-red-200 animate-pulse"
                    >
                      {enablingRecovery ? <Loader2 className="w-3 h-3 animate-spin mx-auto" aria-hidden="true" /> : 'Enable Passkey'}
                    </button>
                  )}
                </div>

                {/* Mobile circular layout: Fingerprint Icon */}
                <div className="md:hidden flex items-center justify-center">
                  <Fingerprint size={20} aria-hidden="true" />
                </div>
              </div>

              {/* Node B: Cold Recovery Phrase */}
              <div
                ref={backupRef}
                role="button"
                tabIndex={0}
                aria-label="Manage recovery phrase backup"
                onClick={() => {
                  setActiveModal("backup");
                }}
                onKeyDown={(e) => handleNodeActivation(e, () => setActiveModal("backup"))}
                className={`focus-ring transition-[background-color,border-color,text-color,transform,box-shadow] duration-200 md:cursor-default cursor-pointer flex flex-col justify-center items-center relative
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
                    <Clipboard size={16} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h4 className="font-bold text-neutral-800 text-xs truncate">Recovery Phrase Backup</h4>
                    <p className={`text-[10px] font-semibold ${hasPhrase ? 'text-brand-green-dark' : 'text-amber-600'}`}>
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
                      className="w-full mt-2.5 py-1.5 bg-neutral-900 hover:bg-black text-white text-[10px] font-black rounded-lg transition-colors shadow-sm"
                    >
                      {enablingRecovery ? <Loader2 className="w-3 h-3 animate-spin mx-auto" aria-hidden="true" /> : 'Generate Backup'}
                    </button>
                  ) : (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (await askConfirm({
                          title: "Regenerate your recovery phrase?",
                          body: "This creates a NEW 24-word phrase and invalidates the old one. Make sure you write down the new phrase.",
                          confirmLabel: "Regenerate",
                          variant: "warning",
                        })) {
                          handleGeneratePhrase();
                        }
                      }}
                      disabled={!isReady || enablingRecovery}
                      className="w-full mt-2.5 py-1.5 bg-white border border-brand-green/20 text-brand-green-dark hover:bg-brand-green/5 text-[10px] font-bold rounded-lg transition-colors"
                    >
                      {enablingRecovery ? <Loader2 className="w-3 h-3 animate-spin mx-auto" aria-hidden="true" /> : 'Regenerate Phrase'}
                    </button>
                  )}
                </div>

                {/* Mobile circular layout: Key Icon */}
                <div className="md:hidden flex items-center justify-center">
                  <Key size={20} aria-hidden="true" />
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
                  <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" aria-hidden="true" />
                  <span className="text-[10px] font-black uppercase tracking-wide leading-tight mt-0.5 md:mt-1">Your Keys</span>
                  <span className="text-[10px] opacity-85 leading-none mt-0.5 font-semibold hidden md:inline">
                    {recoveryStatus.isSealed ? 'Protected' : 'Action needed'}
                  </span>
                </div>
              </div>
            </div>

            {/* COLUMN 3: AUTHORIZED ENDPOINTS / ACTIVE SESSIONS (RIGHT) */}
            <div data-testid="device-list" className="space-y-4 md:space-y-4 flex flex-col items-center md:items-start justify-center z-10 w-full">
              {accountData?.devices && Object.values(accountData.devices).map((device: DecryptedDevice) => {
                const isCurrent = device.deviceId === getDeviceId();
                return (
                  <div
                    key={device.deviceId}
                    data-testid="device-item"
                    ref={el => { deviceRefs.current[device.deviceId] = el; }}
                    className={`transition-[background-color,border-color,text-color,transform,box-shadow] duration-200 md:cursor-default flex flex-col justify-center items-center relative
                      /* Mobile styles: circular button */
                      w-12 h-12 rounded-full border shadow-md active:scale-95 flex-shrink-0
                      ${isCurrent
                        ? 'bg-brand-green border-brand-green text-white shadow-brand-green/20 max-md:hover:bg-brand-green-dark'
                        : 'bg-neutral-900 border-black text-white shadow-neutral-900/20 max-md:hover:bg-neutral-800'
                      }
                      /* Desktop override styles */
                      md:w-full md:max-w-[220px] md:h-auto md:rounded-2xl md:p-3 md:shadow-sm md:active:scale-100 md:border md:block
                      ${isCurrent
                        ? 'md:bg-brand-green/5 md:border-brand-green/20 md:text-neutral-800 md:hover:bg-brand-green/[0.08] md:hover:border-brand-green/30'
                        : 'md:bg-white md:border-neutral-100 md:text-neutral-800 md:hover:bg-neutral-50/80 md:hover:border-neutral-200 md:hover:border-brand-red/20'
                      }
                    `}
                  >
                    {/* Text/icon region wrapped in a real button so it is keyboard
                        operable; the Revoke button is kept OUTSIDE this button to
                        avoid nesting interactive controls. */}
                    <button
                      type="button"
                      onClick={() => setActiveModal("devices")}
                      aria-label={`Manage device ${device.decryptedDeviceName}${isCurrent ? ' (current session)' : ''}`}
                      className="focus-ring cursor-pointer md:cursor-default flex flex-col justify-center items-center w-full h-full md:block bg-transparent border-0 p-0 text-inherit"
                    >
                      {/* Desktop Content */}
                      <div className="hidden md:flex items-center gap-2.5 w-full text-left">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isCurrent ? 'bg-brand-green text-white' : 'bg-neutral-100 text-neutral-400'
                        }`}>
                          <Monitor size={16} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0 pr-6 text-left">
                          <h4 className="font-bold text-neutral-800 text-xs truncate">
                            {device.decryptedDeviceName}{isCurrent ? ' (Current)' : ''}
                          </h4>
                          <p className="text-[10px] text-neutral-600 font-semibold mt-0.5">
                            {isCurrent ? 'Current Session' : 'Authorized device'}
                          </p>
                        </div>
                      </div>

                      {/* Mobile Content: Monitor Icon */}
                      <div className="md:hidden flex items-center justify-center relative">
                        <Monitor size={20} aria-hidden="true" />
                      </div>
                    </button>
                    {/* Desktop Revoke Button (sibling of the manage button) */}
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
                        aria-label={`Revoke access for device ${device.decryptedDeviceName}`}
                      >
                        <XCircle size={15} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile Caption Indicator */}
          <div className="md:hidden flex justify-center mt-6">
            <p className="text-[10px] text-neutral-600 font-bold tracking-wide text-center">
              Tap any node to manage credentials & devices
            </p>
          </div>
        </div>
      </div>

        {/* Tap-to-Open Modals */}
        <Modal
          open={activeModal !== null}
          onClose={() => setActiveModal(null)}
          labelledBy={activeModal ? `${activeModal}-modal-title` : undefined}
          variant="bare"
          closeOnBackdrop={false}
          backdropClassName="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-neutral-900/40 overflow-y-auto text-center"
          className="max-w-md w-full max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-y-auto bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-neutral-200/60 text-brand-charcoal animate-pop-in flex flex-col relative mx-4 sm:mx-0 text-left p-6 sm:p-10"
          panelStyle={{
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
                        <Fingerprint size={20} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h3 id="passkey-modal-title" className="text-base font-black text-neutral-900 truncate">Biometric Passkey</h3>
                        <p className={`text-[10px] font-bold ${recoveryStatus.isSealed ? 'text-brand-green-dark' : 'text-red-600'}`}>
                          {recoveryStatus.isSealed ? 'Linked & Synced' : 'Set up your passkey'}
                        </p>
                      </div>
                    </div>
                    {/* Inline Close Button */}
                    <button
                      onClick={() => setActiveModal(null)}
                      aria-label="Close dialog"
                      className="focus-ring p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition-all flex-shrink-0"
                    >
                      <XCircle size={20} aria-hidden="true" />
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
                      {enablingRecovery ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : 'Enable Passkey'}
                    </button>
                  ) : (
                    <div className="py-3 px-4 bg-brand-green/10 border border-brand-green/30 rounded-xl text-center backdrop-blur-sm">
                      <span className="text-[10px] text-brand-green-dark font-black">Your passkey is fully active and protecting your identity.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Recovery Phrase Backup Modal Content */}
              {activeModal === "backup" && (
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        hasPhrase ? 'bg-brand-green text-white' : 'bg-amber-500 text-white'
                      }`}>
                        <Key size={20} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h3 id="backup-modal-title" className="text-base font-black text-neutral-900 truncate">Recovery Phrase Backup</h3>
                        <p className={`text-[10px] font-bold ${hasPhrase ? 'text-brand-green-dark' : 'text-amber-600'}`}>
                          {hasPhrase ? 'Offline Phrase Secured' : 'Backup Required'}
                        </p>
                      </div>
                    </div>
                    {/* Inline Close Button */}
                    <button
                      onClick={() => setActiveModal(null)}
                      aria-label="Close dialog"
                      className="focus-ring p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition-all flex-shrink-0"
                    >
                      <XCircle size={20} aria-hidden="true" />
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
                      {enablingRecovery ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : 'Generate Backup'}
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        if (await askConfirm({
                          title: "Regenerate your recovery phrase?",
                          body: "This creates a NEW 24-word phrase and invalidates the old one. Make sure you write down the new phrase.",
                          confirmLabel: "Regenerate",
                          variant: "warning",
                        })) {
                          setActiveModal(null);
                          handleGeneratePhrase();
                        }
                      }}
                      disabled={!isReady || enablingRecovery}
                      className="w-full py-3 bg-white border border-brand-green/20 text-brand-green-dark hover:bg-brand-green/5 text-xs font-black rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {enablingRecovery ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : 'Regenerate Phrase'}
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
                        <Monitor size={20} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h3 id="devices-modal-title" className="text-base font-black text-neutral-900 truncate">Authorized Devices</h3>
                        <p className="text-[10px] font-bold text-neutral-600">
                          {Object.keys(accountData?.devices || {}).length} sessions active
                        </p>
                      </div>
                    </div>
                    {/* Inline Close Button */}
                    <button
                      onClick={() => setActiveModal(null)}
                      aria-label="Close dialog"
                      className="focus-ring p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition-all flex-shrink-0"
                    >
                      <XCircle size={20} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="max-h-[240px] overflow-y-auto px-1.5 py-2 space-y-2 mb-4">
                    {accountData?.devices && Object.values(accountData.devices).map((device: DecryptedDevice) => {
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
                              isCurrent ? 'bg-brand-green text-white' : 'bg-neutral-200 text-neutral-500'
                            }`}>
                              <Monitor size={14} aria-hidden="true" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-neutral-800 text-xs truncate">
                                {device.decryptedDeviceName}{isCurrent ? ' (Current)' : ''}
                              </h4>
                              <p className="text-[10px] text-neutral-600 font-semibold mt-0.5">
                                {isCurrent ? 'Current Session' : 'Authorized device'}
                              </p>
                            </div>
                          </div>
                          {!isCurrent && (
                            <button
                              onClick={async () => {
                                await handleRevoke(device.deviceId);
                                // Close modal if last revoked
                                if (Object.keys(accountData?.devices || {}).length <= 2) {
                                  setActiveModal(null);
                                }
                              }}
                              disabled={!isReady}
                              data-testid="revoke-device-btn-modal"
                              className="focus-ring p-1.5 text-neutral-400 hover:text-brand-red hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                              title="Revoke Access"
                              aria-label={`Revoke access for device ${device.decryptedDeviceName}`}
                            >
                              <XCircle size={16} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
        </Modal>

      {/* Phrase Modal */}
      <Modal
        open={showPhraseModal}
        onClose={() => setShowPhraseModal(false)}
        labelledBy="phrase-modal-title"
        variant="bare"
        closeOnBackdrop={false}
        backdropClassName="fixed inset-0 z-[120] flex items-center justify-center p-6 backdrop-blur-xl bg-brand-charcoal/80 overflow-y-auto"
        className="bg-white rounded-[3rem] p-8 sm:p-12 max-w-2xl w-full shadow-2xl relative animate-pop-in"
      >
            <h2 id="phrase-modal-title" className="text-3xl font-black text-neutral-900 mb-4">Your Recovery Phrase</h2>
            <p className="text-neutral-600 mb-8 font-medium">
              Write these 24 words down in order and store them in a secure, physical location.
              <span className="text-brand-red font-bold"> Do not share this with anyone or save it online.</span>
            </p>

            <ol className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10 list-none p-0 m-0">
              {generatedMnemonic?.split(' ').map((word, i) => (
                <li key={i} className="bg-neutral-50 p-3 rounded-xl border border-neutral-100 flex items-center gap-3">
                  <span className="text-neutral-600 text-xs font-black w-4">{i + 1}</span>
                  <span className="font-bold text-neutral-800 tracking-tight">{word}</span>
                </li>
              ))}
            </ol>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleCopyMnemonic}
                disabled={!isReady}
                className="focus-ring flex-1 px-8 py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-black hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {copied ? <CheckCircle2 size={20} className="text-brand-green" aria-hidden="true" /> : <Clipboard size={20} aria-hidden="true" />}
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
              <button
                onClick={() => setShowPhraseModal(false)}
                disabled={!isReady}
                className="focus-ring flex-1 px-8 py-4 bg-brand-green text-white rounded-2xl font-black hover:bg-brand-green-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                I've Saved It
              </button>
            </div>
            {/* Copy-success live region (announced to assistive tech). */}
            <div role="status" aria-live="polite" className="sr-only">
              {copied ? "Recovery phrase copied to clipboard" : ""}
            </div>
      </Modal>
    </div>
  );
}
