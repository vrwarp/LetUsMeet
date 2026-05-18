import { Check, AlertCircle, X } from "lucide-react";
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
        return "bg-white border-neutral-200 text-brand-charcoal hover:bg-brand-light-gray/30 hover:border-neutral-300 shadow-sm";
      case "BLANK":
      default:
        return "bg-neutral-50 border-neutral-200 text-brand-charcoal hover:bg-neutral-100/50 transition-colors shadow-sm";
    }
  };

  const getLabelText = () => {
    switch (value) {
      case "YES": return "Yes";
      case "IF_NEED_BE": return "If need be";
      case "NO": return "No";
      case "BLANK":
      default: return "";
    }
  };

  const getLabelColor = () => {
    switch (value) {
      case "YES": return "text-brand-green-dark";
      case "IF_NEED_BE": return "text-amber-900";
      case "NO": return "text-neutral-500";
      case "BLANK":
      default: return "text-neutral-400";
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
        <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${
          value === 'BLANK' ? 'text-neutral-500' :
          value === 'NO' ? 'text-neutral-500' : 
          value === 'IF_NEED_BE' ? 'text-amber-900' : 
          'text-brand-green-dark'
        }`}>
          {dateStr}
        </span>
        <span className="text-xl font-black whitespace-nowrap">
          {timeRange}
        </span>
        {subtext && (
          <span className={`text-[10px] font-bold ${
            value === 'BLANK' ? 'text-neutral-600' :
            value === 'NO' ? 'text-neutral-600' : 
            value === 'IF_NEED_BE' ? 'text-amber-700' : 
            'text-brand-green-dark'
          }`}>
            {subtext}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3 w-full bg-neutral-50/50 rounded-xl py-2.5 px-4 border border-neutral-100 shadow-inner">
        <div className="flex items-center gap-4">
          {/* YES Icon State */}
          <div 
            onClick={(e) => {
              if (disabled) return;
              e.stopPropagation();
              onChange('YES');
            }}
            data-testid="icon-YES"
            className={`p-2 -m-2 rounded-lg cursor-pointer transition-all duration-300 active:scale-90 ${
              value === 'YES' 
                ? 'text-brand-green scale-110' 
                : 'text-neutral-400 hover:text-brand-green hover:scale-110'
            }`}
          >
            <Check size={18} strokeWidth={4} aria-hidden="true" />
          </div>

          {/* IF_NEED_BE Icon State */}
          <div 
            onClick={(e) => {
              if (disabled) return;
              e.stopPropagation();
              onChange('IF_NEED_BE');
            }}
            data-testid="icon-IF_NEED_BE"
            className={`p-2 -m-2 rounded-lg cursor-pointer transition-all duration-300 active:scale-90 ${
              value === 'IF_NEED_BE'
                ? 'text-amber-600 scale-110'
                : 'text-neutral-400 hover:text-amber-600 hover:scale-110'
            }`}
          >
            <AlertCircle size={18} strokeWidth={3} aria-hidden="true" />
          </div>

          {/* NO Icon State */}
          <div 
            onClick={(e) => {
              if (disabled) return;
              e.stopPropagation();
              onChange('NO');
            }}
            data-testid="icon-NO"
            className={`p-2 -m-2 rounded-lg cursor-pointer transition-all duration-300 active:scale-90 ${
              value === 'NO' 
                ? 'text-neutral-700 scale-110' 
                : 'text-neutral-400 hover:text-neutral-700 hover:scale-110'
            }`}
          >
            <X size={18} strokeWidth={4} aria-hidden="true" />
          </div>
        </div>

        <div className="w-[1.5px] h-4 bg-neutral-200 mx-1" />

        <span className={`text-xs font-black uppercase tracking-wide min-w-[70px] text-left ${getLabelColor()}`}>
          {getLabelText()}
        </span>
      </div>
    </button>
  );
}
