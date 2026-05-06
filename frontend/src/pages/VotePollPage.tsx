import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Loader2, Share2, MapPin, User as UserIcon, Send, CheckCircle } from "lucide-react";
import { fetchPollAction, submitVoteAction } from "@/lib/pollApi";
import { useAuth } from "@/hooks/useAuth";
import type { Poll, VoteValue } from "../types/index";
import TimeSlotCard from "@/components/TimeSlotCard";

export default function VotePollPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [poll, setPoll] = useState<Poll | null>(null);
  const [selections, setSelections] = useState<Record<string, VoteValue>>({});
  const [participantName, setParticipantName] = useState("");
  const [participantEmail, setParticipantEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

  const fetchPoll = async () => {
    try {
      const result = await fetchPollAction({ pollId: pollId! });
      setPoll(result.data.poll);
      
      const initial: Record<string, VoteValue> = {};
      result.data.poll.timeSlots.forEach((slot: any) => {
        initial[slot.id] = "NO";
      });
      setSelections(initial);
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

  if (authLoading && !isTest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-neutral-500 font-medium">Authenticating...</p>
      </div>
    );
  }

  if (!user && !isTest) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="bg-amber-50 rounded-3xl p-8 border border-amber-100">
          <UserIcon className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-800 mb-2">Sign in Required</h2>
          <p className="text-neutral-600 mb-6">Please sign in to vote on this poll.</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            Retry Authentication
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-neutral-500 font-medium">Loading poll details...</p>
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

  const sortedSlots = [...poll.timeSlots].sort((a, b) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      <div className="mb-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 data-testid="poll-title" className="text-3xl md:text-5xl font-black text-neutral-800 tracking-tight leading-tight">
            {poll.title}
          </h1>
          <button aria-label="Share poll" className="p-3 bg-neutral-100 rounded-2xl hover:bg-neutral-200 transition-colors text-neutral-600">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 text-neutral-500 font-medium">
          {poll.location && (
            <div className="flex items-center gap-2 bg-neutral-50 px-4 py-2 rounded-xl border border-neutral-100">
              <MapPin className="w-4 h-4 text-indigo-500" />
              <span>{poll.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2 bg-neutral-50 px-4 py-2 rounded-xl border border-neutral-100">
            <UserIcon className="w-4 h-4 text-indigo-500" />
            <span>Organizer</span>
          </div>
        </div>
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
                startTime={slot.startTime}
                endTime={slot.endTime}
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
          disabled={isSubmitting}
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
