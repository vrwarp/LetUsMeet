import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, Share2, MapPin, User as UserIcon, Send, CheckCircle } from "lucide-react";
import { getPollApi, submitVoteApi } from "@/lib/pollApi";
import { useAuth } from "@/hooks/useAuth";
import type { Poll, VoteValue } from "../types/index";
import TimeSlotCard from "@/components/TimeSlotCard";

export default function VotePollPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const { user, loading: authLoading } = useAuth();
  
  const [poll, setPoll] = useState<Poll | null>(null);
  const [selections, setSelections] = useState<Record<string, VoteValue>>({});
  const [participantName, setParticipantName] = useState("");
  const [participantEmail, setParticipantEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pollId) {
      fetchPoll();
    }
  }, [pollId]);

  const fetchPoll = async () => {
    try {
      const result = await getPollApi({ pollId: pollId! });
      setPoll(result.data.poll);
      
      // Initialize selections to NO if not already set
      const initial: Record<string, VoteValue> = {};
      result.data.poll.timeSlots.forEach((s: any) => initial[s.id] = "NO");
      setSelections(initial);
      
      setIsLoading(false);
    } catch (err: any) {
      console.error("Failed to fetch poll", err);
      setError(err.message || "Could not load poll.");
      setIsLoading(false);
    }
  };

  const handleVoteChange = (slotId: string, value: VoteValue) => {
    setSelections(prev => ({ ...prev, [slotId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pollId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await submitVoteApi({
        pollId,
        participantName,
        participantEmail,
        selections,
      });
      setIsSuccess(true);
    } catch (err: any) {
      console.error("Submission failed", err);
      setError(err.message || "Failed to submit vote.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  if (!poll) {
    return <div className="text-center py-20 text-neutral-500">Poll not found.</div>;
  }

  if (isSuccess) {
    return (
      <div className="max-w-md mx-auto py-20 flex flex-col items-center text-center gap-6">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
          <CheckCircle size={40} />
        </div>
        <h2 className="text-3xl font-extrabold text-neutral-900">Vote Submitted!</h2>
        <p className="text-neutral-600">
          Thanks for participating, {participantName}. Your availability has been recorded.
        </p>
        <Link
          to={`/poll/${pollId}/results`}
          className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          View Live Results
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-8 border-b border-neutral-200">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-extrabold text-neutral-900 leading-tight">{poll.title}</h1>
          <div className="flex flex-wrap gap-4 text-neutral-500 font-medium">
            {poll.location && (
              <div className="flex items-center gap-1.5">
                <MapPin size={18} className="text-indigo-500" />
                {poll.location}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <UserIcon size={18} className="text-indigo-500" />
              Organizer Invites You
            </div>
          </div>
        </div>
        <button 
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert("Link copied!");
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-neutral-600 font-bold hover:bg-neutral-50 transition-all shadow-sm self-start md:self-auto"
        >
          <Share2 size={18} />
          Share Poll
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-12">
        <section>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-neutral-800">1. Mark your availability</h2>
            <p className="text-neutral-500 text-sm">Click each slot to cycle: Yes → If-need-be → No</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {poll.timeSlots.map((slot) => (
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

        <section className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-neutral-800">2. Finalize your response</h2>
            <p className="text-neutral-500 text-sm">Enter your name to complete the vote.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-neutral-700">Your Name</label>
              <input
                required
                type="text"
                placeholder="First and last name"
                className="px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-neutral-700">Email Address (Optional)</label>
              <input
                type="email"
                placeholder="To receive the final invite"
                className="px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={participantEmail}
                onChange={(e) => setParticipantEmail(e.target.value)}
              />
            </div>
          </div>

          {error && <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{error}</div>}

          <button
            type="submit"
            disabled={isSubmitting || !participantName}
            className="mt-8 w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
            Submit my vote
          </button>
        </section>
      </form>
    </div>
  );
}
