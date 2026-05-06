import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ArrowLeft, Trophy, Users, Info } from "lucide-react";
import { fetchPollAction } from "@/lib/pollApi";
import type { Poll, VoteValue } from "../types/index";

interface VoteResult {
  participantName: string;
  selections: Record<string, VoteValue>;
}

export default function ResultsPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [votes, setVotes] = useState<VoteResult[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, Record<VoteValue, number>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResults() {
      if (!pollId) return;
      try {
        const result = await fetchPollAction({ pollId });
        setPoll(result.data.poll);
        setVotes(result.data.votes);
        setVoteCounts(result.data.voteCounts);
        setIsLoading(false);
      } catch (err: any) {
        console.error("Failed to fetch results:", err);
        setPollError(err?.message || err?.toString() || "Could not load results.");
        setIsLoading(false);
      }
    }

    fetchResults();
  }, [pollId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" data-testid="loader">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-neutral-500 font-medium">Calculating consensus...</p>
      </div>
    );
  }

  if (pollError || !poll) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        <div className="text-center py-20 bg-red-50 rounded-3xl border border-red-100">
          <p className="text-red-800 font-bold text-xl mb-2">Something went wrong</p>
          <p className="text-red-600">{pollError || "Poll not found."}</p>
        </div>
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

  const bestSlotId = Object.entries(voteCounts).reduce((best, [id, counts]) => {
    const currentScore = (counts.YES || 0) * 2 + (counts.IF_NEED_BE || 0);
    const bestScore = best ? (voteCounts[best].YES || 0) * 2 + (voteCounts[best].IF_NEED_BE || 0) : -1;
    return currentScore > bestScore ? id : best;
  }, null as string | null);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
      <Link 
        to={`/poll/${pollId}`}
        className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Poll
      </Link>

      <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/50 border border-indigo-50 overflow-hidden mb-12">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-10 text-white">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-3">{poll.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-indigo-100">
                {poll.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    <span>{poll.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>{votes.length} participants</span>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-400 rounded-xl text-indigo-900">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider font-semibold text-indigo-100">Current Consensus</p>
                  <p className="text-lg font-bold">
                    {bestSlotId ? (() => {
                      const slot = poll.timeSlots.find(s => s.id === bestSlotId)!;
                      if ("startTime" in slot) {
                        return new Date(slot.startTime).toLocaleDateString(undefined, {
                          weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        });
                      } else {
                        const dateStr = new Date(slot.date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                        const timeStr = (slot as any).time ? ` @ ${(slot as any).time}` : "";
                        return `${dateStr} - ${(slot as any).label}${timeStr}`;
                      }
                    })() : 'None yet'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="flex items-center gap-2 mb-6">
            <Info className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-neutral-800">Participation Matrix</h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-neutral-100">
            <table data-testid="results-matrix" className="w-full border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-100">
                  <th className="p-4 text-left font-semibold text-neutral-600 sticky left-0 bg-neutral-50 z-10">Participants</th>
                  {sortedSlots.map(slot => (
                    <th key={slot.id} className="p-4 text-center min-w-[120px]">
                      {poll.schedulingMode === "EXACT" ? (
                        <>
                          <div className="text-sm font-bold text-neutral-800">
                            {new Date((slot as any).startTime).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-xs text-neutral-500 font-medium">
                            {new Date((slot as any).startTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-bold text-neutral-800">
                            {new Date((slot as any).date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-xs text-neutral-500 font-medium">
                            {(slot as any).label}
                            {(slot as any).time && <span className="block text-[10px] opacity-70">@ {(slot as any).time}</span>}
                          </div>
                        </>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {votes.map((vote, idx) => (
                  <tr key={idx} data-testid={`participant-row-${idx}`} className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                    <td data-testid="participant-name" className="p-4 font-medium text-neutral-700 sticky left-0 bg-white z-10 border-r border-neutral-50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">
                      {vote.participantName}
                    </td>
                    {sortedSlots.map(slot => (
                      <td key={slot.id} className="p-4 text-center">
                        <div data-testid={`vote-cell-${idx}-${slot.id}`} className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${
                          vote.selections[slot.id] === "YES" ? "bg-green-100 text-green-700" :
                          vote.selections[slot.id] === "IF_NEED_BE" ? "bg-amber-100 text-amber-700" :
                          "bg-red-50 text-red-400"
                        }`}>
                          {vote.selections[slot.id] === "YES" ? "✓" : vote.selections[slot.id] === "IF_NEED_BE" ? "?" : "×"}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
                {votes.length === 0 && (
                  <tr>
                    <td colSpan={sortedSlots.length + 1} className="p-12 text-center text-neutral-500 italic">
                      No votes have been cast yet.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-neutral-50/50 border-t-2 border-neutral-100 font-bold">
                <tr>
                  <td className="p-4 text-neutral-600 sticky left-0 bg-neutral-50/50 z-10 border-r border-neutral-50">Total Yes</td>
                  {sortedSlots.map(slot => (
                    <td key={slot.id} data-testid={`total-yes-${slot.id}`} className="p-4 text-center text-green-600">
                      {voteCounts[slot.id]?.YES || 0}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const MapPin = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
);
