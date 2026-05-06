import { Check, X, Minus } from "lucide-react";
import type { VoteValue } from "../types/index";
import { cycleVote } from "@/lib/voteUtils";

interface Props {
  startTime: string;
  endTime: string;
  value: VoteValue;
  onChange: (newValue: VoteValue) => void;
  disabled?: boolean;
}

export default function TimeSlotCard({ startTime, endTime, value, onChange, disabled }: Props) {
  const start = new Date(startTime);
  const end = new Date(endTime);

  const dateStr = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeRange = `${start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;

  const handleClick = () => {
    if (disabled) return;
    onChange(cycleVote(value));
  };

  const getStyles = () => {
    switch (value) {
      case "YES":
        return "bg-emerald-500 border-emerald-600 text-white shadow-emerald-100";
      case "IF_NEED_BE":
        return "bg-amber-400 border-amber-500 text-white border-dashed shadow-amber-100";
      case "NO":
      default:
        return "bg-white border-neutral-200 text-neutral-900 hover:border-neutral-300 shadow-sm";
    }
  };

  const getIcon = () => {
    switch (value) {
      case "YES": return <Check size={20} strokeWidth={3} />;
      case "IF_NEED_BE": return <Minus size={20} strokeWidth={3} />;
      case "NO": return null;
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      data-testid="slot-card"
      className={`relative flex flex-col items-center gap-1 p-4 rounded-2xl border-2 transition-all cursor-pointer select-none h-32 justify-center shadow-md active:scale-95 ${getStyles()} ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${value === 'NO' ? 'text-neutral-600' : 'text-white/80'}`}>
        {dateStr}
      </span>
      <span className="text-lg font-extrabold whitespace-nowrap">
        {timeRange}
      </span>
      <div className="mt-2 h-6 flex items-center justify-center">
        {getIcon()}
      </div>
      
      {/* Visual Feedback for "No" state */}
      {value === "NO" && (
        <div className="absolute top-3 right-3 text-neutral-300">
          <X size={16} />
        </div>
      )}
    </button>
  );
}
