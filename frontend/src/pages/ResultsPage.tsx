import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ArrowLeft, Trophy, Users, Info, CalendarCheck, Edit3, Maximize2, X, RotateCcw, CheckCircle2, Copy, Send } from "lucide-react";
import { subscribeToPoll, finalizePoll, claimPoll, unfinalizePoll, getPrivateVoteData } from "@/lib/pollService";
import { useAuth } from "@/hooks/useAuth";
import type { Poll, VoteValue } from "../types/index";

interface VoteResult {
  voteId: string;
  participantName: string;
  selections: Record<string, VoteValue>;
}

export default function ResultsPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const [poll, setPoll] = useState<Poll | null>(null);
  const { user } = useAuth();
  const [finalizing, setFinalizing] = useState<string | null>(null);
  const [unfinalizing, setUnfinalizing] = useState(false);
  const [votes, setVotes] = useState<VoteResult[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, Record<VoteValue, number>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [pollError, setPollError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showAddressCopied, setShowAddressCopied] = useState(false);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [isFetchingEmails, setIsFetchingEmails] = useState(false);

  const isOrganizer = user && !user.isAnonymous && poll?.organizerUid === user.uid;

  useEffect(() => {
    if (!pollId) return;
    
    setIsLoading(true);
    const unsubscribe = subscribeToPoll(pollId, (data) => {
      setPoll(data.poll as any);
      setVotes(data.votes as any);
      setVoteCounts(data.voteCounts);
      setIsLoading(false);
      setPollError(null);
    });

    return () => unsubscribe();
  }, [pollId]);

  useEffect(() => {
    if (isOrganizer && votes.length > 0 && Object.keys(emails).length === 0 && !isFetchingEmails) {
      handleRevealEmails();
    }
  }, [isOrganizer, votes, emails, isFetchingEmails]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" data-testid="loader">
        <Loader2 className="w-10 h-10 text-brand-green animate-spin" />
        <p className="text-neutral-500 font-medium">Tallying the results...</p>
      </div>
    );
  }

  if (pollError || !poll) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-brand-green-dark hover:text-brand-green font-bold mb-8 transition-colors"
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

  let sortedSlots = [...poll.timeSlots].sort((a, b) => {
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

  if (poll.status === "FINALIZED" && poll.finalizedSlotId) {
    const finalizedIdx = sortedSlots.findIndex(s => s.id === poll.finalizedSlotId);
    if (finalizedIdx > -1) {
      const [finalizedSlot] = sortedSlots.splice(finalizedIdx, 1);
      sortedSlots = [finalizedSlot, ...sortedSlots];
    }
  }

  const bestSlotId = Object.entries(voteCounts).reduce((best, [id, counts]) => {
    const currentScore = (counts.YES || 0) * 2 + (counts.IF_NEED_BE || 0);
    const bestScore = best ? (voteCounts[best].YES || 0) * 2 + (voteCounts[best].IF_NEED_BE || 0) : -1;
    return currentScore > bestScore ? id : best;
  }, null as string | null);

  const handleFinalize = async (slotId: string) => {
    if (!pollId || finalizing) return;
    setFinalizing(slotId);
    try {
      const token = localStorage.getItem("adminToken_" + pollId) || undefined;
      await finalizePoll(pollId, slotId, token);
    } catch (err) {
      console.error("Failed to finalize poll:", err);
      alert("Failed to finalize poll.");
    } finally {
      setFinalizing(null);
    }
  };

  const handleUnfinalize = async () => {
    if (!pollId || unfinalizing) return;
    if (!confirm("Are you sure you want to unselect this date? This will reopen the poll for voting.")) return;
    
    setUnfinalizing(true);
    try {
      const token = localStorage.getItem("adminToken_" + pollId) || undefined;
      await unfinalizePoll(pollId, token);
    } catch (err) {
      console.error("Failed to unfinalize poll:", err);
      alert("Failed to unselect date.");
    } finally {
      setUnfinalizing(false);
    }
  };

  const handleClaim = async () => {
    if (!pollId || isClaiming) return;
    const token = localStorage.getItem("adminToken_" + pollId) || new URLSearchParams(window.location.search).get("adminToken");
    if (!token) return;

    setIsClaiming(true);
    try {
      await claimPoll(pollId, token, user?.uid);
      // No need to alert, the poll organizerUid change will trigger a re-render via subscription
    } catch (err) {
      console.error("Failed to claim poll:", err);
      alert("Failed to claim poll. Please try again.");
    } finally {
      setIsClaiming(false);
    }
  };

  const handleCopyAddress = () => {
    if (!poll?.location) return;
    navigator.clipboard.writeText(poll.location);
    setShowAddressCopied(true);
    setTimeout(() => setShowAddressCopied(false), 2000);
  };

  const handleRevealEmails = async () => {
    if (!pollId || isFetchingEmails) return;
    setIsFetchingEmails(true);
    try {
      const results = await Promise.all(
        votes.map(async (vote) => {
          const data = await getPrivateVoteData(pollId, vote.voteId);
          return { voteId: vote.voteId, email: data?.email };
        })
      );
      
      const emailMap: Record<string, string> = {};
      results.forEach(r => {
        if (r.email) emailMap[r.voteId] = r.email;
      });
      setEmails(emailMap);
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    } finally {
      setIsFetchingEmails(false);
    }
  };

  const handleComposeEmail = () => {
    if (!poll) return;

    const participantsWithEmail = votes
      .map(v => ({ name: v.participantName, email: emails[v.voteId] }))
      .filter(v => !!v.email);

    const participantsWithoutEmail = votes
      .filter(v => !emails[v.voteId])
      .map(v => v.participantName);

    const toString = participantsWithEmail
      .map(p => `"${p.name}" <${p.email}>`)
      .join(", ");

    const subject = `Meeting Update: ${poll.title}`;
    
    let bodyText = `Hi everyone,\n\n`;
    
    if (participantsWithoutEmail.length > 0) {
      bodyText += `[Note: The following participants' emails were unavailable and not included in this thread: ${participantsWithoutEmail.join(", ")}]\n\n`;
    }

    bodyText += `I'm writing to share an update regarding our meeting "${poll.title}".\n\n`;
    
    if (poll.status === "FINALIZED" && poll.finalizedSlotId) {
      const slot = poll.timeSlots.find(s => s.id === poll.finalizedSlotId);
      if (slot) {
        const dateStr = poll.schedulingMode === "EXACT" 
          ? new Date((slot as any).startTime).toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
          : `${new Date((slot as any).date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} (${(slot as any).label})`;
        
        bodyText += `CONFIRMED DATE:\n${dateStr}\n\n`;
      }
    }

    if (poll.location) {
      bodyText += `LOCATION:\n${poll.location}\n\n`;
    }

    bodyText += `You can view the full results and the availability grid here: ${window.location.href}\n\nBest regards,\n${user?.displayName || 'The Organizer'}`;

    const mailtoUrl = `mailto:${toString}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    window.location.href = mailtoUrl;
  };


  const renderMatrixTable = () => (
    <div className="overflow-x-auto rounded-2xl border border-neutral-100 bg-white">
      <table data-testid="results-matrix" className="w-full border-collapse min-w-[600px]">
        <thead>
          <tr className="bg-neutral-50 border-b border-neutral-100">
            <th className="p-4 text-left font-semibold text-neutral-700 sticky left-0 bg-neutral-50 z-10 border-r border-neutral-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between gap-2">
                <span>Participants</span>
                {isOrganizer && (
                  <button 
                    onClick={handleComposeEmail}
                    disabled={isFetchingEmails}
                    className="p-1.5 hover:bg-neutral-200 rounded-lg transition-colors text-brand-green-dark hover:text-brand-green-darker group relative"
                    title="Email all participants"
                  >
                    {isFetchingEmails ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl z-50">
                      Email Participants
                    </span>
                  </button>
                )}
              </div>
            </th>
            {sortedSlots.map(slot => (
              <th key={slot.id} className={`p-4 text-center min-w-[140px] transition-colors duration-500 ${poll.finalizedSlotId === slot.id ? 'bg-brand-green-light/50 border-x-2 border-brand-green/20' : ''}`}>
                {poll.schedulingMode === "EXACT" ? (
                  <>
                    <div className="text-sm font-bold text-neutral-800">
                      {new Date((slot as any).startTime).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-xs text-neutral-700 font-bold">
                      {new Date((slot as any).startTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-bold text-neutral-800">
                      {new Date((slot as any).date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-xs text-neutral-700 font-bold">
                      {(slot as any).label}
                      {(slot as any).time && <span className="block text-[10px] opacity-70">@ {(slot as any).time}</span>}
                    </div>
                  </>
                )}

                {isOrganizer && poll.status === "OPEN" && (
                  <button
                    onClick={() => handleFinalize(slot.id)}
                    disabled={!!finalizing}
                    className="mt-2 text-xs font-bold bg-brand-green-light/50 text-brand-green-dark hover:bg-brand-green-light px-3 py-1.5 rounded-full transition-colors w-full shadow-sm hover:shadow active:scale-95 border border-brand-green/10"
                  >
                    {finalizing === slot.id ? "..." : "Finalize"}
                  </button>
                )}
                {poll.status === "FINALIZED" && poll.finalizedSlotId === slot.id && (
                  <div className="mt-2 text-xs font-bold bg-brand-green-light text-brand-green-dark px-3 py-1 rounded-full flex items-center justify-center gap-1 shadow-sm border border-brand-green/20">
                    <CalendarCheck className="w-3 h-3" /> Selected
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {votes.map((vote, idx) => (
            <tr key={idx} data-testid={`participant-row-${idx}`} className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors">
              <td data-testid="participant-name" className="p-4 sticky left-0 bg-white z-10 border-r border-neutral-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                <div className="flex flex-col">
                  <span className="font-bold text-neutral-800">{vote.participantName}</span>
                  {emails[vote.voteId] && (
                    <span className="text-[10px] text-neutral-700 font-bold truncate max-w-[120px]">{emails[vote.voteId]}</span>
                  )}
                </div>
              </td>
              {sortedSlots.map(slot => (
                <td key={slot.id} className={`p-4 text-center transition-colors duration-500 ${poll.finalizedSlotId === slot.id ? 'bg-brand-green-light/20 border-x-2 border-brand-green/10' : ''}`}>
                  <div data-testid={`vote-cell-${idx}-${slot.id}`} className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-lg font-bold shadow-sm ${
                    vote.selections[slot.id] === "YES" ? "bg-brand-green-light text-brand-green-dark border border-brand-green/10" :
                    vote.selections[slot.id] === "IF_NEED_BE" ? "bg-amber-50 text-amber-800 border border-amber-200" :
                    "bg-red-50 text-red-600 border border-red-100"
                  }`}>
                    {vote.selections[slot.id] === "YES" ? "✓" : vote.selections[slot.id] === "IF_NEED_BE" ? "?" : "×"}
                  </div>
                </td>
              ))}
            </tr>
          ))}
          {votes.length === 0 && (
            <tr>
              <td colSpan={sortedSlots.length + 1} className="p-12 text-center text-neutral-600 font-medium italic">
                No votes have been cast yet.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot className="bg-neutral-50/80 border-t-2 border-neutral-100 font-black">
          <tr>
            <td className="p-5 text-neutral-700 sticky left-0 bg-neutral-50/80 z-10 border-r border-neutral-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] uppercase tracking-wider text-xs font-black">Total Yes</td>
            {sortedSlots.map(slot => (
              <td key={slot.id} data-testid={`total-yes-${slot.id}`} className={`p-5 text-center text-xl text-brand-green-dark transition-colors duration-500 ${poll.finalizedSlotId === slot.id ? 'bg-brand-green-light/50 border-x-2 border-brand-green/20' : ''}`}>
                {voteCounts[slot.id]?.YES || 0}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
      {(() => {
        const token = new URLSearchParams(window.location.search).get("adminToken");
        return (
          <Link 
            to={`/poll/${pollId}${token ? `?adminToken=${token}` : ""}`}
            className="inline-flex items-center gap-2 text-brand-green-dark hover:text-brand-green font-bold mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Poll
          </Link>
        );
      })()}

      {(() => {
        const token = localStorage.getItem("adminToken_" + pollId) || new URLSearchParams(window.location.search).get("adminToken");
        const isActuallyOrganizer = user && !user.isAnonymous && poll.organizerUid === user.uid;
        
        if (user && !user.isAnonymous && !isActuallyOrganizer && token && token === poll.adminToken) {
          return (
            <div className="mb-8 p-6 bg-brand-green-light/30 border border-brand-green-light rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-green rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-green/20">
                  <CalendarCheck className="w-6 h-6" />
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

      <div className={`bg-white rounded-3xl shadow-xl shadow-brand-green/10 border border-brand-green-light/20 overflow-hidden mb-12 transition-all duration-500 ${poll.status === "FINALIZED" ? "ring-4 ring-brand-green/20" : ""}`}>
        <div className={`px-8 py-10 text-white transition-all duration-700 ${
          poll.status === "FINALIZED" 
            ? "bg-gradient-to-br from-brand-green-dark via-brand-green to-brand-green-dark" 
            : "bg-brand-gradient"
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex-1 min-w-[300px]">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">{poll.title}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-white font-medium">
                {poll.location && (
                  <button 
                    onClick={handleCopyAddress}
                    className={`relative flex items-start gap-3 transition-all max-w-md group active:scale-[0.98] text-left px-4 py-3 rounded-2xl border overflow-hidden min-h-[72px] ${
                      showAddressCopied 
                        ? 'bg-brand-green border-brand-green shadow-lg shadow-brand-green/20' 
                        : 'bg-black/10 hover:bg-black/20 backdrop-blur-md border-white/10'
                    }`}
                  >
                    {/* Original Content */}
                    <div className={`flex items-start gap-3 transition-all duration-300 ${showAddressCopied ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                      <div className="mt-1 p-2 bg-white/10 rounded-xl text-white group-hover:scale-110 transition-transform flex-shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase tracking-wider font-black text-white leading-none">Location</span>
                          <Copy className="w-3 h-3 text-white/60 group-hover:text-white transition-colors" />
                        </div>
                        <span className="text-sm font-bold leading-snug break-words">{poll.location}</span>
                      </div>
                    </div>

                    {/* Success Content Overlay */}
                    <div className={`absolute inset-0 flex items-center gap-3 px-4 py-3 transition-all duration-300 ${showAddressCopied ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                      <div className="p-2 bg-white rounded-xl text-brand-green shadow-sm">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-black text-white leading-none mb-1">Success</span>
                        <span className="text-sm font-bold leading-none text-white whitespace-nowrap">Address Copied to Clipboard!</span>
                      </div>
                    </div>
                  </button>
                )}
                <div className="flex items-start gap-3 bg-black/10 hover:bg-black/20 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 transition-all group">
                  {poll.status === "FINALIZED" && poll.finalizedSlotId ? (
                    <>
                      <div className="mt-1 p-2 bg-white/10 rounded-xl text-white group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-black text-white leading-none mb-1.5">Confirmed Participation</span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-[10px] font-black">✓</div>
                            <span className="text-sm font-bold leading-none">{voteCounts[poll.finalizedSlotId]?.YES || 0} yes</span>
                          </div>
                          {voteCounts[poll.finalizedSlotId]?.IF_NEED_BE > 0 && (
                            <div className="flex items-center gap-1.5 border-l border-white/20 pl-3">
                              <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-black text-white/80">?</div>
                              <span className="text-sm font-bold leading-none">{voteCounts[poll.finalizedSlotId].IF_NEED_BE} if need be</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mt-1 p-2 bg-white/10 rounded-xl text-white group-hover:scale-110 transition-transform">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-black text-white leading-none mb-1">Participants</span>
                        <span className="text-sm font-bold leading-none">{votes.length} participants</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4 w-full md:w-auto">
              <div className={`event-card !bg-white/10 !border-white/40 !backdrop-blur-xl !shadow-none !p-5 !hover:scale-100 transition-all duration-500 ${
                poll.status === "FINALIZED" ? "!bg-white/20 !border-white/60 ring-2 ring-white/20 shadow-lg shadow-black/10" : ""
              }`}>
                <div className="flex items-center gap-5">
                  <div className={`p-3 rounded-2xl shadow-lg transition-all duration-500 ${
                    poll.status === "FINALIZED" 
                      ? "bg-white text-brand-green shadow-brand-green/20" 
                      : "bg-brand-green text-white shadow-brand-green/30"
                  }`}>
                    {poll.status === "FINALIZED" ? <CalendarCheck className="w-7 h-7" /> : <Trophy className="w-7 h-7" />}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-white/70 mb-0.5">
                      {poll.status === "FINALIZED" ? "CONFIRMED DATE" : "TOP SELECTION"}
                    </p>
                    <p className="text-xl font-black text-white leading-tight">
                      {(() => {
                        const targetSlotId = poll.status === "FINALIZED" ? poll.finalizedSlotId : bestSlotId;
                        if (!targetSlotId) return 'No results yet';
                        
                        const slot = poll.timeSlots.find(s => s.id === targetSlotId)!;
                        if (!slot) return 'No results yet';

                        if ("startTime" in slot) {
                          return new Date(slot.startTime).toLocaleDateString(undefined, {
                            weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                          });
                        } else {
                          const dateStr = new Date(slot.date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                          const timeStr = (slot as any).time ? ` @ ${(slot as any).time}` : "";
                          const label = (slot as any).label ? ` - ${(slot as any).label}` : "";
                          return `${dateStr}${label}${timeStr}`;
                        }
                      })()}
                    </p>
                  </div>
                </div>
              </div>
              {(() => {
                const token = localStorage.getItem("adminToken_" + pollId);
                const isAdmin = isOrganizer || token;
                
                if (!isAdmin) return null;

                if (poll.status === "FINALIZED") {
                  return (
                    <button
                      onClick={handleUnfinalize}
                      disabled={unfinalizing}
                      className="flex items-center justify-center gap-2 px-6 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-white font-bold transition-all active:scale-95 disabled:opacity-50"
                    >
                      {unfinalizing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <RotateCcw size={18} />
                      )}
                      Unselect Date
                    </button>
                  );
                }

                const editUrl = `/poll/${pollId}/edit${token ? "?adminToken=" + token : ""}`;
                return (
                  <Link
                    to={editUrl}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-white font-bold transition-all active:scale-95"
                  >
                    <Edit3 size={18} />
                    Edit Poll
                  </Link>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-2 overflow-hidden">
              <Info className="w-5 h-5 text-brand-green flex-shrink-0" />
              <h2 className="text-xl font-bold text-neutral-800 tracking-tight whitespace-nowrap">Availability Grid</h2>
            </div>
            <button
              onClick={() => setIsMaximized(true)}
              className="flex items-center justify-center gap-2 p-2.5 sm:px-4 sm:py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold text-sm transition-all active:scale-95"
              aria-label="Maximize"
            >
              <Maximize2 size={18} />
              <span className="hidden sm:inline">Maximize</span>
            </button>
          </div>

          {renderMatrixTable()}
        </div>
      </div>

      {/* Maximized Overlay */}
      {isMaximized && (
        <div className="fixed inset-0 z-[100] bg-brand-charcoal/95 backdrop-blur-sm p-4 md:p-8 flex flex-col animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-6 text-white">
            <div>
              <h2 className="text-2xl font-black tracking-tight">{poll.title}</h2>
              <p className="text-white/80 font-medium">Availability Grid</p>
            </div>
            <button
              onClick={() => setIsMaximized(false)}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all active:scale-90"
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 overflow-auto rounded-3xl bg-white shadow-2xl">
            <div className="p-2 min-w-full inline-block align-middle">
              {renderMatrixTable()}
            </div>
          </div>
          <div className="mt-6 text-center">
            <button
              onClick={() => setIsMaximized(false)}
              className="px-8 py-3 bg-white text-brand-charcoal font-black rounded-2xl shadow-xl hover:bg-neutral-100 transition-all active:scale-95"
            >
              Close Full Screen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const MapPin = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
);
