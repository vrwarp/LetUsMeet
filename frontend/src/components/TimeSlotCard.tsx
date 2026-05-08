import { Check, X, AlertCircle } from "lucide-react";
import type { VoteValue, TimeSlot } from "../types/index";
import { cycleVote } from "@/lib/voteUtils";

interface Props {
  slot: TimeSlot;
  value: VoteValue;
  onChange: (newValue: VoteValue) => void;
  disabled?: boolean;
}

export default function TimeSlotCard({ slot, value, onChange, disabled }: Props) {
  const isExact = "startTime" in slot;
  
  let dateStr = "";
  let timeRange = "";
  let subtext = "";

  if (isExact) {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    dateStr = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    timeRange = `${start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  } else {
    const date = new Date(slot.date + "T00:00:00");
    dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    timeRange = slot.label;
    
    if (slot.time) {
      // Format time (e.g., "18:00" -> "6:00 PM")
      const [hours, minutes] = slot.time.split(':');
      const h = parseInt(hours);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formattedHours = h % 12 || 12;
      subtext = `~ ${formattedHours}:${minutes} ${ampm}`;
    }
  }

  const handleClick = () => {
    if (disabled) return;
    onChange(cycleVote(value));
  };

  const getStyles = () => {
    switch (value) {
      case "YES":
        return "bg-brand-green-light/40 border-brand-green text-brand-green-dark shadow-sm ring-2 ring-brand-green/20";
      case "IF_NEED_BE":
        return "bg-amber-100/50 border-amber-300 text-amber-900 border-dashed shadow-sm";
      case "NO":
      default:
        return "bg-white border-neutral-200 text-brand-charcoal hover:bg-brand-light-gray/30 hover:border-neutral-300 shadow-sm";
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      data-testid="slot-card"
      aria-label={`${dateStr}, ${timeRange}${subtext ? ` ${subtext}` : ''}. Current vote: ${value}. Click to change.`}
      className={`relative flex flex-col items-center p-6 rounded-2xl border-2 transition-all cursor-pointer select-none min-h-[140px] justify-between shadow-md active:scale-95 ${getStyles()} ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      <div className="flex flex-col items-center justify-center gap-1">
        <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${value === 'NO' ? 'text-neutral-500' : (value === 'IF_NEED_BE' ? 'text-amber-900' : 'text-brand-green-dark')}`}>
          {dateStr}
        </span>
        <span className="text-xl font-black whitespace-nowrap">
          {timeRange}
        </span>
        {subtext && (
          <span className={`text-[10px] font-bold ${value === 'NO' ? 'text-neutral-400' : (value === 'IF_NEED_BE' ? 'text-amber-700' : 'text-brand-green-dark')}`}>
            {subtext}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-5 w-full">
        {/* YES Icon State */}
        <div className={`transition-all duration-300 rounded-full p-1.5 flex items-center justify-center ${
          value === 'YES' 
            ? 'bg-brand-green text-white shadow-md scale-110' 
            : 'bg-black/5 text-black/15'
        }`}>
          <Check size={18} strokeWidth={4} aria-hidden="true" />
        </div>

        {/* IF_NEED_BE Icon State */}
        <div className={`transition-all duration-300 flex items-center justify-center ${
          value === 'IF_NEED_BE'
            ? 'text-amber-600 scale-125 drop-shadow-sm'
            : 'text-black/10'
        }`}>
          <AlertCircle size={24} strokeWidth={3} aria-hidden="true" />
        </div>
      </div>
    </button>
  );
}
