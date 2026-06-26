import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  Loader2, 
  ArrowLeft, 
  Users, 
  Info, 
  CalendarCheck, 
  Edit3, 
  Maximize2, 
  X, 
  RotateCcw, 
  CheckCircle2, 
  ChevronDown,
  Lock,
  MapPin,
  Share2,
  AlertTriangle
} from "lucide-react";
import {
  extractKeyFromFragment,
  subscribeToLedger,
  getShareableUrl,
  getLedgerSession,
  friendlyStatus
} from "@/lib/pollService";
import type { LedgerSession } from "charproof";
import { useAuth } from "../hooks/useAuth";
import type {
  PollState,
  VoteValue,
  PollAction,
  SchedulingMode,
  TimeSlot,
  ExactTimeSlot,
  FuzzyTimeSlot,
} from "../types";
import ActionCard from "@/components/ActionCard";
import CompactActionCard from "@/components/CompactActionCard";
import PageLoader from "@/components/PageLoader";
import MatrixTable from "@/components/MatrixTable";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { buttonClasses } from "@/components/buttonStyles";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/components/toast/toastContext";
import { useConfirm } from "@/components/confirm/confirmContext";
import { copyToClipboard } from "@/lib/clipboard";

/**
 * Safely formats the header "Confirmed/Leading time" label for a slot. Returns
 * null when the slot is missing (e.g. the finalized slot was edited out of the
 * poll after finalize) or its date is missing/invalid, so callers can render a
 * graceful fallback instead of crashing on a non-null assertion / Invalid Date.
 */
function formatSlotLabel(
  slot: TimeSlot | undefined,
  schedulingMode: SchedulingMode
): string | null {
  if (!slot) return null;

  if (schedulingMode === "EXACT") {
    if (!("startTime" in slot) || !slot.startTime) return null;
    const date = new Date(slot.startTime);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (!("date" in slot) || !slot.date) return null;
  const date = new Date(slot.date + "T00:00:00");
  if (Number.isNaN(date.getTime())) return null;
  const dateLabel = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return slot.label ? `${dateLabel}, ${slot.label}` : dateLabel;
}

export default function ResultsPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const askConfirm = useConfirm();

  const [pollState, setPollState] = useState<PollState | null>(null);
  const [syncStatus, setSyncStatus] = useState("Getting the latest responses…");
  const [session, setSession] = useState<LedgerSession | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLinkType, setCopiedLinkType] = useState<'poll' | 'results' | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Mount gate: enable interactive controls only after hydration to avoid click-before-ready.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReady(true);
  }, []);
  const [finalizing, setFinalizing] = useState<string | null>(null);
  // Derived in render (same check VotePollPage uses): no effect/state needed.
  const isAdmin = !!(session && pollState?.adminPublicKey && session.getSignerPublicKey() === pollState.adminPublicKey);
  const [unfinalizing, setUnfinalizing] = useState(false);
  const [showLocationCopied, setShowLocationCopied] = useState(false);

  useDocumentTitle(
    pollState?.metadata?.title
      ? `${pollState.metadata.title} — Results — LetUsMeet`
      : "Poll results — LetUsMeet"
  );

  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      // Layout measurement: reads DOM size after render.
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [pollState, isDescriptionExpanded]);

  // 1. Initialize and Subscribe
  useEffect(() => {
    if (loading) return;
    if (!pollId) return;
    let mounted = true;

    const b64Key = extractKeyFromFragment();
    if (!b64Key) {
      // Async init: load/error state is set from this init path; cannot derive in render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("This link is missing its key, so these results can't be unlocked. Ask the organizer to resend the full link.");
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);

    const init = async () => {
      try {
        const s = await getLedgerSession(pollId, { shareableKey: b64Key });
        if (mounted) setSession(s);

        const unsubscribe = subscribeToLedger(
          s,
          (state, status) => {
            if (!mounted) return;
            if (state) {
              setPollState(state);
              setIsLoading(false);
              setConnectionError(false);
            } else if (status === "No valid events found.") {
              setIsLoading(false);
              setConnectionError(false);
            }
            setSyncStatus(status);
          },
          (err) => {
            if (!mounted) return;
            console.error("Ledger subscription failed:", err);
            setConnectionError(true);
          }
        );

        return unsubscribe;
      } catch {
        if (mounted) {
          setError("We couldn't reach the server to open these results — retry.");
          setIsLoading(false);
        }
      }
    };

    const unsubPromise = init();
    return () => {
      mounted = false;
      unsubPromise.then(unsub => unsub?.());
    };
  }, [pollId, user?.uid, loading, retryKey]);

  // --- Derived results data (memoized) ---------------------------------------
  // Computed unconditionally (with null guards) so the hooks run on every render,
  // then consumed in the success branch below. Memoizing keeps the maximize
  // dialog and share/description toggles from recomputing the whole matrix.
  const votesMap = pollState?.votes ?? null;
  const schedulingMode = pollState?.metadata?.schedulingMode;
  const timeSlots = pollState?.metadata?.timeSlots;

  const voteArray = useMemo(
    () =>
      votesMap
        ? Array.from(votesMap.entries()).map(([pubKey, data]) => ({ pubKey, ...data }))
        : [],
    [votesMap]
  );

  const voteCounts = useMemo(
    () =>
      (timeSlots ?? []).reduce((acc, slot) => {
        acc[slot.id] = { YES: 0, NO: 0, IF_NEED_BE: 0, BLANK: 0 };
        voteArray.forEach(v => {
          const val = v.selections[slot.id] || "BLANK";
          acc[slot.id][val]++;
        });
        return acc;
      }, {} as Record<string, Record<VoteValue, number>>),
    [timeSlots, voteArray]
  );

  const sortedSlots = useMemo(
    () =>
      [...(timeSlots ?? [])].sort((a, b) => {
        if (schedulingMode === "EXACT") {
          return new Date((a as ExactTimeSlot).startTime).getTime() - new Date((b as ExactTimeSlot).startTime).getTime();
        }
        return (a as FuzzyTimeSlot).date.localeCompare((b as FuzzyTimeSlot).date);
      }),
    [timeSlots, schedulingMode]
  );

  const topSlotIds = useMemo(() => {
    if (voteArray.length === 0) return [];
    let maxScore = -1;
    let ids: string[] = [];
    Object.entries(voteCounts).forEach(([id, counts]) => {
      const score = counts.YES * 2 + counts.IF_NEED_BE;
      if (score > maxScore) {
        maxScore = score;
        ids = [id];
      } else if (score === maxScore) {
        ids.push(id);
      }
    });
    return ids;
  }, [voteCounts, voteArray.length]);

  const bestSlotId = topSlotIds[0] || null;

  // Per-slot formatted header date/time labels for the matrix, precomputed so
  // MatrixTable receives plain strings and doesn't reparse Dates on every render.
  const slotHeaderLabels = useMemo(() => {
    const map = new Map<string, { date: string; time: string }>();
    sortedSlots.forEach(slot => {
      if (schedulingMode === "EXACT") {
        const start = new Date((slot as ExactTimeSlot).startTime);
        map.set(slot.id, {
          date: start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
          time: start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
        });
      } else {
        const fuzzy = slot as FuzzyTimeSlot;
        map.set(slot.id, {
          date: new Date(fuzzy.date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
          time: fuzzy.label,
        });
      }
    });
    return map;
  }, [sortedSlots, schedulingMode]);

  // Stable matrix callbacks (useCallback) so the memoized <MatrixTable> doesn't
  // re-render when the maximize dialog or share/description toggles flip state.
  const handleFinalize = useCallback(async (slotId: string) => {
    if (!session || !pollId) return;
    if (!(await askConfirm({
      title: "Confirm this time and close voting for everyone?",
      body: "Participants will no longer be able to respond. You can reopen voting later.",
      confirmLabel: "Confirm time",
      variant: "warning",
    }))) return;
    setFinalizing(slotId);
    try {
      const action: PollAction = { type: "POLL_FINALIZED", payload: { finalizedSlotId: slotId } };
      await session.appendEvent(action);
      toast({ variant: "success", message: "Time confirmed. Voting is now closed." });
    } catch {
      toast({ variant: "error", message: "We couldn't confirm that time. Try again." });
    } finally {
      setFinalizing(null);
    }
  }, [session, pollId, askConfirm, toast]);

  const handleComposeEmail = useCallback(() => {
    const meta = pollState?.metadata;
    if (!meta || voteArray.length === 0) return;

    const participantsWithEmail = voteArray
      .filter(v => !!v.email)
      .map(v => ({ name: v.participantName, email: v.email! }));

    const participantsWithoutEmail = voteArray
      .filter(v => !v.email)
      .map(v => v.participantName);

    if (participantsWithEmail.length === 0) {
      toast({ variant: "info", message: "None of your participants added an email, so there's no one to send to yet." });
      return;
    }

    const toString = participantsWithEmail
      .map(p => `"${p.name}" <${p.email}>`)
      .join(", ");

    const subject = `Meeting Update: ${meta.title}`;

    let bodyText = `Hi everyone,\n\n`;

    if (participantsWithoutEmail.length > 0) {
      bodyText += `[Note: The following participants' emails were unavailable and not included in this thread: ${participantsWithoutEmail.join(", ")}]\n\n`;
    }

    bodyText += `I'm writing to share an update regarding our meeting "${meta.title}".\n\n`;

    if (pollState?.isFinalized && pollState?.finalizedSlotId) {
      const slot = meta.timeSlots.find(s => s.id === pollState.finalizedSlotId);
      if (slot) {
        const dateStr = meta.schedulingMode === "EXACT"
          ? new Date((slot as ExactTimeSlot).startTime).toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
          : `${new Date((slot as FuzzyTimeSlot).date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} (${(slot as FuzzyTimeSlot).label})`;

        bodyText += `CONFIRMED DATE:\n${dateStr}\n\n`;
      }
    }

    if (meta.location) {
      bodyText += `LOCATION:\n${meta.location}\n\n`;
    }

    bodyText += `You can view the full results and the availability grid here: ${getShareableUrl()}\n\nBest regards,\n${user?.displayName || 'The Organizer'}`;

    const mailtoUrl = `mailto:?bcc=${encodeURIComponent(toString)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

    const link = document.createElement("a");
    link.href = mailtoUrl;

    // Validate protocol to prevent injection of javascript: or other schemes
    if (link.protocol === "mailto:") {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.error("Invalid mailto protocol generated");
    }
  }, [pollState, voteArray, toast, user]);

  if (isLoading) {
    return (
      <PageLoader
        testId="loader"
        heading="Loading results"
        message={friendlyStatus(syncStatus)}
      />
    );
  }

  if (error || !pollState || !pollState.metadata) {
    const isMissingKey = error?.startsWith("This link is missing its key");
    const canRetry = !!error && !isMissingKey;
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Lock className="w-16 h-16 text-neutral-300 mx-auto mb-6" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-neutral-800 mb-4">Privacy Protected</h1>
        <p className="text-neutral-600 text-lg mb-8">{error || "Access Denied."}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {canRetry && (
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className={buttonClasses("primary", "lg")}
            >
              <RotateCcw className="w-5 h-5" aria-hidden="true" />
              Retry
            </button>
          )}
          <Link to="/" className={canRetry ? buttonClasses("secondary", "lg") : buttonClasses("primary", "lg")}>Return to Home</Link>
        </div>
      </div>
    );
  }

  // `metadata` is guaranteed non-null here by the guard above. The derived data
  // (voteArray/voteCounts/sortedSlots/topSlotIds/bestSlotId/slotHeaderLabels) is
  // memoized at the top of the component.
  const { metadata } = pollState;


  const handleCopyLocation = async () => {
    if (metadata.location) {
      const ok = await copyToClipboard(metadata.location);
      if (ok) {
        setShowLocationCopied(true);
        setTimeout(() => setShowLocationCopied(false), 2000);
      } else {
        toast({ variant: "error", message: "We couldn't copy the location. Try copying it manually." });
      }
    }
  };

  const handleUnfinalize = async () => {
    if (!session || !pollId) return;
    if (!(await askConfirm({
      title: "Reopen voting?",
      body: "This unselects the confirmed time and lets participants respond again.",
      confirmLabel: "Reopen voting",
      variant: "warning",
    }))) return;

    setUnfinalizing(true);
    try {
      const action: PollAction = { type: "POLL_UNFINALIZED", payload: null };
      await session.appendEvent(action);
      toast({ variant: "success", message: "Voting reopened." });
    } catch {
      toast({ variant: "error", message: "We couldn't change the confirmed time. Try again." });
    } finally {
      setUnfinalizing(false);
    }
  };

  const getResultsLink = () => {
    return getShareableUrl();
  };

  const getPollLink = () => {
    return getShareableUrl().replace("/results", "");
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url: getResultsLink() });
        return;
      } catch {
        // User dismissed the share sheet or it failed — fall through to the modal.
      }
    }
    setShowShareModal(true);
  };

  const renderMatrixTable = (isCompact = false) => (
    <MatrixTable
      sortedSlots={sortedSlots}
      voteArray={voteArray}
      voteCounts={voteCounts}
      slotHeaderLabels={slotHeaderLabels}
      finalizedSlotId={pollState.finalizedSlotId ?? null}
      isFinalized={!!pollState.isFinalized}
      isCompact={isCompact}
      isAdmin={isAdmin}
      isReady={isReady}
      finalizing={finalizing}
      onFinalize={handleFinalize}
      onComposeEmail={handleComposeEmail}
    />
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
      {connectionError && (
        <div role="status" aria-live="polite" data-testid="connection-warning" className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl font-bold flex items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500 animate-pulse" size={20} aria-hidden="true" />
            <span>Trouble connecting. We'll keep trying to reconnect...</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setConnectionError(false);
              window.location.reload();
            }}
            className="px-4 py-1.5 bg-amber-600 text-white text-xs font-black rounded-lg hover:bg-amber-700 transition-colors shadow-sm"
          >
            Retry Now
          </button>
        </div>
      )}
      <Link to={`/poll/${pollId}${window.location.search}${window.location.hash}`} className="inline-flex items-center gap-2 text-brand-green-dark font-bold mb-8">
        <ArrowLeft size={16} aria-hidden="true" /> Back to Poll
      </Link>

      <div className={`${pollState.isFinalized ? 'bg-[#0a1108]' : 'bg-brand-gradient'} rounded-[3rem] shadow-2xl relative overflow-hidden transition-colors duration-700 mb-12`}>
        {/* Subtle Decorative Elements */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-green/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-brand-green/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-10">
          {/* Top Row: Title/Description */}
          <div className="flex flex-wrap items-start justify-between gap-10">
            <div className="flex-1 min-w-0 max-w-4xl">
              <div className="flex items-start gap-5">
                <div className="w-1.5 self-stretch bg-brand-green/40 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="relative group/expando">
                    <div 
                      ref={contentRef}
                      className="flex flex-col gap-4 min-w-0 transition-all duration-700 ease-in-out overflow-hidden"
                      style={{ 
                        maxHeight: isDescriptionExpanded ? `${contentHeight}px` : '180px',
                        maskImage: (metadata.description && metadata.description.length > 100 && !isDescriptionExpanded) ? 'linear-gradient(to bottom, black 60%, transparent 100%)' : 'none',
                        WebkitMaskImage: (metadata.description && metadata.description.length > 100 && !isDescriptionExpanded) ? 'linear-gradient(to bottom, black 60%, transparent 100%)' : 'none'
                      }}
                    >
                      <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm break-words leading-tight">
                        {metadata.title}
                      </h1>
                      {metadata.description && (
                        <p className="text-base md:text-lg text-white/80 font-medium max-w-3xl leading-relaxed break-words whitespace-pre-wrap">
                          {metadata.description}
                        </p>
                      )}
                    </div>

                    {metadata.description && metadata.description.length > 100 && (
                      <div className={`flex justify-center transition-all duration-500 ${
                        isDescriptionExpanded ? 'mt-8 relative z-20' : 'absolute bottom-2 left-0 w-full z-20'
                      }`}>
                        <button
                          onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                          className="group/btn flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/80 transition-all active:scale-95 shadow-lg"
                        >
                          {isDescriptionExpanded ? "Show Less" : "Show More"}
                          <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isDescriptionExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Confirmed Date / Top Choice Box - Featured on Results Page */}
            {bestSlotId && (
              (!pollState.isFinalized && voteArray.length < 2) ? (
                <div className="bg-white text-brand-charcoal p-8 rounded-[2.5rem] shadow-2xl flex items-center gap-6 w-full sm:w-auto sm:min-w-[320px] sm:max-w-md lg:ml-auto">
                  <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center text-neutral-500" aria-hidden="true">
                    <CalendarCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 mb-1">
                      Not enough responses yet
                    </p>
                    <p className="text-sm md:text-base font-medium text-neutral-600 leading-snug max-w-[220px]">
                      Once a couple of people respond, the leading time will show here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white text-brand-charcoal p-8 rounded-[2.5rem] shadow-2xl flex items-center gap-6 w-full sm:w-auto sm:min-w-[320px] sm:max-w-md transform hover:scale-[1.01] transition-transform duration-500 lg:ml-auto">
                  <div className="w-16 h-16 bg-brand-green rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-green/20" aria-hidden="true">
                    <CalendarCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 mb-1">
                      {pollState.isFinalized ? "CONFIRMED TIME" : "LEADING TIME"}
                    </p>
                    {(() => {
                      const slot = metadata.timeSlots.find(
                        s => s.id === (pollState.finalizedSlotId || bestSlotId)
                      );
                      const formatted = formatSlotLabel(slot, metadata.schedulingMode);
                      if (!formatted) {
                        return (
                          <p className="text-sm md:text-base font-medium text-neutral-600 leading-snug max-w-[260px]">
                            The confirmed time is no longer available — reopen voting or pick a new time.
                          </p>
                        );
                      }
                      return (
                        <p className="text-xl md:text-2xl font-black leading-tight">
                          {formatted}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Bottom Row: Action Cards */}
          <div className={`grid ${isAdmin ? 'grid-cols-2' : 'grid-cols-[1fr_auto]'} md:flex md:flex-wrap lg:flex-nowrap items-stretch gap-4`}>
            {/* Location Card - Row 1, Col 1 (Mobile) / Pos 1 (Desktop) */}
            {metadata.location && (
              <div className="order-1 col-span-2 md:col-span-1 flex-1 min-w-0">
                <ActionCard 
                  icon={<MapPin className="w-5 h-5" />}
                  label="Location"
                  value={metadata.location}
                  onCopy={handleCopyLocation}
                  isCopied={showLocationCopied}
                  theme="dark"
                  data-testid="poll-location"
                />
              </div>
            )}

            {/* Participation Card - Row 2, Col 1 (Mobile) / Pos 2 (Desktop) */}
            <div className={`order-2 flex-1 min-w-0 ${isAdmin ? 'col-span-2 md:order-2' : 'col-span-1 md:order-2'}`}>
              <ActionCard 
                icon={pollState.isFinalized ? <CheckCircle2 className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                label={pollState.isFinalized ? "Confirmed Attendance" : "Responses"}
                value={pollState.isFinalized 
                  ? `${voteArray.filter(v => v.selections[pollState.finalizedSlotId!] === "YES").length} People attending`
                  : `${voteArray.length} ${voteArray.length === 1 ? 'response' : 'responses'}`}
                theme="dark"
              />
            </div>

            {/* Admin Action Button - Row 3, Col 1 (Mobile) / Pos 4 (Desktop) */}
            {isAdmin && (
              <div className="order-3 col-span-1 md:order-4 flex-initial">
                {pollState.isFinalized ? (
                  <button
                    onClick={handleUnfinalize}
                    disabled={!isReady || unfinalizing}
                    aria-busy={unfinalizing}
                    aria-label="Unselect confirmed date"
                    className="w-full md:w-[84px] h-[72px] md:h-[84px] flex items-center justify-center gap-2 px-4 rounded-[1.5rem] md:rounded-[2rem] border border-brand-red/30 bg-brand-red/10 hover:bg-brand-red/20 text-brand-red transition-all active:scale-95 group shadow-xl disabled:opacity-50"
                    title="Unselect Date"
                  >
                    {unfinalizing ? (
                      <Loader2 size={24} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <>
                        <RotateCcw size={24} className="group-hover:rotate-[-45deg] transition-transform duration-500 flex-shrink-0" aria-hidden="true" />
                        <span className="text-sm font-bold md:hidden">Change Date</span>
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    to={`/poll/${pollId}/edit${window.location.search}${window.location.hash}`}
                    aria-label="Edit poll"
                    className={`w-full md:w-[84px] h-[72px] md:h-[84px] flex items-center justify-center gap-2 px-4 rounded-[1.5rem] md:rounded-[2rem] border border-brand-red/30 bg-brand-red/10 hover:bg-brand-red/20 text-brand-red transition-all active:scale-95 group shadow-xl ${!isReady ? 'pointer-events-none opacity-50' : ''}`}
                    title="Edit Poll"
                  >
                    <Edit3 size={24} className="group-hover:scale-110 transition-transform duration-500 flex-shrink-0" aria-hidden="true" />
                    <span className="text-sm font-bold md:hidden">Edit Poll</span>
                  </Link>
                )}
              </div>
            )}

            {/* Share Button - Row 3, Col 2 (Mobile) / Pos 3 (Desktop) */}
            <div className={`col-span-1 ${isAdmin ? 'order-4 md:order-3' : 'order-3 md:order-3'}`}>
              <CompactActionCard 
                icon={<Share2 className="w-6 h-6" />}
                label={isAdmin ? "Share Poll" : undefined}
                onAction={handleShare}
                isSuccess={false}
                theme="dark"
                data-testid="share-button"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-8 border border-neutral-100 shadow-xl">
        <div className="flex items-center justify-between mb-8">
           <h2 className="text-2xl font-bold text-neutral-800 flex items-center gap-3">
             <Info className="text-brand-green" aria-hidden="true" /> Availability Grid
           </h2>
           <button
             onClick={() => setIsMaximized(true)}
             disabled={!isReady}
             className="p-2 hover:bg-neutral-100 rounded-lg disabled:opacity-50"
             aria-label="Maximize availability grid"
           >
             <Maximize2 size={20} aria-hidden="true" />
           </button>
        </div>
        
        {voteArray.length === 0 ? (
          <EmptyState
            testId="results-empty-state"
            className="text-center py-20 px-6 bg-neutral-50 rounded-3xl border border-dashed border-neutral-200"
            icon={<Users className="w-12 h-12 text-neutral-300 mx-auto mb-4" aria-hidden="true" />}
            body="No responses yet. Share the poll link and answers will appear here in real time."
            bodyClassName="text-neutral-600 font-medium"
          />
        ) : (
          renderMatrixTable()
        )}
      </div>

      <Modal
        open={isMaximized}
        onClose={() => setIsMaximized(false)}
        labelledBy="maximize-dialog-title"
        variant="bare"
        size="fullscreen"
        closeOnBackdrop={false}
        backdropClassName="fixed inset-0 z-[120] bg-brand-charcoal/95 backdrop-blur-md p-3 md:p-8 flex flex-col"
        className="flex-1 min-h-0 flex flex-col"
      >
        <div className="flex justify-between items-center text-white mb-4 md:mb-8">
          <h2 id="maximize-dialog-title" className="text-xl md:text-2xl font-bold truncate pr-4">{metadata.title} - Grid</h2>
          <button
            onClick={() => setIsMaximized(false)}
            disabled={!isReady}
            className="p-2 hover:bg-white/10 rounded-full flex-shrink-0 disabled:opacity-50"
            aria-label="Close maximization"
          >
            <X size={32} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 bg-white rounded-2xl md:rounded-3xl overflow-auto p-1 md:p-4">
           {renderMatrixTable(true)}
        </div>
      </Modal>

      <Modal
        open={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setCopiedLinkType(null);
        }}
        labelledBy="share-dialog-title"
        variant="bare"
        size="lg"
        closeOnBackdrop={false}
        backdropClassName="fixed inset-0 z-[120] flex items-center justify-center bg-brand-charcoal/80 backdrop-blur-md p-4 animate-in fade-in duration-300"
        className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 md:p-10 border border-neutral-100 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Decorative Blur */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-green/5 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={() => {
            setShowShareModal(false);
            setCopiedLinkType(null);
          }}
          className="absolute top-6 right-6 p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 rounded-full transition-colors"
          aria-label="Close share dialog"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <div className="flex flex-col gap-6">
              <div>
                <h3 id="share-dialog-title" className="text-2xl font-black text-neutral-800 tracking-tight mb-2">Share this Poll</h3>
                <p className="text-neutral-600 text-sm font-medium">Which link would you like to copy?</p>
              </div>

              <div className="flex flex-col gap-4">
                {/* Option 1: Poll Link */}
                <button
                  onClick={async () => {
                    const ok = await copyToClipboard(getPollLink());
                    if (!ok) {
                      toast({ variant: "error", message: "We couldn't copy the link. Try copying it manually." });
                      return;
                    }
                    setCopiedLinkType('poll');
                    setTimeout(() => {
                      setShowShareModal(false);
                      setCopiedLinkType(null);
                    }, 1200);
                  }}
                  data-testid="share-poll-link-btn"
                  className={`w-full text-left p-6 rounded-3xl border-2 transition-all flex items-start gap-4 hover:scale-[1.01] active:scale-[0.99] ${
                    copiedLinkType === 'poll'
                      ? 'border-brand-green bg-brand-green-light/20'
                      : 'border-neutral-100 bg-white hover:border-neutral-200 hover:bg-neutral-50/50'
                  }`}
                >
                  <div className={`p-3 rounded-2xl ${
                    copiedLinkType === 'poll' ? 'bg-brand-green text-white' : 'bg-neutral-100 text-neutral-600'
                  }`}>
                    <Users size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-neutral-800 text-base">Poll Link (For Voting)</span>
                      {copiedLinkType === 'poll' && (
                        <span className="text-xs font-bold text-brand-green uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 size={14} /> Copied
                        </span>
                      )}
                    </div>
                    <p className="text-neutral-500 text-xs mt-1 leading-relaxed">
                      Allow others to view details and submit their availability.
                    </p>
                  </div>
                </button>

                {/* Option 2: Results Link */}
                <button
                  onClick={async () => {
                    const ok = await copyToClipboard(getResultsLink());
                    if (!ok) {
                      toast({ variant: "error", message: "We couldn't copy the link. Try copying it manually." });
                      return;
                    }
                    setCopiedLinkType('results');
                    setTimeout(() => {
                      setShowShareModal(false);
                      setCopiedLinkType(null);
                    }, 1200);
                  }}
                  data-testid="share-results-link-btn"
                  className={`w-full text-left p-6 rounded-3xl border-2 transition-all flex items-start gap-4 hover:scale-[1.01] active:scale-[0.99] ${
                    copiedLinkType === 'results'
                      ? 'border-brand-green bg-brand-green-light/20'
                      : 'border-neutral-100 bg-white hover:border-neutral-200 hover:bg-neutral-50/50'
                  }`}
                >
                  <div className={`p-3 rounded-2xl ${
                    copiedLinkType === 'results' ? 'bg-brand-green text-white' : 'bg-neutral-100 text-neutral-600'
                  }`}>
                    <CalendarCheck size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-neutral-800 text-base">Results Link (For Viewing)</span>
                      {copiedLinkType === 'results' && (
                        <span className="text-xs font-bold text-brand-green uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 size={14} /> Copied
                        </span>
                      )}
                    </div>
                    <p className="text-neutral-500 text-xs mt-1 leading-relaxed">
                      Allow others to view the response grid, totals, and final date.
                    </p>
                  </div>
                </button>
              </div>
            </div>
      </Modal>
    </div>
  );
}
