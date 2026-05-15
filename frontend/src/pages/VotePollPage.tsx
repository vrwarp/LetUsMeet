import { useEffect, useState, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Loader2, Share2, MapPin, User as UserIcon, CheckCircle, Calendar as CalendarIcon, ShieldCheck, Edit3, Plus, History, ChevronRight, ChevronDown, Lock, AlertTriangle } from "lucide-react";
import { 
  extractKeyFromFragment, 
  subscribeToLedger, 
  appendSignedEvent, 
  loadIdentity,
  saveToIndexedDB,
  saveToKeystore
} from "@/lib/pollService";
import { 
  importSymmetricKey, 
  generateIdentityKeyPair, 
  exportPrivateKey, 
  exportPublicKey 
} from "@/lib/crypto";
import { useAuth } from "@/hooks/useAuth";
import type { PollState, VoteValue, VoteData, PollAction } from "../types";
import TimeSlotCard from "@/components/TimeSlotCard";
import ActionCard from "@/components/ActionCard";
import CompactActionCard from "@/components/CompactActionCard";

export default function VotePollPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const { user, loading: isAuthLoading } = useAuth();
  
  const [pollState, setPollState] = useState<PollState | null>(null);
  const [syncStatus, setSyncStatus] = useState("Initializing...");
  const [symmetricKey, setSymmetricKey] = useState<CryptoKey | null>(null);
  const [identity, setIdentity] = useState<{ privateKey: CryptoKey, publicKey: CryptoKey } | null>(null);
  const [publicKeyB64, setPublicKeyB64] = useState<string | null>(null);
  
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
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [pollState?.metadata]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 3000);
  };

  const handleCopyLocation = () => {
    if (pollState?.metadata?.location) {
      navigator.clipboard.writeText(pollState.metadata.location);
      setShowLocationCopied(true);
      setTimeout(() => setShowLocationCopied(false), 3000);
    }
  };
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [editingResponseId, setEditingResponseId] = useState<string>(crypto.randomUUID());

  // 1. Initialize Crypto and Subscribe
  useEffect(() => {
    if (!pollId) return;
    let mounted = true;

    const b64Key = extractKeyFromFragment();
    if (!b64Key) {
      setInitError("This poll requires a secret key in the URL fragment (#key=...). Please check the link.");
      setIsLoading(false);
      return;
    }

    const init = async () => {
      try {
        // Import Symmetric Key
        const key = await importSymmetricKey(b64Key);
        if (mounted) setSymmetricKey(key);

        // Load Identity
        let id = await loadIdentity(pollId);
        if (!id) {
          // Generate new identity for this poll
          const pair = await generateIdentityKeyPair();
          const priv = await exportPrivateKey(pair.privateKey);
          const pub = await exportPublicKey(pair.publicKey);
          
          if (user && !user.isAnonymous) {
             await saveToKeystore(pollId, {
               symmetricPollKey: b64Key,
               ecdsaPrivateKey: priv,
               ecdsaPublicKey: pub
             });
          } else {
             await saveToIndexedDB(pollId, { privateKey: priv, publicKey: pub });
          }
          id = pair;
        }
        if (mounted) {
          setIdentity(id);
          exportPublicKey(id.publicKey).then(pub => {
            if (mounted) setPublicKeyB64(pub);
          });
        }

        // Subscribe to Ledger
        const unsubscribe = subscribeToLedger(pollId, key, (state, status) => {
          if (!mounted) return;
          if (state) setPollState(state);
          setSyncStatus(status);
          setIsLoading(false);
        });

        return unsubscribe;
      } catch (err: any) {
        console.error("Initialization failed", err);
        if (mounted) {
          setInitError("Failed to initialize cryptographic session.");
          setIsLoading(false);
        }
      }
    };

    const unsubPromise = init();
    return () => { 
      mounted = false;
      unsubPromise.then(unsub => unsub?.()); 
    };
  }, [pollId, user?.uid]);

  // 2. Derive User Votes
  const userVotes = (pollState && publicKeyB64) ? Array.from(pollState.votes.entries())
    .filter(([key]) => key.startsWith(publicKeyB64 + ":"))
    .map(([, vote]) => vote)
    .sort((a, b) => b.clientTimestamp - a.clientTimestamp)
    : [];

  // Auto-initialize form with first vote if not already editing something specific
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (userVotes.length > 0 && !hasInitializedRef.current && pollState?.metadata) {
      const latest = userVotes[0];
      setSelections(latest.selections);
      setParticipantName(latest.participantName);
      setParticipantEmail(latest.email || "");
      setEditingResponseId(latest.responseId);
      hasInitializedRef.current = true;
    } else if (user?.displayName && !participantName && !hasInitializedRef.current) {
      setParticipantName(user.displayName);
      setParticipantEmail(user.email || "");
    }
  }, [userVotes.length, pollState?.metadata, user?.displayName, user?.email]);

  const handleNewResponse = () => {
    setEditingResponseId(crypto.randomUUID());
    setParticipantName(user?.displayName || "");
    setParticipantEmail(user?.email || "");
    const initial: Record<string, VoteValue> = {};
    pollState?.metadata?.timeSlots.forEach(s => initial[s.id] = "NO");
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
    
    if (!symmetricKey || !identity || !pollId) {
      setError("Cryptographic keys not ready.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const voteData: VoteData = {
        responseId: editingResponseId,
        participantName,
        email: participantEmail,
        selections,
        clientTimestamp: Date.now()
      };

      const action: PollAction = { type: "VOTE_UPSERT", payload: voteData };
      await appendSignedEvent(pollId, symmetricKey, identity.privateKey, identity.publicKey, action);
      
      setSuccess(true);
    } catch (err: any) {
      console.error("Vote submission failed:", err);
      setError(err.message || "Failed to submit encrypted vote.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetract = async () => {
    if (!symmetricKey || !identity || !pollId) return;
    if (!confirm("Are you sure you want to retract your vote?")) return;

    setIsSubmitting(true);
    try {
      const action: PollAction = { type: "VOTE_RETRACTED", payload: { responseId: editingResponseId } };
      await appendSignedEvent(pollId, symmetricKey, identity.privateKey, identity.publicKey, action);
      setSuccess(true);
    } catch (err: any) {
      setError("Failed to retract vote.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" data-testid="loader">
        <Loader2 className="w-10 h-10 text-brand-green animate-spin" />
        <p className="text-neutral-600 font-medium">{syncStatus}</p>
      </div>
    );
  }

  if (initError || !pollState || !pollState.metadata) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Lock className="w-16 h-16 text-neutral-300 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-neutral-800 mb-4">Privacy Protected</h2>
        <p className="text-neutral-600 text-lg mb-8">{initError || "This poll is encrypted. You need the secret key to view it."}</p>
        <Link to="/" className="btn-primary-green inline-block">Return to Home</Link>
      </div>
    );
  }

  const { metadata } = pollState;
  const sortedSlots = [...metadata.timeSlots].sort((a, b) => {
    if (metadata.schedulingMode === "EXACT") {
      return new Date((a as any).startTime).getTime() - new Date((b as any).startTime).getTime();
    }
    return (a as any).date.localeCompare((b as any).date);
  });

  if (pollState.isFinalized) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="bg-amber-50 rounded-3xl p-10 border border-amber-100">
          <CalendarIcon className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-800 mb-2">Poll Finalized</h2>
          <p className="text-neutral-600 mb-6">This poll has been finalized and is no longer accepting votes.</p>
          <Link to={`/poll/${pollId}/results${window.location.hash}`} className="inline-block bg-brand-green text-white font-bold px-8 py-3 rounded-xl hover:bg-brand-green-dark transition-colors">
            View Final Results
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="bg-brand-green-light/50 rounded-3xl p-10 border border-brand-green-light">
          <CheckCircle className="w-16 h-16 text-brand-green mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-neutral-800 mb-3">Vote Recorded!</h2>
          <p className="text-neutral-600 mb-8">Your availability has been encrypted and added to the ledger.</p>
          <div className="flex flex-col gap-4">
            <Link to={`/poll/${pollId}/results${window.location.hash}`} className="btn-primary-green w-full text-center py-4">
              View Group Availability
            </Link>
            <button onClick={() => setSuccess(false)} className="text-neutral-600 font-semibold">
              Back to poll
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
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
                            <div className="flex items-center gap-2 mb-2">
                               <ShieldCheck size={16} className="text-brand-green" />
                               <span className="text-[10px] font-black uppercase tracking-widest text-brand-green">Zero-Knowledge Poll</span>
                            </div>
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
                              <ChevronDown size={14} className="text-neutral-600 group-hover/btn:text-brand-green-dark" />
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
                to={`/poll/${pollId}/results${window.location.hash}`}
                data-testid="view-results-link"
                className="group flex-1 md:flex-initial flex items-center justify-center gap-3 bg-brand-green text-white hover:bg-brand-green-dark transition-all rounded-[1.5rem] md:rounded-[2rem] px-10 py-4 min-h-[72px] md:min-h-[84px] font-black text-xl active:scale-95 shadow-xl shadow-brand-green/20"
              >
                <History className="w-7 h-7 group-hover:rotate-12 transition-transform" />
                <span>Results</span>
              </Link>

              {/* Share Button */}
              <CompactActionCard 
                icon={<Share2 className="w-6 h-6" />}
                onAction={handleShare}
                isSuccess={showCopied}
                theme="light"
                data-testid="share-button"
              />
            </div>
          </div>
        </div>
      </div>

      {userVotes.length > 0 && (
        <div className="mb-10 p-5 bg-indigo-50 border border-indigo-100 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex-shrink-0 flex items-center justify-center text-white shadow-lg shadow-indigo-200 mt-1">
                <History className="w-5 h-5" />
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
                <Plus size={16} />
                Submit New Response
              </button>
            </div>
          </div>
          
          {userVotes.length > 1 && (
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedSlots.map(slot => (
              <TimeSlotCard
                key={slot.id}
                slot={slot}
                value={selections[slot.id] || "NO"}
                onChange={(val) => handleVoteChange(slot.id, val)}
              />
            ))}
          </div>
        </section>

        <section className="bg-white rounded-3xl p-8 border border-neutral-100 shadow-xl shadow-indigo-100/20">
          <h2 className="text-2xl font-bold text-neutral-800 mb-8 flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 text-sm">2</span>
            Basic Information
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
                  className="w-full"
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
                />
              </div>
            </div>
            <p className="text-xs text-neutral-500 italic">This name will be encrypted and visible only to participants with the link.</p>
          </div>
        </section>
        
        {error && (
          <div data-testid="error-message" className="p-4 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center gap-2">
            <AlertTriangle size={20} />
            {error}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-brand-green text-white !py-6 !text-2xl font-black rounded-3xl hover:bg-brand-green-dark shadow-xl transition-all flex items-center justify-center gap-4"
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : "Submit Vote"}
          </button>
          
          <button
            type="button"
            onClick={handleRetract}
            className="px-8 py-6 text-red-600 font-bold hover:bg-red-50 rounded-3xl transition-all"
          >
            Retract Vote
          </button>
        </div>
      </form>
    </div>
  );
}
