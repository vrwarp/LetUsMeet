import { useEffect, useState, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Loader2, Share2, MapPin, User as UserIcon, CheckCircle, Calendar as CalendarIcon, ShieldCheck, Edit3, Plus, History, ChevronRight, ChevronDown } from "lucide-react";
import { subscribeToPoll, submitVote, deleteVote, claimPoll, ensureAdminGrant } from "@/lib/pollService";
import { useAuth } from "@/hooks/useAuth";
import type { Poll, Vote, VoteValue } from "../types/index";
import TimeSlotCard from "@/components/TimeSlotCard";
import ActionCard from "@/components/ActionCard";
import CompactActionCard from "@/components/CompactActionCard";

export default function VotePollPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const { user, loading: isAuthLoading } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [poll, setPoll] = useState<Poll | null>(null);
  const [selections, setSelections] = useState<Record<string, VoteValue>>({});
  const [participantName, setParticipantName] = useState("");
  const [participantEmail, setParticipantEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCopied, setShowCopied] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userVotes, setUserVotes] = useState<Vote[]>([]);
  const [showLocationCopied, setShowLocationCopied] = useState(false);
  const [showAdminLinkCopied, setShowAdminLinkCopied] = useState(false);
  const [editingVoteId, setEditingVoteId] = useState<string | null>(null);
  const [lastSubmissionWasUpdate, setLastSubmissionWasUpdate] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isTokenAdmin, setIsTokenAdmin] = useState(false);
  const hasInitializedFormRef = useRef(false);
  const hasInitializedWithVoteRef = useRef(false);

  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [poll, isDescriptionExpanded]);

  const toggleExpando = () => {
    setIsDescriptionExpanded(!isDescriptionExpanded);
  };

  const [hasPrefilled, setHasPrefilled] = useState(false);

  useEffect(() => {
    if (!hasPrefilled && user && !user.isAnonymous) {
      if (user.displayName) setParticipantName(user.displayName);
      if (user.email) setParticipantEmail(user.email);
      if (user.displayName || user.email) {
        setHasPrefilled(true);
      }
    }
  }, [user, hasPrefilled]);

  // const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

  const [allVotes, setAllVotes] = useState<Vote[]>([]);

  useEffect(() => {
    if (!pollId) return;
    
    setIsLoading(true);
    const unsubscribe = subscribeToPoll(pollId, (data) => {
      setPoll(data.poll as any);
      setAllVotes(data.votes as any);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [pollId]);

  useEffect(() => {
    if (poll && user) {
      const myVotes = allVotes.filter((v: Vote) => v.participantUid === user.uid);
      setUserVotes(myVotes);
      
      const foundVote = myVotes.length > 0;
      
      if (foundVote && !hasInitializedWithVoteRef.current) {
        // Initialize with existing vote (even if we already initialized as empty)
        const latestVote = [...myVotes].sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0];
        loadVoteIntoForm(latestVote);
        hasInitializedWithVoteRef.current = true;
        hasInitializedFormRef.current = true;
      } else if (!hasInitializedFormRef.current) {
        // Initialize as empty for now
        initializeEmptyForm(poll);
        hasInitializedFormRef.current = true;
      }
    } else if (poll && !user && !hasInitializedFormRef.current) {
      initializeEmptyForm(poll);
      hasInitializedFormRef.current = true;
    }
  }, [poll, user?.uid, allVotes]);

  const initializeEmptyForm = (pollData: Poll) => {
    const initial: Record<string, VoteValue> = {};
    pollData.timeSlots.forEach((slot: any) => {
      initial[slot.id] = "NO";
    });
    setSelections(initial);
    setParticipantName(user?.displayName || "");
    setParticipantEmail(user?.email || "");
    setEditingVoteId(null);
    hasInitializedWithVoteRef.current = false;
  };

  const loadVoteIntoForm = (vote: Vote) => {
    setSelections(vote.selections || {});
    setParticipantName(vote.participantName || "");
    setParticipantEmail(vote.participantEmail || "");
    setEditingVoteId(vote.voteId || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantName.trim()) {
      setError("Please enter your name.");
      return;
    }
    
    if (isAuthLoading || !user) {
      setError("Waiting for authentication...");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const isUpdate = !!editingVoteId;

    try {
      await submitVote(pollId!, {
        participantName,
        participantEmail: participantEmail || "",
        selections,
      }, editingVoteId);
      setLastSubmissionWasUpdate(isUpdate);
      setSuccess(true);
      hasInitializedFormRef.current = false;
      hasInitializedWithVoteRef.current = false;
      setIsSubmitting(false);
    } catch (err: any) {
      console.error("Vote submission failed:", err);
      setError(err.message || "Failed to submit vote. Please try again.");
      setIsSubmitting(false);
    }
  };


  const handleVoteChange = (slotId: string, value: VoteValue) => {
    setSelections(prev => ({
      ...prev,
      [slotId]: value
    }));
  };

  const handleDeleteVote = async () => {
    if (!pollId || !user) return;
    
    if (!confirm("Are you sure you want to delete this response? This action cannot be undone.")) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (!editingVoteId) return;
      await deleteVote(pollId, editingVoteId);
      
      // Reset form
      hasInitializedFormRef.current = false;
      hasInitializedWithVoteRef.current = false;
      setIsSubmitting(false);
      // Success is implicit through real-time sync
    } catch (err: any) {
      console.error("Delete vote failed:", err);
      setError(err.message || "Failed to delete response. Please try again.");
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const token = searchParams.get("adminToken") || localStorage.getItem(`adminToken_${pollId}`);
    if (token && user && pollId) {
      ensureAdminGrant(pollId, token).then((valid: boolean) => {
        setIsTokenAdmin(valid);
      }).catch(err => {
        console.error("ensureAdminGrant failed:", err);
        setIsTokenAdmin(false);
      });
    } else {
      setIsTokenAdmin(false);
    }
  }, [user, pollId, searchParams]);

  const handleClaim = async () => {
    if (!pollId || isClaiming) return;
    const token = searchParams.get("adminToken") || localStorage.getItem(`adminToken_${pollId}`);
    if (!token) return;

    setIsClaiming(true);
    try {
      await claimPoll(pollId, token);
      // Re-render happens via subscription
    } catch (err) {
      console.error("Failed to claim poll:", err);
      alert("Failed to claim poll. Please try again.");
    } finally {
      setIsClaiming(false);
    }
  };




  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" data-testid="loader">
        <Loader2 className="w-10 h-10 text-brand-green animate-spin" />
        <p className="text-neutral-600 font-medium">Loading poll details...</p>
      </div>
    );
  }

  if (poll?.status === "FINALIZED") {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="bg-amber-50 rounded-3xl p-10 border border-amber-100">
          <CalendarIcon className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-800 mb-2">Poll Finalized</h2>
          <p className="text-neutral-600 mb-6">This poll has been finalized and is no longer accepting votes.</p>
          <a href={`/poll/${pollId}/results`} className="inline-block bg-brand-green text-white font-bold px-8 py-3 rounded-xl hover:bg-brand-green-dark transition-colors">
            View Final Results
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="bg-brand-green-light/50 rounded-3xl p-10 border border-brand-green-light shadow-xl shadow-brand-green/10">
          <div className="w-20 h-20 bg-brand-green rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-green/20">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-neutral-800 mb-3">
            {lastSubmissionWasUpdate ? "Vote Updated!" : "Vote Cast!"}
          </h2>
          <p className="text-neutral-600 mb-8 text-lg">
            {lastSubmissionWasUpdate 
              ? "Your availability has been updated successfully." 
              : "Your availability has been recorded successfully."}
          </p>
          <div className="flex flex-col gap-4">
            <Link 
              to={`/poll/${pollId}/results${searchParams.get("adminToken") ? `?adminToken=${searchParams.get("adminToken")}` : ""}`}
              data-testid="view-results-link"
              className="w-full bg-brand-green text-white font-bold py-4 rounded-2xl hover:bg-brand-green-dark transition-all shadow-lg shadow-brand-green/10 text-center"
            >
              View Group Availability
            </Link>
            <button 
              onClick={() => {
                setSuccess(false);
              }}
              className="text-neutral-600 font-semibold hover:text-neutral-700 transition-colors"
            >
              Back to poll
            </button>
          </div>
        </div>
        <p className="mt-8 text-neutral-600">Availability updated</p>
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-neutral-600 text-lg mb-6">{error || "Poll not found."}</p>
        <Link to="/" className="text-indigo-600 font-bold hover:underline">Return to Home</Link>
      </div>
    );
  }

  const sortedSlots = [...poll.timeSlots].sort((a, b) => {
    if (poll.schedulingMode === "EXACT") {
      return new Date((a as any).startTime).getTime() - new Date((b as any).startTime).getTime();
    } else {
      const dateA = (a as any).date;
      const dateB = (b as any).date;
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      
      const timeA = (a as any).time || "";
      const timeB = (b as any).time || "";
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      
      return ((a as any).label || "").localeCompare((b as any).label || "");
    }
  });

  const handleShare = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("adminToken");
    navigator.clipboard.writeText(url.toString());
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 3000);
  };


  const handleCopyLocation = () => {
    if (poll?.location) {
      navigator.clipboard.writeText(poll.location);
      setShowLocationCopied(true);
      setTimeout(() => setShowLocationCopied(false), 3000);
    }
  };


  const adminToken = searchParams.get("adminToken") || localStorage.getItem(`adminToken_${pollId}`);
  const isOwner = isTokenAdmin;





  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
      {/* Header Card - Inverted Design */}
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
                        const canExpand = poll.title.length > 80 || (poll.description && poll.description.length > 100);
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
                              {poll.title}
                            </h1>
                            {poll.description && (
                              <p className="text-base md:text-lg text-neutral-600 font-medium max-w-3xl leading-relaxed break-words whitespace-pre-wrap">
                                {poll.description}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                      
                      {(poll.title.length > 80 || (poll.description && poll.description.length > 100)) && (
                        <div className={`flex justify-center transition-all duration-500 ${
                          isDescriptionExpanded 
                            ? 'mt-8 relative z-20' 
                            : 'absolute bottom-2 left-0 w-full z-20'
                        }`}>
                          <button 
                            onClick={toggleExpando}
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
              {poll.location && (
                <ActionCard 
                  icon={<MapPin className="w-5 h-5" />}
                  label="Location"
                  value={poll.location}
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
                value={poll.organizerName || "Organizer"}
                theme="light"
                data-testid="poll-organizer"
              />

              {/* Results Button */}
              <Link 
                to={`/poll/${pollId}/results${searchParams.get("adminToken") ? `?adminToken=${searchParams.get("adminToken")}` : ""}`}
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

        {/* Admin Banners - Integrated into card but below gradient */}
        <div className="bg-neutral-50 border-t border-neutral-100">
          {isOwner && (
            <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-neutral-100 bg-red-50/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-red rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-red/20">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-bold text-brand-charcoal text-lg leading-tight">You are the Owner</h2>
                  <p className="text-neutral-600 text-sm mt-1">Manage or finalize your poll using this link.</p>
                </div>
              </div>
              <div className="w-full md:w-auto">
                {(() => {
                  const currentAdminUrl = `${window.location.origin}/poll/${pollId}${adminToken ? `?adminToken=${adminToken}` : ""}`;
                  return (
                    <div className="flex flex-row items-center gap-2 bg-white border border-neutral-200 p-2 rounded-2xl shadow-sm w-full md:min-w-[480px]">
                      <input 
                        aria-label="Administrative link for this poll"
                        readOnly
                        className="bg-transparent px-3 py-2 text-xs font-mono text-neutral-600 flex-1 min-w-0 focus:outline-none" 
                        value={currentAdminUrl} 
                      />
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(currentAdminUrl);
                            setShowAdminLinkCopied(true);
                            setTimeout(() => setShowAdminLinkCopied(false), 3000);
                          }}
                          className={`px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 flex-shrink-0 ${showAdminLinkCopied ? 'bg-white text-brand-red border border-brand-red shadow-lg shadow-brand-red/20' : 'bg-brand-red text-white hover:bg-brand-red-dark'}`}
                        >
                          {showAdminLinkCopied ? 'Copied!' : 'Copy'}
                        </button>
                        <Link
                          to={`/poll/${pollId}/edit${adminToken ? `?adminToken=${adminToken}` : ""}`}
                          className="bg-white text-brand-red border border-brand-red-light px-3 py-2 rounded-xl font-bold text-sm hover:bg-red-50 transition-all flex items-center gap-1.5 active:scale-95"
                        >
                          <Edit3 size={16} />
                          Edit
                        </Link>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {(() => {
            const isActuallyOrganizer = user && poll.organizerUid === user.uid;
            const isAlreadyManager = user && poll.managers?.includes(user.uid);
            if (user && !isActuallyOrganizer && !isAlreadyManager && isTokenAdmin) {
              return (
                <div data-testid="claim-banner" className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-green rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-green/20">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="font-bold text-brand-charcoal text-lg">Claim this Poll</h2>
                      <p className="text-neutral-600 text-sm">Add this poll to your personal dashboard.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleClaim}
                    disabled={isClaiming}
                    className="px-8 py-3 bg-brand-green text-white rounded-xl font-bold hover:bg-brand-green-dark transition-all shadow-md shadow-brand-green/10 disabled:opacity-50"
                  >
                    {isClaiming ? "Adding to Dashboard..." : "Add to My Dashboard"}
                  </button>
                </div>
              );
            }
            return null;
          })()}
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
                  {editingVoteId 
                    ? "Editing your previous response. You can update it or start fresh." 
                    : "Submitting a new response. You can also edit your existing ones below."}
                </p>
              </div>
            </div>
            <div className="flex flex-col xs:flex-row items-center gap-2 w-full sm:w-auto">
              {editingVoteId ? (
                <button
                  type="button"
                  onClick={() => initializeEmptyForm(poll!)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 whitespace-nowrap"
                >
                  <Plus size={16} />
                  Submit New Response
                </button>
              ) : (
                userVotes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => loadVoteIntoForm(userVotes[0])}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 whitespace-nowrap"
                  >
                    <Edit3 size={16} />
                    Edit Response
                  </button>
                )
              )}
            </div>
          </div>
          
          {userVotes.length > 1 && (
            <div className="mt-5 pt-5 border-t border-indigo-100">
              <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider mb-3">Switch between your responses:</p>
              <div className="flex flex-wrap gap-2">
                {userVotes.map((v) => (
                  <button
                    key={v.voteId}
                    type="button"
                    onClick={() => loadVoteIntoForm(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      editingVoteId === v.voteId 
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                        : "bg-white text-neutral-600 border border-neutral-200 hover:border-indigo-300"
                    }`}
                  >
                    {v.participantName || "Anonymous"} ({new Date(v.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-12">
        <section className="bg-white rounded-3xl p-4 sm:p-8 border border-neutral-100 shadow-xl shadow-indigo-100/20">
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

        <section className="bg-white rounded-3xl p-4 sm:p-8 border border-neutral-100 shadow-xl shadow-indigo-100/20">
          <h2 className="text-2xl font-bold text-neutral-800 mb-8 flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 text-sm">2</span>
            Basic Information
          </h2>
          <div className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="participantName" className="block text-sm font-bold text-neutral-700 uppercase tracking-wider ml-1">
                Your Name
              </label>
              <input
                id="participantName"
                type="text"
                data-testid="participant-name-input"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="participantEmail" className="block text-sm font-bold text-neutral-700 uppercase tracking-wider ml-1">
                Email Address (Optional)
              </label>
              <input
                id="participantEmail"
                type="email"
                data-testid="participant-email-input"
                value={participantEmail}
                onChange={(e) => setParticipantEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full"
              />
            </div>
          </div>
        </section>

        {error && (
          <div className="bg-red-50 border-2 border-red-100 text-red-600 px-6 py-4 rounded-2xl font-bold animate-shake">
            {error}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4">
          <button
            type="submit"
            data-testid="vote-submit-btn"
            disabled={!participantName.trim() || isSubmitting || isAuthLoading}
            className={`flex-1 disabled:bg-neutral-200 disabled:cursor-not-allowed group !py-6 !text-2xl font-black rounded-3xl transition-all flex items-center justify-center gap-4 ${
              editingVoteId 
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100" 
                : "bg-brand-green text-white hover:bg-brand-green-dark shadow-xl shadow-brand-green/20"
            }`}
          >
            {isSubmitting || isAuthLoading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <>
                {editingVoteId ? "Update Your Response" : "Submit Your Vote"}
                <ChevronRight className="w-7 h-7 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>

          {editingVoteId && !isSubmitting && (
            <button
              type="button"
              onClick={handleDeleteVote}
              className="px-8 py-6 text-red-600 font-bold hover:bg-red-50 rounded-3xl transition-all border-2 border-transparent hover:border-red-100"
            >
              Delete Response
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
