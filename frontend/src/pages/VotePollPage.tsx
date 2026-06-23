import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Loader2, Share2, MapPin, User as UserIcon, CalendarIcon, Plus, History, ChevronDown, Lock, AlertTriangle, Edit3 } from "lucide-react";
import {
  extractKeyFromFragment,
  subscribeToLedger,
  getShareableUrl,
  getLedgerSession,
  friendlyStatus
} from "@/lib/pollService";
import type { LedgerSession } from "charproof";
import { useAuth } from "@/hooks/useAuth";
import type { PollState, VoteValue, VoteData, PollAction, ExactTimeSlot, FuzzyTimeSlot } from "../types";
import TimeSlotCard from "@/components/TimeSlotCard";
import ActionCard from "@/components/ActionCard";
import CompactActionCard from "@/components/CompactActionCard";
import ClaimBanner from "@/components/ClaimBanner";
import Button from "@/components/Button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/components/toast/toastContext";
import { useConfirm } from "@/components/confirm/confirmContext";
import { copyToClipboard } from "@/lib/clipboard";

export default function VotePollPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const { user, loading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const askConfirm = useConfirm();

  useEffect(() => {
    // Mount gate: enable interactive controls only after hydration to avoid click-before-ready.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReady(true);
  }, []);

  const [pollState, setPollState] = useState<PollState | null>(null);
  const [syncStatus, setSyncStatus] = useState("Loading this poll…");
  const [session, setSession] = useState<LedgerSession | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const [selections, setSelections] = useState<Record<string, VoteValue>>({});
  const [participantName, setParticipantName] = useState("");
  const [participantEmail, setParticipantEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [showCopied, setShowCopied] = useState(false);
  const [showLocationCopied, setShowLocationCopied] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  const toggleExpando = () => setIsDescriptionExpanded(!isDescriptionExpanded);

  useEffect(() => {
    if (contentRef.current) {
      // Layout measurement: reads DOM size after render.
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [pollState?.metadata]);

  const handleShare = async () => {
    const shareUrl = getShareableUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url: shareUrl });
        return;
      } catch {
        // User dismissed the share sheet or it failed — fall through to clipboard copy.
      }
    }
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 3000);
    } else {
      toast({ variant: "error", message: "We couldn't copy the link. Try copying it manually." });
    }
  };

  const handleCopyLocation = async () => {
    if (pollState?.metadata?.location) {
      const ok = await copyToClipboard(pollState.metadata.location);
      if (ok) {
        setShowLocationCopied(true);
        setTimeout(() => setShowLocationCopied(false), 3000);
      } else {
        toast({ variant: "error", message: "We couldn't copy the location. Try copying it manually." });
      }
    }
  };
  const [error, setError] = useState<string | null>(null);
  const [editingResponseId, setEditingResponseId] = useState<string>(crypto.randomUUID());

  useDocumentTitle(
    pollState?.metadata?.title
      ? `${pollState.metadata.title} — Vote — LetUsMeet`
      : "Vote on a poll — LetUsMeet"
  );

  // 1. Initialize Crypto and Subscribe
  useEffect(() => {
    if (loading) return;
    if (!pollId) return;
    let mounted = true;

    const b64Key = extractKeyFromFragment();
    if (!b64Key) {
      // Async init: load/error state is set from this init path; cannot derive in render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInitError("This link is missing the part that unlocks the poll. Ask the organizer to resend the full link.");
      setIsLoading(false);
      return;
    }

    setInitError(null);
    setIsLoading(true);

    const init = async () => {
      try {
        const s = await getLedgerSession(pollId, { shareableKey: b64Key });
        if (mounted) setSession(s);

        // Subscribe to Ledger
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
      } catch (err) {
        console.error("Initialization failed", err);
        if (mounted) {
          setInitError("We couldn't securely open this poll. Refresh the page to try again.");
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

  // 2. Derive User Votes (memoized so it's a stable, honest dependency for the
  // auto-init effect below; recomputes only when the votes map or session changes).
  const userVotes = useMemo(
    () => (pollState && session)
      ? Array.from(pollState.votes.entries())
        .filter(([key]) => key.startsWith(session.getSignerPublicKey() + ":"))
        .map(([, vote]) => vote)
        .sort((a, b) => b.clientTimestamp - a.clientTimestamp)
      : [],
    [pollState, session]
  );

  // Detect organizer: signer matches the poll's admin public key (same check Results uses).
  const isAdmin = !!(session && pollState?.adminPublicKey && session.getSignerPublicKey() === pollState.adminPublicKey);

  // Auto-initialize form with first vote if not already editing something specific
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (!pollState?.metadata) return; // Wait for poll data to load
    if (loading) return; // Wait for auth to resolve

    const savedDraftStr = localStorage.getItem(`draft_${pollId}`);
    let draftLoaded = false;

    if (savedDraftStr) {
      try {
        const draft = JSON.parse(savedDraftStr);
        // One-shot init (guarded by hasInitializedRef): seed the form from the saved
        // draft / latest vote. Set from async-resolved data; cannot derive in render.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelections(draft.selections || {});
        setParticipantName(draft.participantName || "");
        setParticipantEmail(draft.participantEmail || "");
        setEditingResponseId(draft.editingResponseId || crypto.randomUUID());
        draftLoaded = true;
      } catch (e) {
        console.error("Failed to parse saved draft:", e);
      }
    }

    if (!draftLoaded && userVotes.length > 0) {
      const latest = userVotes[0];
      setSelections(latest.selections);
      setParticipantName(latest.participantName);
      setParticipantEmail(latest.email || "");
      setEditingResponseId(latest.responseId);
    } else if (!draftLoaded && user?.displayName && !participantName) {
      setParticipantName(user.displayName);
      setParticipantEmail(user.email || "");
    }

    hasInitializedRef.current = true;
  }, [userVotes, pollState?.metadata, user?.displayName, user?.email, pollId, loading, participantName]);

  useEffect(() => {
    if (hasInitializedRef.current && pollId) {
      localStorage.setItem(
        `draft_${pollId}`,
        JSON.stringify({
          editingResponseId,
          participantName,
          participantEmail,
          selections,
        })
      );
    }
  }, [editingResponseId, participantName, participantEmail, selections, pollId]);

  const handleNewResponse = () => {
    setEditingResponseId(crypto.randomUUID());
    setParticipantName(user?.displayName || "");
    setParticipantEmail(user?.email || "");
    const initial: Record<string, VoteValue> = {};
    pollState?.metadata?.timeSlots.forEach(s => initial[s.id] = "BLANK");
    setSelections(initial);
  };

  const handleSelectResponse = (vote: VoteData) => {
    setEditingResponseId(vote.responseId);
    setParticipantName(vote.participantName);
    setParticipantEmail(vote.email || "");
    setSelections(vote.selections);
  };

  const handleVoteChange = (slotId: string, value: VoteValue) => {
    setSelections(prev => ({ ...prev, [slotId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantName.trim()) {
      setError("Please enter your name.");
      return;
    }
    
    if (!session || !pollId) {
      setError("Still getting things ready — give it a second and try again.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError("You're offline. Reconnect and we'll save your response.");
      setIsSubmitting(false);
      return;
    }

    try {
      const voteData: VoteData = {
        responseId: editingResponseId,
        participantName,
        email: participantEmail,
        selections,
        clientTimestamp: Date.now()
      };

      const action: PollAction = { type: "VOTE_UPSERT", payload: voteData };
      await session.appendEvent(action);

      localStorage.removeItem(`draft_${pollId}`);
      toast({ variant: "success", message: "Response saved — you can edit anytime." });
      navigate(`/poll/${pollId}/results${window.location.search}${window.location.hash}`);
    } catch (err) {
      console.error("Vote submission failed:", err);
      setError((err instanceof Error ? err.message : "") || "We couldn't save your response. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetract = async () => {
    if (!session || !pollId) return;
    if (!(await askConfirm({
      title: "Retract your response?",
      body: "This removes your response from this poll. You can submit a new one anytime.",
      confirmLabel: "Retract",
      variant: "danger",
    }))) return;

    setIsSubmitting(true);
    try {
      const action: PollAction = { type: "VOTE_RETRACTED", payload: { responseId: editingResponseId } };
      await session.appendEvent(action);
      localStorage.removeItem(`draft_${pollId}`);
      toast({ variant: "success", message: "Your response was retracted." });
      navigate(`/poll/${pollId}/results${window.location.search}${window.location.hash}`);
    } catch {
      setError("Failed to retract vote.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" data-testid="loader">
        <h1 className="sr-only">Loading poll</h1>
        <Loader2 className="w-10 h-10 text-brand-green animate-spin" aria-hidden="true" />
        <p role="status" aria-live="polite" className="text-neutral-600 font-medium">{friendlyStatus(syncStatus)}</p>
      </div>
    );
  }

  if (initError || !pollState || !pollState.metadata) {
    const isMissingKey = initError?.startsWith("This link is missing");
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Lock className="w-16 h-16 text-neutral-300 mx-auto mb-6" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-neutral-800 mb-4">Privacy Protected</h1>
        <p className="text-neutral-600 text-lg mb-8">{initError || "This poll is private. Open it using the full link the organizer shared with you."}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {initError && !isMissingKey && (
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="btn-primary-green inline-flex items-center gap-2"
            >
              <History className="w-5 h-5 -scale-x-100" aria-hidden="true" />
              Retry
            </button>
          )}
          <Link to="/" className={initError && !isMissingKey ? "px-6 py-3 rounded-xl font-bold border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors inline-block" : "btn-primary-green inline-block"}>Return to Home</Link>
        </div>
      </div>
    );
  }

  const { metadata } = pollState;
  const sortedSlots = [...metadata.timeSlots].sort((a, b) => {
    if (metadata.schedulingMode === "EXACT") {
      return new Date((a as ExactTimeSlot).startTime).getTime() - new Date((b as ExactTimeSlot).startTime).getTime();
    }
    return (a as FuzzyTimeSlot).date.localeCompare((b as FuzzyTimeSlot).date);
  });

  if (pollState.isFinalized) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="bg-amber-50 rounded-3xl p-10 border border-amber-100">
          <CalendarIcon className="w-12 h-12 text-amber-500 mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-neutral-800 mb-2">Poll Finalized</h1>
          <p className="text-neutral-600 mb-6">The organizer has confirmed a time, so responses are now closed.</p>
          <Link to={`/poll/${pollId}/results${window.location.search}${window.location.hash}`} className="inline-block bg-brand-green text-white font-bold px-8 py-3 rounded-xl hover:bg-brand-green-dark transition-colors">
            View Final Results
          </Link>
        </div>
      </div>
    );
  }

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
      {/* Header Card - Restored Design */}
      <div className="bg-white rounded-[3rem] shadow-2xl border border-neutral-100 mb-12 overflow-hidden">
        <div className="bg-white text-brand-charcoal px-4 sm:px-8 py-8 sm:py-12 relative overflow-hidden">
          {/* Subtle Decorative Elements */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-green-light/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-brand-green-light/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-10">
            {/* Top Row: Title/Description */}
            <div className="flex flex-wrap items-start justify-between gap-10">
              <div className="flex-1 min-w-0 max-w-4xl">
                <div className="flex items-start gap-5">
                  <div className="w-1.5 self-stretch bg-brand-green/20 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="relative group/expando">
                      {(() => {
                        const canExpand = (metadata.title.length > 80) || (metadata.description && metadata.description.length > 100);
                        return (
                          <div 
                            ref={contentRef}
                            className="flex flex-col gap-4 min-w-0 transition-all duration-700 ease-in-out overflow-hidden"
                            style={{ 
                              maxHeight: isDescriptionExpanded ? `${contentHeight}px` : '200px',
                              maskImage: (canExpand && !isDescriptionExpanded) ? 'linear-gradient(to bottom, black 60%, transparent 95%)' : 'none',
                              WebkitMaskImage: (canExpand && !isDescriptionExpanded) ? 'linear-gradient(to bottom, black 60%, transparent 95%)' : 'none'
                            }}
                          >
                            <h1 data-testid="poll-title" className="text-3xl md:text-5xl font-black tracking-tight text-brand-green-dark drop-shadow-sm break-words leading-tight">
                              {metadata.title}
                            </h1>
                            {metadata.description && (
                              <p className="text-base md:text-lg text-neutral-600 font-medium max-w-3xl leading-relaxed break-words whitespace-pre-wrap">
                                {metadata.description}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                      
                      {((metadata.title.length > 80) || (metadata.description && metadata.description.length > 100)) && (
                        <div className={`flex justify-center transition-all duration-500 ${
                          isDescriptionExpanded 
                            ? 'mt-8 relative z-20' 
                            : 'absolute bottom-2 left-0 w-full z-20'
                        }`}>
                          <button 
                            onClick={toggleExpando}
                            type="button"
                            className="group/btn relative flex items-center gap-2 px-6 py-2.5 bg-neutral-100 hover:bg-neutral-200 active:scale-95 transition-all rounded-full border border-neutral-200 shadow-lg"
                          >
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-600 group-hover/btn:text-brand-green-dark transition-colors">
                              {isDescriptionExpanded ? 'Show Less' : 'Show More'}
                            </span>
                            <div className={`transition-transform duration-500 ${isDescriptionExpanded ? 'rotate-180' : ''}`}>
                              <ChevronDown size={14} className="text-neutral-600 group-hover/btn:text-brand-green-dark" aria-hidden="true" />
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Action Cards */}
            <div className="flex flex-wrap items-stretch gap-4">
              {/* Location Card */}
              {metadata.location && (
                <ActionCard 
                  icon={<MapPin className="w-5 h-5" />}
                  label="Location"
                  value={metadata.location}
                  onCopy={handleCopyLocation}
                  isCopied={showLocationCopied}
                  theme="light"
                  data-testid="poll-location"
                />
              )}

              {/* Organizer Card */}
              <ActionCard 
                icon={<UserIcon className="w-5 h-5" />}
                label="Organizer"
                value={metadata.organizerName || "Organizer"}
                theme="light"
                data-testid="poll-organizer"
              />

              {/* Results Button */}
              <Link 
                to={`/poll/${pollId}/results${window.location.search}${window.location.hash}`}
                data-testid="view-results-link"
                className="group flex-1 md:flex-initial flex items-center justify-center gap-3 bg-brand-green text-white hover:bg-brand-green-dark transition-all rounded-[1.5rem] md:rounded-[2rem] px-10 py-4 min-h-[72px] md:min-h-[84px] font-black text-xl active:scale-95 shadow-xl shadow-brand-green/20"
              >
                <History className="w-7 h-7 group-hover:rotate-12 transition-transform" aria-hidden="true" />
                <span>Results</span>
              </Link>

              {/* Edit Poll Button (organizer only) */}
              {isAdmin && (
                <Link
                  to={`/poll/${pollId}/edit${window.location.search}${window.location.hash}`}
                  data-testid="edit-poll-link"
                  title="Edit poll"
                  className="group flex items-center justify-center gap-2 px-6 md:px-0 md:w-[84px] h-[72px] md:h-[84px] rounded-[1.5rem] md:rounded-[2rem] border border-brand-red/30 bg-brand-red/10 hover:bg-brand-red/20 text-brand-red transition-all active:scale-95 shadow-xl"
                >
                  <Edit3 className="w-6 h-6 group-hover:scale-110 transition-transform flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm font-bold md:hidden">Edit poll</span>
                </Link>
              )}

              {/* Share Button */}
              <CompactActionCard
                icon={<Share2 className="w-6 h-6" />}
                ariaLabel="Copy link to share"
                onAction={handleShare}
                isSuccess={showCopied}
                theme="light"
                data-testid="share-button"
              />
            </div>
          </div>
        </div>
        <ClaimBanner />
      </div>

      {userVotes.length > 0 && (
        <div className="mb-10 p-5 bg-indigo-50 border border-indigo-100 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex-shrink-0 flex items-center justify-center text-white shadow-lg shadow-indigo-200 mt-1">
                <History className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-neutral-800 text-base leading-snug">
                  {userVotes.length === 1 
                    ? "You've already submitted a response" 
                    : `You've submitted ${userVotes.length} responses`}
                </h2>
                <p className="text-neutral-600 text-xs mt-1 font-medium">
                  {userVotes.find(v => v.responseId === editingResponseId) 
                    ? "Editing your previous response. You can update it or start fresh." 
                    : "Submitting a new response. You can also edit your existing ones below."}
                </p>
              </div>
            </div>
            <div className="flex flex-col xs:flex-row items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleNewResponse}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 whitespace-nowrap"
              >
                <Plus size={16} aria-hidden="true" />
                Submit New Response
              </button>
            </div>
          </div>
          
          {userVotes.length > 0 && (
            <div className="mt-5 pt-5 border-t border-indigo-100">
              <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider mb-3">Switch between your responses:</p>
              <div className="flex flex-wrap gap-2">
                {userVotes.map((v) => (
                  <button
                    key={v.responseId}
                    type="button"
                    onClick={() => handleSelectResponse(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      editingResponseId === v.responseId 
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                        : "bg-white text-neutral-600 border border-neutral-200 hover:border-indigo-300"
                    }`}
                  >
                    {v.participantName || "Anonymous"} ({new Date(v.clientTimestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-12">
        <section className="bg-white rounded-3xl p-8 border border-neutral-100 shadow-xl shadow-indigo-100/20">
          <h2 className="text-2xl font-bold text-neutral-800 mb-8 flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-green-light/50 text-brand-green-dark text-sm">1</span>
            Your Availability
          </h2>
          <p className="text-sm text-neutral-500 -mt-4 mb-8">Tap a time to cycle through Yes → If need be → No.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedSlots.map(slot => (
              <TimeSlotCard
                key={slot.id}
                slot={slot}
                value={selections[slot.id] || "BLANK"}
                onChange={(val) => handleVoteChange(slot.id, val)}
                disabled={!isReady}
              />
            ))}
          </div>
        </section>

        <section className="bg-white rounded-3xl p-8 border border-neutral-100 shadow-xl shadow-indigo-100/20">
          <h2 className="text-2xl font-bold text-neutral-800 mb-8 flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 text-sm">2</span>
            Your details
          </h2>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="participantName" className="block text-sm font-bold text-neutral-700 uppercase tracking-wider">
                  Your Name
                </label>
                <input
                  id="participantName"
                  type="text"
                  required
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Jane Doe"
                  data-testid="participant-name-input"
                  className="w-full"
                  disabled={!isReady}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="participantEmail" className="block text-sm font-bold text-neutral-700 uppercase tracking-wider">
                  Email Address (Optional)
                </label>
                <input
                  id="participantEmail"
                  type="email"
                  value={participantEmail}
                  onChange={(e) => setParticipantEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full"
                  disabled={!isReady}
                />
                <p className="text-xs text-neutral-500">Optional — lets the organizer email you when a time is confirmed.</p>
              </div>
            </div>
            <p className="text-xs text-neutral-500 italic">Your name is encrypted and only visible to people you share the link with.</p>
          </div>
        </section>
        
        {error && (
          <div role="alert" data-testid="error-message" className="p-4 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center gap-2">
            <AlertTriangle size={20} aria-hidden="true" />
            {error}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4">
          <Button
            type="submit"
            size="lg"
            aria-busy={isSubmitting}
            disabled={!isReady || isSubmitting || !participantName.trim()}
            data-testid="vote-submit-btn"
            className="flex-1 shadow-xl disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : "Send my response"}
          </Button>
          
          {userVotes.some(v => v.responseId === editingResponseId) && (
            <button
              type="button"
              onClick={handleRetract}
              disabled={!isReady || isSubmitting}
              className="px-8 py-6 text-red-600 font-bold hover:bg-red-50 rounded-3xl transition-all disabled:opacity-50"
            >
              Retract Vote
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
