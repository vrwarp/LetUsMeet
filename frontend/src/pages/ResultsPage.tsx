import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ArrowLeft, Trophy, Users, Info } from "lucide-react";
import { getPollApi } from "@/lib/pollApi";
import type { Poll, VoteValue } from "../types/index";

interface VoteResult {
  participantName: string;
  selections: Record<string, VoteValue>;
}

export default function ResultsPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [votes, setVotes] = useState<VoteResult[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, { YES: number, IF_NEED_BE: number, NO: number }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pollId) {
      fetchResults();
    }
  }, [pollId]);

  const fetchResults = async () => {
    try {
      const result = await getPollApi({ pollId: pollId! });
      setPoll(result.data.poll);
      setVotes(result.data.votes);
      setVoteCounts(result.data.voteCounts);
      setIsLoading(false);
    } catch (err: any) {
      console.error("Failed to fetch results", err);
      setError(err.message || "Could not load results.");
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  if (!poll) return <div className="text-center py-20">Poll not found.</div>;

  // Find the winner(s)
  const sortedSlotIds = [...poll.timeSlots].sort((a, b) => {
    const aCount = (voteCounts[a.id]?.YES || 0) * 2 + (voteCounts[a.id]?.IF_NEED_BE || 0);
    const bCount = (voteCounts[b.id]?.YES || 0) * 2 + (voteCounts[b.id]?.IF_NEED_BE || 0);
    return bCount - aCount;
  }).map(s => s.id);

  const winnerId = sortedSlotIds[0];

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <Link to={`/poll/${pollId}`} className="text-sm font-bold text-indigo-600 flex items-center gap-1 hover:underline">
          <ArrowLeft size={16} />
          Back to Voting
        </Link>
        <div className="flex items-center gap-2 text-neutral-500 text-sm bg-neutral-100 px-3 py-1 rounded-full">
          <Users size={14} />
          <span>{votes.length} Participants</span>
        </div>
      </div>

      <div className="mb-12">
        <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">Live Consensus</h1>
        <p className="text-neutral-500">Real-time view of everyone's availability.</p>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-neutral-50/50">
              <th className="p-6 text-left border-b border-neutral-200 min-w-[200px] sticky left-0 bg-neutral-50 z-10 shadow-[2px_0_10px_-4px_rgba(0,0,0,0.1)]">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Participant</span>
              </th>
              {poll.timeSlots.map((slot) => {
                const start = new Date(slot.startTime);
                return (
                  <th key={slot.id} className={`p-6 border-b border-neutral-200 min-w-[160px] ${slot.id === winnerId ? 'bg-indigo-50/30' : ''}`}>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-bold text-neutral-400 uppercase">{start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <span className="text-sm font-extrabold">{start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                      {slot.id === winnerId && votes.length > 0 && (
                        <div className="mt-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold flex items-center gap-1 uppercase tracking-tighter">
                          <Trophy size={10} fill="currentColor" />
                          Leading
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Aggregate Counts Row */}
            <tr className="bg-neutral-50/30 font-medium">
              <td className="p-6 border-b border-neutral-200 sticky left-0 bg-neutral-50 z-10 shadow-[2px_0_10px_-4px_rgba(0,0,0,0.1)]">
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-indigo-400" />
                  <span className="text-sm font-bold">Total Votes</span>
                </div>
              </td>
              {poll.timeSlots.map((slot) => {
                const counts = voteCounts[slot.id] || { YES: 0, IF_NEED_BE: 0, NO: 0 };
                return (
                  <td key={slot.id} className={`p-6 border-b border-neutral-200 text-center ${slot.id === winnerId ? 'bg-indigo-50/30' : ''}`}>
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-center gap-2">
                        <span className="text-emerald-600 font-bold">{counts.YES}</span>
                        <span className="text-amber-500 font-bold">{counts.IF_NEED_BE}</span>
                        <span className="text-neutral-400 font-bold">{counts.NO}</span>
                      </div>
                      <div className="h-1.5 w-full max-w-[80px] mx-auto bg-neutral-200 rounded-full overflow-hidden flex">
                        <div className="bg-emerald-500 h-full" style={{ width: `${(counts.YES / (votes.length || 1)) * 100}%` }} />
                        <div className="bg-amber-400 h-full" style={{ width: `${(counts.IF_NEED_BE / (votes.length || 1)) * 100}%` }} />
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Individual Votes */}
            {votes.map((vote, idx) => (
              <tr key={idx}>
                <td className="p-6 border-b border-neutral-100 sticky left-0 bg-white z-10 shadow-[2px_0_10px_-4px_rgba(0,0,0,0.1)]">
                  <span className="font-bold text-neutral-800">{vote.participantName}</span>
                </td>
                {poll.timeSlots.map((slot) => {
                  const val = vote.selections[slot.id] || "NO";
                  return (
                    <td key={slot.id} className={`p-6 border-b border-neutral-100 text-center ${slot.id === winnerId ? 'bg-indigo-50/10' : ''}`}>
                      <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center ${
                        val === "YES" ? "bg-emerald-500 text-white" : 
                        val === "IF_NEED_BE" ? "bg-amber-400 text-white" : 
                        "bg-neutral-100 text-neutral-300"
                      }`}>
                        {val === "YES" ? "✓" : val === "IF_NEED_BE" ? "~" : "×"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {votes.length === 0 && (
              <tr>
                <td colSpan={poll.timeSlots.length + 1} className="p-12 text-center text-neutral-400 font-medium italic">
                  No votes submitted yet. Share the link to gather responses!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
