import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Loader2, Share2, MapPin, User as UserIcon, Send, CheckCircle, Calendar as CalendarIcon, ShieldCheck, Edit3 } from "lucide-react";
import { fetchPollAction, submitVoteAction } from "@/lib/pollApi";
import { useAuth } from "@/hooks/useAuth";
import type { Poll, VoteValue } from "../types/index";
import TimeSlotCard from "@/components/TimeSlotCard";

export default function VotePollPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const { user } = useAuth();
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

  const fetchPoll = async () => {
    try {
      const result = await fetchPollAction({ pollId: pollId! }) as any;
      const pollData = result.data.poll;
      setPoll(pollData);
      
      if (pollData) {
        const initial: Record<string, VoteValue> = {};
        pollData.timeSlots.forEach((slot: any) => {
          initial[slot.id] = "NO";
        });
        setSelections(initial);
      }
      setIsLoading(false);
    } catch (err: any) {
      console.error("Failed to fetch poll:", err);
      setError("Poll not found or error loading data.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (pollId) {
      fetchPoll();
    }
  }, [pollId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantName.trim()) {
      setError("Please enter your name.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    try {
      await submitVoteAction({
        pollId,
        participantName,
        participantEmail: participantEmail || "",
        selections,
      });
      setSuccess(true);
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



  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" data-testid="loader">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
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
          <a href={`/poll/${pollId}/results`} className="inline-block bg-indigo-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-indigo-700 transition-colors">
            View Final Results
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="bg-green-50 rounded-3xl p-10 border border-green-100 shadow-xl shadow-green-100/50">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-200">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-neutral-800 mb-3">Vote Cast!</h2>
          <p className="text-neutral-600 mb-8 text-lg">Your availability has been recorded successfully.</p>
          <div className="flex flex-col gap-4">
            <Link 
              to={`/poll/${pollId}/results`}
              data-testid="view-results-btn"
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-center"
            >
              See Consensus Results
            </Link>
            <button 
              onClick={() => setSuccess(false)}
              className="text-neutral-500 font-semibold hover:text-neutral-700 transition-colors"
            >
              Change my vote
            </button>
          </div>
        </div>
        <p className="mt-8 text-neutral-500">Consensus matrix updated</p>
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
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      <div className="mb-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 data-testid="poll-title" className="text-3xl md:text-5xl font-black text-neutral-800 tracking-tight leading-tight">
            {poll.title}
          </h1>
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
              <MapPin className="w-4 h-4 text-indigo-500" />
              <span>{poll.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2 bg-neutral-50 px-4 py-2 rounded-xl border border-neutral-100">
            <UserIcon className="w-4 h-4 text-indigo-500" />
            <span>{poll.organizerName || "Organizer"}</span>
          </div>
        </div>

        {isOwner && (
          <div className="mt-8 bg-indigo-50 border border-indigo-100 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold text-neutral-800 text-lg">You are the Owner</h2>
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
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 whitespace-nowrap"
              >
                Copy Link
              </button>
              <Link
                to={`/poll/${pollId}/edit${adminToken ? `?adminToken=${adminToken}` : ""}`}
                className="bg-white text-indigo-600 border border-indigo-200 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-all flex items-center gap-2 whitespace-nowrap shadow-sm"
              >
                <Edit3 size={18} />
                Edit Poll
              </Link>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-12">
        <section className="bg-white rounded-3xl p-8 border border-neutral-100 shadow-xl shadow-indigo-100/20">
          <h2 className="text-2xl font-bold text-neutral-800 mb-8 flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 text-sm">1</span>
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
                className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-2xl px-6 py-4 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-neutral-800 placeholder:text-neutral-300 font-medium"
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
                className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-2xl px-6 py-4 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-neutral-800 placeholder:text-neutral-300 font-medium"
              />
            </div>
          </div>
        </section>

        {error && (
          <div className="bg-red-50 border-2 border-red-100 text-red-600 px-6 py-4 rounded-2xl font-bold animate-shake">
            {error}
          </div>
        )}

        <button
          type="submit"
          data-testid="vote-submit-btn"
          disabled={!participantName.trim() || isSubmitting}
          className="w-full bg-indigo-600 text-white font-black py-6 rounded-3xl hover:bg-indigo-700 disabled:bg-neutral-200 disabled:cursor-not-allowed transition-all shadow-xl shadow-indigo-200 text-xl flex items-center justify-center gap-3 group"
        >
          {isSubmitting ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              Submit Your Vote
              <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
