import { useRef } from "react";
import { Check, AlertCircle, X } from "lucide-react";
import type { VoteValue, TimeSlot } from "../types/index";
import { cycleVote } from "@/lib/voteUtils";

interface Props {
  slot: TimeSlot;
  value: VoteValue;
  onChange: (newValue: VoteValue) => void;
  disabled?: boolean;
}

// The three selectable availability options, in roving-tabindex order.
const OPTIONS: { value: Exclude<VoteValue, "BLANK">; label: string }[] = [
  { value: "YES", label: "Yes" },
  { value: "IF_NEED_BE", label: "If need be" },
  { value: "NO", label: "No" },
];

export default function TimeSlotCard({ slot, value, onChange, disabled }: Props) {
  const isExact = "startTime" in slot;
  const groupRef = useRef<HTMLDivElement>(null);

  let dateStr: string;
  let timeRange: string;
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

  // Tapping the card body (outside an option) cycles through the states,
  // preserving the original interaction.
  const handleCardClick = () => {
    if (disabled) return;
    onChange(cycleVote(value));
  };

  const selectOption = (next: VoteValue) => {
    if (disabled) return;
    onChange(next);
  };

  // Arrow-key navigation across the radio options (wrapping).
  const handleOptionKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    index: number
  ) => {
    if (disabled) return;
    let nextIndex: number;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % OPTIONS.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index - 1 + OPTIONS.length) % OPTIONS.length;
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        e.stopPropagation();
        selectOption(OPTIONS[index].value);
        return;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    const target = OPTIONS[nextIndex];
    selectOption(target.value);
    // Move focus to the newly selected radio.
    const radios = groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]');
    radios?.[nextIndex]?.focus();
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
      default: return "No selection";
    }
  };

  const getLabelColor = () => {
    switch (value) {
      case "YES": return "text-brand-green-dark";
      case "IF_NEED_BE": return "text-amber-900";
      case "NO": return "text-neutral-600";
      case "BLANK":
      default: return "text-neutral-600";
    }
  };

  // Which option, if any, owns tabIndex 0 (roving tabindex). When nothing is
  // selected (BLANK), the first option is focusable per the radiogroup pattern.
  const selectedIndex = OPTIONS.findIndex((o) => o.value === value);
  const rovingIndex = selectedIndex === -1 ? 0 : selectedIndex;

  const optionIcon = (optValue: VoteValue) => {
    switch (optValue) {
      case "YES":
        return <Check size={18} strokeWidth={4} aria-hidden="true" />;
      case "IF_NEED_BE":
        return <AlertCircle size={18} strokeWidth={3} aria-hidden="true" />;
      case "NO":
      default:
        return <X size={18} strokeWidth={4} aria-hidden="true" />;
    }
  };

  const optionStateClass = (optValue: VoteValue) => {
    const isSelected = value === optValue;
    switch (optValue) {
      case "YES":
        return isSelected
          ? "text-brand-green scale-110"
          : "text-neutral-600 hover:text-brand-green hover:scale-110";
      case "IF_NEED_BE":
        return isSelected
          ? "text-amber-600 scale-110"
          : "text-neutral-600 hover:text-amber-600 hover:scale-110";
      case "NO":
      default:
        return isSelected
          ? "text-neutral-700 scale-110"
          : "text-neutral-600 hover:text-neutral-700 hover:scale-110";
    }
  };

  return (
    <div
      onClick={handleCardClick}
      data-testid="slot-card"
      aria-hidden={disabled ? undefined : undefined}
      className={`relative flex flex-col items-center p-6 rounded-2xl border-2 transition-all select-none min-h-[140px] justify-between shadow-md ${!disabled ? 'cursor-pointer active:scale-95' : ''} ${getStyles()} ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      <div className="flex flex-col items-center justify-center gap-1">
        <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${
          value === 'BLANK' ? 'text-neutral-600' :
          value === 'NO' ? 'text-neutral-600' :
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
        <div
          ref={groupRef}
          role="radiogroup"
          aria-label={`Availability for ${dateStr} ${timeRange}`}
          className="flex items-center gap-4"
        >
          {OPTIONS.map((opt, index) => {
            const isSelected = value === opt.value;
            return (
              <div
                key={opt.value}
                role="radio"
                aria-checked={isSelected}
                aria-label={opt.label}
                aria-disabled={disabled || undefined}
                tabIndex={disabled ? -1 : (index === rovingIndex ? 0 : -1)}
                data-testid={`icon-${opt.value}`}
                onClick={(e) => {
                  if (disabled) return;
                  e.stopPropagation();
                  selectOption(opt.value);
                }}
                onKeyDown={(e) => handleOptionKeyDown(e, index)}
                className={`focus-ring p-2 -m-2 rounded-lg transition-all duration-300 active:scale-90 ${!disabled ? 'cursor-pointer' : 'cursor-not-allowed'} ${optionStateClass(opt.value)}`}
              >
                {optionIcon(opt.value)}
              </div>
            );
          })}
        </div>

        <div className="w-[1.5px] h-4 bg-neutral-200 mx-1" />

        <span className={`text-xs font-black uppercase tracking-wide min-w-[70px] text-left ${getLabelColor()}`}>
          {getLabelText()}
        </span>
      </div>
    </div>
  );
}
