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
        return "bg-emerald-600 border-emerald-700 text-white shadow-emerald-100";
      case "IF_NEED_BE":
        return "bg-amber-400 border-amber-500 text-amber-950 border-dashed shadow-amber-100";
      case "NO":
      default:
        return "bg-neutral-50 border-neutral-200 text-neutral-900 hover:border-neutral-300 shadow-sm";
    }
  };

  const getIcon = () => {
    switch (value) {
      case "YES": return <Check size={24} strokeWidth={3} aria-hidden="true" />;
      case "IF_NEED_BE": return <AlertCircle size={24} strokeWidth={3} aria-hidden="true" />;
      case "NO": return null;
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      data-testid="slot-card"
      aria-label={`${dateStr}, ${timeRange}${subtext ? ` ${subtext}` : ''}. Current vote: ${value}. Click to change.`}
      className={`relative flex flex-col items-center gap-1 p-6 rounded-2xl border-2 transition-all cursor-pointer select-none min-h-[120px] justify-center shadow-md active:scale-95 ${getStyles()} ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${value === 'NO' ? 'text-neutral-500' : (value === 'IF_NEED_BE' ? 'text-amber-900' : 'text-white')}`}>
        {dateStr}
      </span>
      <span className="text-xl font-black whitespace-nowrap">
        {timeRange}
      </span>
      {subtext && (
        <span className={`text-[10px] font-medium ${value === 'NO' ? 'text-neutral-400' : (value === 'IF_NEED_BE' ? 'text-amber-800' : 'text-emerald-50')}`}>
          {subtext}
        </span>
      )}
      <div className="mt-3 flex items-center justify-center">
        {getIcon()}
      </div>
      
      {value === "NO" && (
        <div className="absolute top-4 right-4 text-neutral-300">
          <X size={16} aria-hidden="true" />
        </div>
      )}
    </button>
  );
}
