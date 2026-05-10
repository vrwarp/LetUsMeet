import { useEffect, useState, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Loader2, Share2, MapPin, User as UserIcon, CheckCircle, Calendar as CalendarIcon, ShieldCheck, Edit3, Plus, History, ChevronRight } from "lucide-react";
import { subscribeToPoll, submitVote, deleteVote, claimPoll } from "@/lib/pollService";
import { useAuth } from "@/hooks/useAuth";
import type { Poll, Vote, VoteValue } from "../types/index";
import TimeSlotCard from "@/components/TimeSlotCard";

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
  const [editingVoteId, setEditingVoteId] = useState<string | null>(null);
  const [lastSubmissionWasUpdate, setLastSubmissionWasUpdate] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const hasInitializedFormRef = useRef(false);
  const hasInitializedWithVoteRef = useRef(false);

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

  useEffect(() => {
    if (!pollId) return;
    
    setIsLoading(true);
    const unsubscribe = subscribeToPoll(pollId, (data) => {
      setPoll(data.poll as any);
      
      if (data.poll && user) {
        const myVotes = (data.votes as any).filter((v: Vote) => v.participantUid === user.uid);
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
          initializeEmptyForm(data.poll as any);
          hasInitializedFormRef.current = true;
        }
      } else if (data.poll && !user && !hasInitializedFormRef.current) {
        initializeEmptyForm(data.poll as any);
        hasInitializedFormRef.current = true;
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [pollId, user?.uid]);
 // Removed hasInitializedForm to avoid re-subscribing on form init

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

  const handleClaim = async () => {
    if (!pollId || isClaiming) return;
    const token = searchParams.get("adminToken") || localStorage.getItem(`adminToken_${pollId}`);
    if (!token) return;

    setIsClaiming(true);
    try {
      await claimPoll(pollId, token, user?.uid);
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
        <p className="text-neutral-500 font-medium">Loading poll details...</p>
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
              to={`/poll/${pollId}/results`}
              data-testid="view-results-btn"
              className="w-full bg-brand-green text-white font-bold py-4 rounded-2xl hover:bg-brand-green-dark transition-all shadow-lg shadow-brand-green/10 text-center"
            >
              View Group Availability
            </Link>
            <button 
              onClick={() => {
                setSuccess(false);
              }}
              className="text-neutral-500 font-semibold hover:text-neutral-700 transition-colors"
            >
              Back to poll
            </button>
          </div>
        </div>
        <p className="mt-8 text-neutral-500">Availability updated</p>
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-neutral-500 text-lg mb-6">{error || "Poll not found."}</p>
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
    navigator.clipboard.writeText(window.location.href);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 3000);
  };

  const adminToken = searchParams.get("adminToken") || localStorage.getItem(`adminToken_${pollId}`);
  const isOwner = adminToken === poll.adminToken;
  const adminUrl = `${window.location.origin}/poll/${pollId}?adminToken=${poll.adminToken}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8 md:py-12">
      <div className="mb-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 data-testid="poll-title" className="text-3xl md:text-5xl font-black text-neutral-800 tracking-tight leading-tight">
            {poll.title}
          </h1>
          <div className="flex items-center gap-2">
            <Link 
              to={`/poll/${pollId}/results`}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-neutral-600 font-bold text-sm hover:bg-neutral-50 transition-colors shadow-sm"
            >
              <History className="w-4 h-4 text-brand-green" />
              <span className="hidden sm:inline">View Results</span>
              <span className="sm:hidden">Results</span>
            </Link>
            <div className="relative">
              <button 
                onClick={handleShare}
                aria-label="Share poll" 
                className="p-3 bg-neutral-100 rounded-2xl hover:bg-neutral-200 transition-colors text-neutral-600"
              >
                <Share2 className="w-5 h-5" />
              </button>
              {showCopied && (
                <div className="absolute top-full mt-2 right-0 bg-neutral-800 text-white text-xs py-2 px-3 rounded-xl shadow-xl z-20 animate-in fade-in slide-in-from-top-1">
                  Copied!
                </div>
              )}
            </div>
          </div>
        </div>

        {poll.description && (
          <div className="mb-8 p-6 bg-white rounded-2xl border border-neutral-100 shadow-sm">
            <p className="text-neutral-600 whitespace-pre-wrap leading-relaxed">
              {poll.description}
            </p>
          </div>
        )}
        
        <div className="flex flex-wrap items-center gap-4 text-neutral-500 font-medium">
          {poll.location && (
            <div className="flex items-center gap-2 bg-neutral-50 px-4 py-2 rounded-xl border border-neutral-100">
              <MapPin className="w-4 h-4 text-brand-green" />
              <span>{poll.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2 bg-neutral-50 px-4 py-2 rounded-xl border border-neutral-100">
            <UserIcon className="w-4 h-4 text-brand-green" />
            <span>{poll.organizerName || "Organizer"}</span>
          </div>
        </div>

        {isOwner && (
          <div className="mt-8 bg-brand-green-light/20 border border-brand-green-light rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brand-green rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-green/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold text-brand-charcoal text-lg">You are the Owner</h2>
                <p className="text-neutral-600 text-sm">Save this link to manage or finalize your poll later.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <input 
                readOnly 
                value={adminUrl} 
                aria-label="Management link"
                className="bg-white border border-neutral-200 px-4 py-3 rounded-xl text-xs font-mono text-neutral-600 flex-1 md:w-64" 
              />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(adminUrl);
                  setShowCopied(true);
                  setTimeout(() => setShowCopied(false), 3000);
                }}
                className="bg-brand-green text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-green-dark transition-all shadow-md shadow-brand-green/10 whitespace-nowrap"
              >
                Copy Link
              </button>
              <Link
                to={`/poll/${pollId}/edit${adminToken ? `?adminToken=${adminToken}` : ""}`}
                className="bg-white text-brand-green border border-brand-green-light px-6 py-3 rounded-xl font-bold hover:bg-neutral-50 transition-all flex items-center gap-2 whitespace-nowrap shadow-sm"
              >
                <Edit3 size={18} />
                Edit Poll
              </Link>
            </div>
          </div>
        )}

        {(() => {
          const isActuallyOrganizer = user && !user.isAnonymous && poll.organizerUid === user.uid;
          if (user && !user.isAnonymous && !isActuallyOrganizer && adminToken && adminToken === poll.adminToken) {
            return (
              <div className="mt-8 bg-brand-green-light/30 border border-brand-green-light rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-green rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-green/20">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="font-bold text-brand-charcoal text-lg">Claim this Poll</h2>
                    <p className="text-neutral-600 text-sm">You have administrative access. Would you like to add this poll to your dashboard?</p>
                  </div>
                </div>
                <button
                  onClick={handleClaim}
                  disabled={isClaiming}
                  className="px-8 py-3 bg-brand-green text-white rounded-xl font-bold hover:bg-brand-green-dark transition-all shadow-md shadow-brand-green/10 whitespace-nowrap disabled:opacity-50"
                >
                  {isClaiming ? "Adding to Dashboard..." : "Add to My Dashboard"}
                </button>
              </div>
            );
          }
          return null;
        })()}
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
                <p className="text-neutral-500 text-xs mt-1 font-medium">
                  {editingVoteId 
                    ? "Editing your response. You can update it or start fresh." 
                    : "You can edit your previous response or submit a new one."}
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
                  Submit New
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
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-3">Switch between your responses:</p>
              <div className="flex flex-wrap gap-2">
                {userVotes.map((v) => (
                  <button
                    key={v.voteId}
                    type="button"
                    onClick={() => loadVoteIntoForm(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      editingVoteId === v.voteId 
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                        : "bg-white text-neutral-500 border border-neutral-200 hover:border-indigo-300"
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
            disabled={!participantName.trim() || isSubmitting}
            className={`flex-1 disabled:bg-neutral-200 disabled:cursor-not-allowed group !py-6 !text-2xl font-black rounded-3xl transition-all flex items-center justify-center gap-4 ${
              editingVoteId 
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100" 
                : "bg-brand-green text-white hover:bg-brand-green-dark shadow-xl shadow-brand-green/20"
            }`}
          >
            {isSubmitting ? (
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
