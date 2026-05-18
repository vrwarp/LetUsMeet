import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  Loader2, 
  ArrowLeft, 
  Users, 
  Info, 
  CalendarCheck, 
  Edit3, 
  Maximize2, 
  X, 
  RotateCcw, 
  CheckCircle2, 
  ChevronDown,
  Lock,
  MapPin,
  Share2,
  ShieldCheck,
  Send
} from "lucide-react";
import { 
  extractKeyFromFragment, 
  subscribeToLedger, 
  appendSignedEvent, 
  loadIdentity,
  getShareableUrl
} from "@/lib/pollService";
import { importSymmetricKey, exportPublicKey } from "@/lib/crypto";
import { useAuth } from "../hooks/useAuth";
import type { PollState, VoteValue, PollAction } from "../types";
import ActionCard from "@/components/ActionCard";
import CompactActionCard from "@/components/CompactActionCard";

export default function ResultsPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const { user } = useAuth();
  
  const [pollState, setPollState] = useState<PollState | null>(null);
  const [syncStatus, setSyncStatus] = useState("Initializing...");
  const [symmetricKey, setSymmetricKey] = useState<CryptoKey | null>(null);
  const [identity, setIdentity] = useState<{ privateKey: CryptoKey, publicKey: CryptoKey } | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareCopied, setShowShareCopied] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [finalizing, setFinalizing] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unfinalizing, setUnfinalizing] = useState(false);
  const [showLocationCopied, setShowLocationCopied] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!identity || !pollState?.adminPublicKey) {
        setIsAdmin(false);
        return;
      }
      const pubKeyHex = await exportPublicKey(identity.publicKey);
      setIsAdmin(pubKeyHex === pollState.adminPublicKey);
    };
    checkAdminStatus();
  }, [identity, pollState?.adminPublicKey]);

  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [pollState, isDescriptionExpanded]);

  // 1. Initialize and Subscribe
  useEffect(() => {
    if (!pollId) return;

    const b64Key = extractKeyFromFragment();
    if (!b64Key) {
      setError("This poll requires a secret key to view results.");
      setIsLoading(false);
      return;
    }

    const init = async () => {
      try {
        const key = await importSymmetricKey(b64Key);
        setSymmetricKey(key);

        const id = await loadIdentity(pollId);
        setIdentity(id);

        const unsubscribe = subscribeToLedger(pollId, key, (state, status) => {
          if (state) setPollState(state);
          setSyncStatus(status);
          setIsLoading(false);
        });

        return unsubscribe;
      } catch (err: any) {
        setError("Failed to initialize session.");
        setIsLoading(false);
      }
    };

    const unsubPromise = init();
    return () => { unsubPromise.then(unsub => unsub?.()); };
  }, [pollId, user?.uid]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" data-testid="loader">
        <Loader2 className="w-10 h-10 text-brand-green animate-spin" />
        <p className="text-neutral-500 font-medium">{syncStatus}</p>
      </div>
    );
  }

  if (error || !pollState || !pollState.metadata) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Lock className="w-16 h-16 text-neutral-300 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-neutral-800 mb-4">Privacy Protected</h2>
        <p className="text-neutral-600 text-lg mb-8">{error || "Access Denied."}</p>
        <Link to="/" className="btn-primary-green inline-block">Return to Home</Link>
      </div>
    );
  }

  const { metadata, votes } = pollState;

  const voteArray = Array.from(votes.entries()).map(([pubKey, data]) => ({
    pubKey,
    ...data
  }));

  const voteCounts = metadata.timeSlots.reduce((acc, slot) => {
    acc[slot.id] = { YES: 0, NO: 0, IF_NEED_BE: 0 };
    voteArray.forEach(v => {
      const val = v.selections[slot.id] || "NO";
      acc[slot.id][val]++;
    });
    return acc;
  }, {} as Record<string, Record<VoteValue, number>>);

  let sortedSlots = [...metadata.timeSlots].sort((a, b) => {
    if (metadata.schedulingMode === "EXACT") {
      return new Date((a as any).startTime).getTime() - new Date((b as any).startTime).getTime();
    }
    return (a as any).date.localeCompare((b as any).date);
  });

  const topSlotIds = (() => {
    if (voteArray.length === 0) return [];
    let maxScore = -1;
    let ids: string[] = [];
    Object.entries(voteCounts).forEach(([id, counts]) => {
      const score = counts.YES * 2 + counts.IF_NEED_BE;
      if (score > maxScore) {
        maxScore = score;
        ids = [id];
      } else if (score === maxScore && score >= 0) {
        ids.push(id);
      }
    });
    return ids;
  })();

  const bestSlotId = topSlotIds[0] || null;





  const handleCopyLocation = () => {
    if (metadata.location) {
      navigator.clipboard.writeText(metadata.location);
      setShowLocationCopied(true);
      setTimeout(() => setShowLocationCopied(false), 2000);
    }
  };

  const handleFinalize = async (slotId: string) => {
    if (!symmetricKey || !identity || !pollId) return;
    setFinalizing(slotId);
    try {
      const action: PollAction = { type: "POLL_FINALIZED", payload: { finalizedSlotId: slotId } };
      await appendSignedEvent(pollId, symmetricKey, identity.privateKey, identity.publicKey, action);
    } catch (err) {
      alert("Failed to finalize.");
    } finally {
      setFinalizing(null);
    }
  };

  const handleUnfinalize = async () => {
    if (!symmetricKey || !identity || !pollId) return;
    if (!confirm("Are you sure you want to unselect the confirmed date?")) return;
    
    setUnfinalizing(true);
    try {
      const action: PollAction = { type: "POLL_UNFINALIZED", payload: null };
      await appendSignedEvent(pollId, symmetricKey, identity.privateKey, identity.publicKey, action);
    } catch (err) {
      alert("Failed to unselect date.");
    } finally {
      setUnfinalizing(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(getShareableUrl());
    setShowShareCopied(true);
    setTimeout(() => setShowShareCopied(false), 3000);
  };

  const handleComposeEmail = () => {
    if (!metadata || voteArray.length === 0) return;

    const participantsWithEmail = voteArray
      .filter(v => !!v.email)
      .map(v => ({ name: v.participantName, email: v.email! }));

    const participantsWithoutEmail = voteArray
      .filter(v => !v.email)
      .map(v => v.participantName);

    if (participantsWithEmail.length === 0) {
      alert("No participants have provided their email address.");
      return;
    }

    const toString = participantsWithEmail
      .map(p => `"${p.name}" <${p.email}>`)
      .join(", ");

    const subject = `Meeting Update: ${metadata.title}`;
    
    let bodyText = `Hi everyone,\n\n`;
    
    if (participantsWithoutEmail.length > 0) {
      bodyText += `[Note: The following participants' emails were unavailable and not included in this thread: ${participantsWithoutEmail.join(", ")}]\n\n`;
    }

    bodyText += `I'm writing to share an update regarding our meeting "${metadata.title}".\n\n`;
    
    if (pollState.isFinalized && pollState.finalizedSlotId) {
      const slot = metadata.timeSlots.find(s => s.id === pollState.finalizedSlotId);
      if (slot) {
        const dateStr = metadata.schedulingMode === "EXACT" 
          ? new Date((slot as any).startTime).toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
          : `${new Date((slot as any).date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} (${(slot as any).label})`;
        
        bodyText += `CONFIRMED DATE:\n${dateStr}\n\n`;
      }
    }

    if (metadata.location) {
      bodyText += `LOCATION:\n${metadata.location}\n\n`;
    }

    bodyText += `You can view the full results and the availability grid here: ${getShareableUrl()}\n\nBest regards,\n${user?.displayName || 'The Organizer'}`;

    const mailtoUrl = `mailto:?bcc=${encodeURIComponent(toString)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    window.location.href = mailtoUrl;
  };

  const renderMatrixTable = (isCompact = false) => (
    <div className={`overflow-x-auto rounded-2xl border border-neutral-100 bg-white ${isCompact ? 'border-none shadow-none' : ''}`}>
      <table data-testid="results-matrix" className="w-full border-collapse md:min-w-[600px]">
        <thead>
          <tr className="bg-neutral-50 border-b border-neutral-100">
            <th className="p-4 text-left font-semibold text-neutral-700 sticky left-0 bg-neutral-50 z-10 border-r border-neutral-100 w-[180px] min-w-[160px] md:w-[240px] md:min-w-[220px]">
              <div className="flex items-center justify-between gap-2 overflow-hidden">
                <span className="truncate md:overflow-visible md:whitespace-normal">Participants</span>
                {isAdmin && (
                  <button 
                    onClick={handleComposeEmail}
                    className="p-1 hover:bg-neutral-200 rounded-lg transition-colors text-brand-green flex-shrink-0"
                    title="Email all participants"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                )}
              </div>
            </th>
            {sortedSlots.map(slot => (
              <th key={slot.id} className={`${isCompact ? 'p-1' : 'p-2'} md:p-4 text-center min-w-[80px] max-w-[100px] md:min-w-[120px] md:max-w-[180px] ${pollState.finalizedSlotId === slot.id ? 'bg-brand-green-light/50' : ''}`}>
                <div className="text-[11px] md:text-sm font-bold text-neutral-800 leading-tight">
                  {metadata.schedulingMode === "EXACT" 
                    ? new Date((slot as any).startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                    : new Date((slot as any).date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                  }
                </div>
                <div className="text-[10px] md:text-xs text-neutral-500 leading-tight">
                  {metadata.schedulingMode === "EXACT"
                    ? new Date((slot as any).startTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                    : (slot as any).label
                  }
                </div>
                {isAdmin && !pollState.isFinalized && (
                  <button
                    onClick={() => handleFinalize(slot.id)}
                    className="mt-2 text-[10px] md:text-xs font-black bg-brand-green text-white px-3 py-1 rounded-full uppercase hover:bg-brand-green-dark transition-all hover:scale-105 active:scale-95 shadow-sm"
                  >
                    {finalizing === slot.id ? "..." : "Select"}
                  </button>
                )}
              </th>
            ))}
            <th className="w-full bg-neutral-50 border-b border-neutral-100"></th>
          </tr>
        </thead>
        <tbody>
          {voteArray.map((vote, idx) => (
            <tr key={idx} className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors">
              <td className={`${isCompact ? 'p-2' : 'p-4'} sticky left-0 bg-white z-10 border-r border-neutral-100 w-[180px] min-w-[160px] md:w-[240px] md:min-w-[220px]`}>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-neutral-800 truncate">{vote.participantName}</span>
                  {vote.email && (
                    <span className="text-[10px] text-neutral-500 font-medium truncate">{vote.email}</span>
                  )}
                </div>
              </td>
              {sortedSlots.map(slot => (
                <td key={slot.id} className={`${isCompact ? 'p-1' : 'p-2'} md:p-4 text-center min-w-[80px] max-w-[100px] md:min-w-[120px] md:max-w-[180px] ${pollState.finalizedSlotId === slot.id ? 'bg-brand-green-light/20' : ''}`}>
                  <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm ${
                    vote.selections[slot.id] === "YES" ? "bg-brand-green-light text-brand-green-dark" :
                    vote.selections[slot.id] === "IF_NEED_BE" ? "bg-amber-50 text-amber-800" :
                    "bg-red-50 text-red-600"
                  }`}>
                    {vote.selections[slot.id] === "YES" ? "✓" : vote.selections[slot.id] === "IF_NEED_BE" ? "?" : "×"}
                  </div>
                </td>
              ))}
              <td className="w-full"></td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-neutral-50 font-black">
          <tr>
            <td className="p-4 sticky left-0 bg-neutral-50 z-10 border-r border-neutral-100 uppercase text-xs">TOTAL</td>
            {sortedSlots.map(slot => (
              <td key={slot.id} className={`${isCompact ? 'p-1' : 'p-2'} md:p-4 text-center min-w-[80px] max-w-[100px] md:min-w-[120px] md:max-w-[180px] ${pollState.finalizedSlotId === slot.id ? 'bg-brand-green-light/50' : ''}`}>
                <div data-testid={`total-${slot.id}`} className="flex items-center justify-center gap-1 font-bold text-base md:text-lg">
                  <span className="text-brand-green-dark">{voteCounts[slot.id].YES}</span>
                  {voteCounts[slot.id].IF_NEED_BE > 0 && <span className="text-amber-500 text-sm md:text-sm">({voteCounts[slot.id].IF_NEED_BE})</span>}
                </div>
              </td>
            ))}
            <td className="w-full bg-neutral-50"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
      <Link to={`/poll/${pollId}${window.location.search}${window.location.hash}`} className="inline-flex items-center gap-2 text-brand-green-dark font-bold mb-8">
        <ArrowLeft size={16} /> Back to Poll
      </Link>

      <div className={`${pollState.isFinalized ? 'bg-[#0a1108]' : 'bg-brand-gradient'} rounded-[3rem] shadow-2xl relative overflow-hidden transition-colors duration-700 mb-12`}>
        {/* Subtle Decorative Elements */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-green/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-brand-green/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-10">
          {/* Top Row: Title/Description */}
          <div className="flex flex-wrap items-start justify-between gap-10">
            <div className="flex-1 min-w-0 max-w-4xl">
              <div className="flex items-start gap-5">
                <div className="w-1.5 self-stretch bg-brand-green/40 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="relative group/expando">
                    <div 
                      ref={contentRef}
                      className="flex flex-col gap-4 min-w-0 transition-all duration-700 ease-in-out overflow-hidden"
                      style={{ 
                        maxHeight: isDescriptionExpanded ? `${contentHeight}px` : '180px',
                        maskImage: (metadata.description && metadata.description.length > 100 && !isDescriptionExpanded) ? 'linear-gradient(to bottom, black 60%, transparent 100%)' : 'none',
                        WebkitMaskImage: (metadata.description && metadata.description.length > 100 && !isDescriptionExpanded) ? 'linear-gradient(to bottom, black 60%, transparent 100%)' : 'none'
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2 text-white/40">
                         <ShieldCheck size={16} className="text-brand-green" />
                         <span className="text-[10px] font-black uppercase tracking-widest text-brand-green">Zero-Knowledge Results</span>
                      </div>
                      <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm break-words leading-tight">
                        {metadata.title}
                      </h1>
                      {metadata.description && (
                        <p className="text-base md:text-lg text-white/60 font-medium max-w-3xl leading-relaxed break-words whitespace-pre-wrap">
                          {metadata.description}
                        </p>
                      )}
                    </div>

                    {metadata.description && metadata.description.length > 100 && (
                      <div className={`flex justify-center transition-all duration-500 ${
                        isDescriptionExpanded ? 'mt-8 relative z-20' : 'absolute bottom-2 left-0 w-full z-20'
                      }`}>
                        <button
                          onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                          className="group/btn flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/70 transition-all active:scale-95 shadow-lg"
                        >
                          {isDescriptionExpanded ? "Show Less" : "Show More"}
                          <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isDescriptionExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Confirmed Date / Top Choice Box - Featured on Results Page */}
            {bestSlotId && (
              <div className="bg-white text-brand-charcoal p-8 rounded-[2.5rem] shadow-2xl flex items-center gap-6 min-w-[320px] transform hover:scale-[1.01] transition-transform duration-500 lg:ml-auto">
                <div className="w-16 h-16 bg-brand-green rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-green/20">
                  <CalendarCheck className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-1">
                    {pollState.isFinalized ? "CONFIRMED DATE" : "TOP CHOICE"}
                  </p>
                  <p className="text-xl md:text-2xl font-black leading-tight">
                    {(() => {
                      const slot = metadata.timeSlots.find(s => s.id === (pollState.finalizedSlotId || bestSlotId))!;
                      return metadata.schedulingMode === "EXACT"
                        ? new Date((slot as any).startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                        : `${new Date((slot as any).date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, ${(slot as any).label}`;
                    })()}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Row: Action Cards */}
          <div className="grid grid-cols-[1fr_auto] md:flex md:flex-wrap lg:flex-nowrap items-stretch gap-4">
            {/* Location Card - Row 1, Col 1 (Mobile) / Pos 1 (Desktop) */}
            {metadata.location && (
              <div className="order-1 flex-1 min-w-0">
                <ActionCard 
                  icon={<MapPin className="w-5 h-5" />}
                  label="Location"
                  value={metadata.location}
                  onCopy={handleCopyLocation}
                  isCopied={showLocationCopied}
                  theme="dark"
                  data-testid="poll-location"
                />
              </div>
            )}

            {/* Share Button - Row 1, Col 2 (Mobile) / Pos 3 (Desktop) */}
            <div className="order-2 md:order-3">
              <CompactActionCard 
                icon={<Share2 className="w-6 h-6" />}
                onAction={handleShare}
                isSuccess={showShareCopied}
                theme="dark"
              />
            </div>

            {/* Participation Card - Row 2, Col 1 (Mobile) / Pos 2 (Desktop) */}
            <div className="order-3 md:order-2 flex-1 min-w-0">
              <ActionCard 
                icon={pollState.isFinalized ? <CheckCircle2 className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                label={pollState.isFinalized ? "Confirmed Attendance" : "Participants"}
                value={pollState.isFinalized 
                  ? `${voteArray.filter(v => v.selections[pollState.finalizedSlotId!] === "YES").length} People attending`
                  : `${voteArray.length} participants registered`}
                theme="dark"
              />
            </div>

            {/* Admin Action Button - Row 2, Col 2 (Mobile) / Pos 4 (Desktop) */}
            {isAdmin && (
              <div className="order-4 flex-initial">
                {pollState.isFinalized ? (
                  <button
                    onClick={handleUnfinalize}
                    className="w-[72px] h-[72px] md:w-[84px] md:h-[84px] flex items-center justify-center rounded-[1.5rem] md:rounded-[2rem] border border-brand-red/30 bg-brand-red/10 hover:bg-brand-red/20 text-brand-red transition-all active:scale-95 group shadow-xl"
                    title="Unselect Date"
                  >
                    {unfinalizing ? (
                      <Loader2 size={24} className="animate-spin" />
                    ) : (
                      <RotateCcw size={24} className="group-hover:rotate-[-45deg] transition-transform duration-500" />
                    )}
                  </button>
                ) : (
                  <Link
                    to={`/poll/${pollId}/edit${window.location.search}${window.location.hash}`}
                    className="w-[72px] h-[72px] md:w-[84px] md:h-[84px] flex items-center justify-center rounded-[1.5rem] md:rounded-[2rem] border border-brand-red/30 bg-brand-red/10 hover:bg-brand-red/20 text-brand-red transition-all active:scale-95 group shadow-xl"
                    title="Edit Poll"
                  >
                    <Edit3 size={24} className="group-hover:scale-110 transition-transform duration-500" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-8 border border-neutral-100 shadow-xl">
        <div className="flex items-center justify-between mb-8">
           <h2 className="text-2xl font-bold text-neutral-800 flex items-center gap-3">
             <Info className="text-brand-green" /> Availability Grid
           </h2>
           <button 
             onClick={() => setIsMaximized(true)} 
             className="p-2 hover:bg-neutral-100 rounded-lg"
             aria-label="Maximize availability grid"
           >
             <Maximize2 size={20} />
           </button>
        </div>
        
        {voteArray.length === 0 ? (
          <div data-testid="results-empty-state" className="text-center py-20 bg-neutral-50 rounded-3xl border border-dashed border-neutral-200">
            <Users className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-500 font-medium">No responses yet. Share the link to start tallying!</p>
          </div>
        ) : (
          renderMatrixTable()
        )}
      </div>

      {isMaximized && (
        <div className="fixed inset-0 z-[100] bg-brand-charcoal/95 backdrop-blur-md p-3 md:p-8 flex flex-col">
          <div className="flex justify-between items-center text-white mb-4 md:mb-8">
            <h2 className="text-xl md:text-2xl font-bold truncate pr-4">{metadata.title} - Grid</h2>
            <button 
              onClick={() => setIsMaximized(false)} 
              className="p-2 hover:bg-white/10 rounded-full flex-shrink-0"
              aria-label="Close maximization"
            >
              <X size={32} />
            </button>
          </div>
          <div className="flex-1 bg-white rounded-2xl md:rounded-3xl overflow-auto p-1 md:p-4">
             {renderMatrixTable(true)}
          </div>
        </div>
      )}
    </div>
  );
}
