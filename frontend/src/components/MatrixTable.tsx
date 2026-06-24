import { memo } from "react";
import { Send } from "lucide-react";
import type { TimeSlot, VoteValue, VoteData } from "../types";

/** A vote row plus the participant public key, as derived in ResultsPage. */
export type MatrixVoteRow = VoteData & { pubKey: string };

interface Props {
  /** Slots in display order. */
  sortedSlots: TimeSlot[];
  /** One row per participant response. */
  voteArray: MatrixVoteRow[];
  /** Per-slot tallies of each vote value. */
  voteCounts: Record<string, Record<VoteValue, number>>;
  /** Precomputed header `{ date, time }` label for each slot id. */
  slotHeaderLabels: Map<string, { date: string; time: string }>;
  /** The confirmed slot id (highlighted), or null. */
  finalizedSlotId: string | null;
  /** Whether voting is closed. */
  isFinalized: boolean;
  /** Compact (maximize dialog) vs full padding. */
  isCompact: boolean;
  /** Organizer-only controls (email + confirm buttons). */
  isAdmin: boolean;
  /** Mount gate — disables controls until hydrated. */
  isReady: boolean;
  /** Slot id currently being finalized (shows "..."), or null. */
  finalizing: string | null;
  /** Confirm a slot. */
  onFinalize: (slotId: string) => void;
  /** Open the "email all participants" composer. */
  onComposeEmail: () => void;
}

/**
 * Extracted, memoized availability matrix. Receiving stable props means the
 * full grid no longer re-renders when ResultsPage's maximize dialog or
 * share/description toggles flip local state. All data-testids (results-matrix,
 * total-${id}) and roles are preserved exactly from the original inline markup.
 */
function MatrixTable({
  sortedSlots,
  voteArray,
  voteCounts,
  slotHeaderLabels,
  finalizedSlotId,
  isFinalized,
  isCompact,
  isAdmin,
  isReady,
  finalizing,
  onFinalize,
  onComposeEmail,
}: Props) {
  return (
    <div className={`overflow-x-auto rounded-2xl border border-neutral-100 bg-white ${isCompact ? 'border-none shadow-none' : ''}`}>
      <table data-testid="results-matrix" className="w-full border-collapse md:min-w-[600px]">
        <caption className="sr-only">Availability grid: each participant's response for every proposed time slot.</caption>
        <thead>
          <tr className="bg-neutral-50 border-b border-neutral-100">
            <th scope="col" className="p-4 text-left font-semibold text-neutral-700 sticky left-0 bg-neutral-50 z-10 border-r border-neutral-100 w-[180px] min-w-[160px] md:w-[240px] md:min-w-[220px]">
              <div className="flex items-center justify-between gap-2 overflow-hidden">
                <span className="truncate md:overflow-visible md:whitespace-normal">Participants</span>
                {isAdmin && (
                  <button
                    onClick={onComposeEmail}
                    disabled={!isReady}
                    className="p-1 hover:bg-neutral-200 rounded-lg transition-colors text-brand-green flex-shrink-0 disabled:opacity-50"
                    aria-label="Email all participants"
                    title="Email all participants"
                  >
                    <Send className="w-3 h-3" aria-hidden="true" />
                  </button>
                )}
              </div>
            </th>
            {sortedSlots.map(slot => (
              <th scope="col" key={slot.id} className={`${isCompact ? 'p-1' : 'p-2'} md:p-4 text-center min-w-[64px] max-w-[100px] md:min-w-[120px] md:max-w-[180px] ${finalizedSlotId === slot.id ? 'bg-brand-green-light/50' : ''}`}>
                <div className="text-[11px] md:text-sm font-bold text-neutral-800 leading-tight">
                  {slotHeaderLabels.get(slot.id)?.date}
                </div>
                <div className="text-[10px] md:text-xs text-neutral-500 leading-tight">
                  {slotHeaderLabels.get(slot.id)?.time}
                </div>
                {isAdmin && !isFinalized && (
                  <button
                    onClick={() => onFinalize(slot.id)}
                    disabled={!isReady || finalizing === slot.id}
                    className="focus-ring mt-2 text-[10px] md:text-xs font-black bg-brand-green text-white px-3 py-1 rounded-full uppercase hover:bg-brand-green-dark transition-all hover:scale-105 active:scale-95 shadow-sm disabled:opacity-50"
                  >
                    {finalizing === slot.id ? "..." : "Confirm"}
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
              <th scope="row" className={`${isCompact ? 'p-2' : 'p-4'} text-left font-bold sticky left-0 bg-white z-10 border-r border-neutral-100 w-[180px] min-w-[160px] md:w-[240px] md:min-w-[220px]`}>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-neutral-800 truncate">{vote.participantName}</span>
                  {vote.email && (
                    <span className="text-[10px] text-neutral-600 font-medium truncate">{vote.email}</span>
                  )}
                </div>
              </th>
              {sortedSlots.map(slot => {
                const sel = vote.selections[slot.id] || "BLANK";
                const glyph = sel === "YES" ? "✓" : sel === "IF_NEED_BE" ? "⚠" : sel === "BLANK" ? "" : "×";
                const srLabel = sel === "YES" ? "Available" : sel === "IF_NEED_BE" ? "If need be" : sel === "BLANK" ? "No response" : "Not available";
                return (
                  <td key={slot.id} className={`${isCompact ? 'p-1' : 'p-2'} md:p-4 text-center min-w-[64px] max-w-[100px] md:min-w-[120px] md:max-w-[180px] ${finalizedSlotId === slot.id ? 'bg-brand-green-light/20' : ''}`}>
                    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm ${
                      sel === "YES" ? "bg-brand-green-light text-brand-green-dark" :
                      sel === "IF_NEED_BE" ? "bg-amber-50 text-amber-800" :
                      sel === "BLANK" ? "bg-neutral-50 text-neutral-300" :
                      "bg-red-50 text-red-600"
                    }`}>
                      <span aria-hidden="true">{glyph}</span>
                      <span className="sr-only">{srLabel}</span>
                    </div>
                  </td>
                );
              })}
              <td className="w-full"></td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-neutral-50 font-black">
          <tr>
            <th scope="row" className="p-4 text-left sticky left-0 bg-neutral-50 z-10 border-r border-neutral-100 uppercase text-xs">TOTAL</th>
            {sortedSlots.map(slot => (
              <td key={slot.id} className={`${isCompact ? 'p-1' : 'p-2'} md:p-4 text-center min-w-[64px] max-w-[100px] md:min-w-[120px] md:max-w-[180px] ${finalizedSlotId === slot.id ? 'bg-brand-green-light/50' : ''}`}>
                <div data-testid={`total-${slot.id}`} className="flex items-center justify-center gap-1 font-bold text-base md:text-lg">
                  <span className="text-brand-green-dark">{voteCounts[slot.id].YES}</span>
                  {voteCounts[slot.id].IF_NEED_BE > 0 && <span className="text-amber-700 text-sm md:text-sm">({voteCounts[slot.id].IF_NEED_BE})</span>}
                </div>
              </td>
            ))}
            <td className="w-full bg-neutral-50"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default memo(MatrixTable);
