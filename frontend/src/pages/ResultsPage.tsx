import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ArrowLeft, Trophy, Users, Info, CalendarCheck, Edit3, Maximize2, X, RotateCcw, CheckCircle2, Copy, Send, ChevronDown, ChevronUp } from "lucide-react";
import { subscribeToPoll, unfinalizePoll, ensureAdminGrant, finalizePoll, claimPoll, getPrivateVoteData } from "@/lib/pollService";
import type { Poll, VoteValue } from "../types/index";
import ActionCard from "@/components/ActionCard";
import CompactActionCard from "@/components/CompactActionCard";
import { MapPin, User as UserIcon, Share2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

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
  const [showShareCopied, setShowShareCopied] = useState(false);
  const [voteCounts, setVoteCounts] = useState<Record<string, Record<VoteValue, number>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [pollError, setPollError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isTokenAdmin, setIsTokenAdmin] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showAddressCopied, setShowAddressCopied] = useState(false);
  const [showLinkCopied, setShowLinkCopied] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [poll, isDescriptionExpanded]);

  const toggleExpando = () => {
    if (!isDescriptionExpanded) {
      setIsDescriptionExpanded(true);
      setIsClamped(false);
    } else {
      setIsDescriptionExpanded(false);
      // Wait for transition to finish before clamping to show ellipsis
      setTimeout(() => {
        setIsClamped(true);
      }, 700);
    }
  };

  const [emails, setEmails] = useState<Record<string, string>>({});
  const [isFetchingEmails, setIsFetchingEmails] = useState(false);

  const isOrganizer = user && poll?.organizerUid === user.uid;
  const isManager = user && poll?.managers?.includes(user.uid);
  const isAdmin = isOrganizer || isTokenAdmin || isManager;

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
    const token = new URLSearchParams(window.location.search).get("adminToken") || localStorage.getItem("adminToken_" + pollId);
    if (token && user && pollId) {
      ensureAdminGrant(pollId, token).then(valid => {
        setIsTokenAdmin(valid);
      }).catch(err => {
        console.error("ensureAdminGrant failed in results:", err);
        setIsTokenAdmin(false);
      });
    } else {
      setIsTokenAdmin(false);
    }
  }, [user, pollId]);

  useEffect(() => {
    if (isOrganizer && votes.length > 0 && Object.keys(emails).length === 0 && !isFetchingEmails) {
      handleRevealEmails();
    }
  }, [isOrganizer, votes, emails, isFetchingEmails]);

  const handleShare = () => {
    const url = window.location.origin + "/poll/" + pollId;
    navigator.clipboard.writeText(url);
    setShowShareCopied(true);
    setTimeout(() => setShowShareCopied(false), 3000);
  };

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

  const topSlotIds = (() => {
    if (votes.length === 0) return [];
    let maxScore = 0;
    let ids: string[] = [];
    Object.entries(voteCounts).forEach(([id, counts]) => {
      const score = (counts.YES || 0) * 2 + (counts.IF_NEED_BE || 0);
      if (score > maxScore) {
        maxScore = score;
        ids = [id];
      } else if (score === maxScore && score > 0) {
        ids.push(id);
      }
    });
    return ids;
  })();

  const bestSlotId = topSlotIds[0] || null;
  const isTie = topSlotIds.length > 1;

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
      await claimPoll(pollId, token);
      // Re-render via subscription as managers list changes
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
                {isAdmin && (
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

                {isAdmin && poll.status === "OPEN" && (
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
        </tbody>
        <tfoot className="bg-neutral-50/80 border-t-2 border-neutral-100 font-black">
          <tr>
            <td className="p-5 text-neutral-700 sticky left-0 bg-neutral-50/80 z-10 border-r border-neutral-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] uppercase tracking-wider text-xs font-black">TOTAL</td>
            {sortedSlots.map(slot => {
              const yesCount = voteCounts[slot.id]?.YES || 0;
              const maybeCount = voteCounts[slot.id]?.IF_NEED_BE || 0;
              return (
                <td key={slot.id} data-testid={`total-${slot.id}`} className={`p-5 text-center transition-colors duration-500 ${poll.finalizedSlotId === slot.id ? 'bg-brand-green-light/50 border-x-2 border-brand-green/20' : ''}`}>
                  <div className="flex items-center justify-center gap-1.5 font-bold text-xl">
                    <span className="text-brand-green-dark">{yesCount}</span>
                    {maybeCount > 0 && (
                      <span className="text-amber-500 text-sm">({maybeCount})</span>
                    )}
                  </div>
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
      {(() => {
        const token = new URLSearchParams(window.location.search).get("adminToken") || localStorage.getItem("adminToken_" + pollId);
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
        const isActuallyOrganizer = user && poll.organizerUid === user.uid;
        const isAlreadyManager = user && poll.managers?.includes(user.uid);
        
        if (user && !isActuallyOrganizer && !isAlreadyManager && isTokenAdmin) {
          return (
            <div data-testid="claim-banner" className="mb-8 p-6 bg-brand-green-light/30 border border-brand-green-light rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
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

      <div className={`bg-white rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] border border-neutral-100 overflow-hidden mb-8 transition-all duration-500 ${poll.status === "FINALIZED" ? "ring-8 ring-brand-green/10" : ""}`}>
        <div className="px-4 sm:px-8 py-8 sm:py-12 transition-all duration-700 relative overflow-hidden bg-brand-gradient text-white">
          {/* Subtle Glow Effects */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-1/2 -left-1/4 w-[100%] h-[200%] bg-white/[0.03] blur-[120px] rotate-12 transform-gpu" />
          </div>

          <div className="relative z-10 flex flex-col gap-8">
            {/* Top Row: Title/Description & Top Choice Card */}
            <div className="flex flex-wrap items-center justify-between gap-10">
              <div className="flex-1 min-w-0 max-w-4xl">
                <div className="flex items-start gap-4">
                  <div className="w-1.5 self-stretch bg-white/20 rounded-full flex-shrink-0" />
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
                            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white drop-shadow-sm break-words leading-tight">
                              {poll.title}
                            </h1>
                            {poll.description && (
                              <p className="text-sm md:text-base text-white/60 font-medium max-w-2xl leading-relaxed break-words whitespace-pre-wrap">
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
                            className="group/btn relative flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 active:scale-95 transition-all rounded-full border border-white/10 backdrop-blur-md shadow-2xl"
                          >
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60 group-hover/btn:text-white transition-colors">
                              {isDescriptionExpanded ? 'Show Less' : 'Show More'}
                            </span>
                            <div className={`transition-transform duration-500 ${isDescriptionExpanded ? 'rotate-180' : ''}`}>
                              <ChevronDown size={14} className="text-white/40 group-hover/btn:text-white" />
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-5 w-full md:w-auto">
                {(poll.status === "FINALIZED" || bestSlotId) && (
                  <div className={`event-card !p-6 !hover:scale-[1.02] transition-all duration-500 shadow-2xl ${
                    poll.status === "FINALIZED" 
                      ? "!bg-white !text-brand-charcoal !border-white ring-8 ring-white/10" 
                      : "!bg-white/10 !backdrop-blur-2xl !border-white/30 !shadow-none"
                  }`}>
                    <div className="flex items-center gap-6">
                      <div className={`p-4 rounded-[1.25rem] shadow-xl transition-all duration-500 ${
                        poll.status === "FINALIZED" 
                          ? "bg-brand-green text-white shadow-brand-green/20" 
                          : "bg-white text-brand-green shadow-white/10"
                      }`}>
                        {poll.status === "FINALIZED" ? <CalendarCheck className="w-8 h-8" /> : <Trophy className="w-8 h-8" />}
                      </div>
                      <div>
                        <p className={`text-[11px] uppercase tracking-[0.25em] font-black mb-1 ${poll.status === "FINALIZED" ? "text-neutral-400" : "text-white/60"}`}>
                          {poll.status === "FINALIZED" ? "CONFIRMED DATE" : (isTie ? "TIED FOR TOP" : "TOP SELECTION")}
                        </p>
                        <p className={`text-2xl font-black leading-tight ${poll.status === "FINALIZED" ? "text-brand-charcoal" : "text-white"}`}>
                          {(() => {
                            const targetSlotId = poll.status === "FINALIZED" ? poll.finalizedSlotId : bestSlotId;
                            if (!targetSlotId) return null;
                            
                            const slot = poll.timeSlots.find(s => s.id === targetSlotId)!;
                            if (!slot) return null;

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
                        {isTie && poll.status !== "FINALIZED" && (
                          <div className="mt-2 text-[10px] font-black bg-white/20 text-white px-2.5 py-1 rounded-lg inline-block uppercase tracking-widest backdrop-blur-md">
                            Tied with {topSlotIds.length - 1} other{topSlotIds.length > 2 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Row: Action Cards */}
            <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 md:gap-5">
              
              {/* Group 1: Location & Share (Mobile Row 1) */}
              <div className="flex flex-row gap-4 md:gap-5 flex-1 min-w-0 lg:contents">
                {poll.location && (
                  <div className="flex-1 min-w-0 lg:order-1">
                    <ActionCard 
                      icon={<MapPin className="w-5 h-5" />}
                      label="Location"
                      value={poll.location}
                      onCopy={handleCopyAddress}
                      isCopied={showAddressCopied}
                      theme="dark"
                      data-testid="poll-location"
                    />
                  </div>
                )}
                <div className="lg:order-3">
                  <CompactActionCard 
                    icon={<Share2 className="w-6 h-6" />}
                    onAction={handleShare}
                    isSuccess={showShareCopied}
                    theme="dark"
                    data-testid="share-button"
                  />
                </div>
              </div>

              {/* Group 2: Participants & Admin (Mobile Row 2) */}
              <div className="flex flex-row gap-4 md:gap-5 flex-1 min-w-0 lg:contents">
                <div className="flex-1 min-w-0 lg:order-2">
                  {poll.status === "FINALIZED" && poll.finalizedSlotId ? (
                    <ActionCard 
                      icon={<CheckCircle2 className="w-5 h-5" />}
                      label="Confirmed Participation"
                      value={`${votes.filter(v => v.selections[poll.finalizedSlotId!] === "YES").length} People attending`}
                      theme="dark"
                      data-testid="poll-participation"
                    />
                  ) : (
                    <ActionCard 
                      icon={<Users className="w-5 h-5" />}
                      label="Participants"
                      value={`${votes.length} participants`}
                      theme="dark"
                      data-testid="poll-participants"
                    />
                  )}
                </div>

                {(() => {
                  if (!isAdmin) return null;

                  const content = poll.status === "FINALIZED" ? (
                    <button
                      onClick={handleUnfinalize}
                      data-testid="unfinalize-button"
                      className="relative w-[72px] h-[72px] md:w-[84px] md:h-[84px] flex items-center justify-center bg-brand-red/20 hover:bg-brand-red/30 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2rem] border border-brand-red/40 text-brand-red-light shadow-xl transition-all active:scale-[0.98] group"
                    >
                      <div className="p-3 rounded-2xl bg-brand-red/20 group-hover:bg-brand-red/30 group-hover:scale-110 transition-all">
                        {unfinalizing ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <RotateCcw className="w-6 h-6 text-white" />}
                      </div>
                    </button>
                  ) : (
                    <Link
                      to={`/poll/${pollId}/edit${(new URLSearchParams(window.location.search).get("adminToken") || localStorage.getItem("adminToken_" + pollId)) ? "?adminToken=" + (new URLSearchParams(window.location.search).get("adminToken") || localStorage.getItem("adminToken_" + pollId)) : ""}`}
                      className="relative w-[72px] h-[72px] md:w-[84px] md:h-[84px] flex items-center justify-center bg-brand-red/20 hover:bg-brand-red/30 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2rem] border border-brand-red/40 text-brand-red-light shadow-xl transition-all active:scale-[0.98] group"
                    >
                      <div className="p-3 rounded-2xl bg-brand-red/20 group-hover:bg-brand-red/30 group-hover:scale-110 transition-all">
                        <Edit3 className="w-6 h-6 text-white" />
                      </div>
                    </Link>
                  );

                  return (
                    <div className="lg:order-4">
                      {content}
                    </div>
                  );
                })()}
              </div>
            </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-8">
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

          {votes.length === 0 ? (
            <div className="bg-neutral-50 rounded-[2rem] border border-dashed border-neutral-200 p-8 sm:p-12 text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-neutral-100 flex items-center justify-center mx-auto mb-4 text-brand-green">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-neutral-800 mb-2">No responses yet</h3>
              <p className="text-neutral-500 text-sm max-w-sm mx-auto mb-8 leading-relaxed">
                Your availability grid will appear here once participants start voting. Share the poll link to get started!
              </p>
              <button 
                onClick={() => {
                  const url = window.location.origin + "/poll/" + pollId;
                  navigator.clipboard.writeText(url);
                  setShowLinkCopied(true);
                  setTimeout(() => setShowLinkCopied(false), 2000);
                }}
                className={`inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold transition-all shadow-lg active:scale-95 ${
                  showLinkCopied 
                    ? 'bg-brand-green text-white shadow-brand-green/20' 
                    : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200 shadow-neutral-200/20'
                }`}
              >
                {showLinkCopied ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Link Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy Poll Link
                  </>
                )}
              </button>
            </div>
          ) : (
            renderMatrixTable()
          )}
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

