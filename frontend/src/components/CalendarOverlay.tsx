import { useEffect, useState } from "react";
import { fetchOrganizerCalendarAction } from "@/lib/pollApi";
import { AlertCircle, Calendar, Loader2 } from "lucide-react";

interface BusySlot {
  start: string;
  end: string;
}

interface CalendarOverlayProps {
  dates: string[];
}

export default function CalendarOverlay({ dates }: CalendarOverlayProps) {
  const [busySlots, setBusySlots] = useState<BusySlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCalendar() {
      if (dates.length === 0) return;

      setIsLoading(true);
      setError(null);

      // Determine time range from dates
      const sortedDates = [...dates].sort();
      const timeMin = new Date(sortedDates[0] + "T00:00:00Z").toISOString();
      const lastDate = new Date(sortedDates[sortedDates.length - 1] + "T23:59:59Z");
      const timeMax = lastDate.toISOString();

      try {
        const result = await fetchOrganizerCalendarAction({ timeMin, timeMax });
        setBusySlots((result.data as any).busy || []);
      } catch (err: any) {
        console.error("Failed to load calendar", err);
        setError("Sign in with Google to see your calendar conflicts.");
      } finally {
        setIsLoading(false);
      }
    }

    loadCalendar();
  }, [dates]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-500 py-2">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
        <span>Checking for conflicts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
        <AlertCircle size={14} />
        <span>{error}</span>
      </div>
    );
  }

  if (busySlots.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
        <Calendar size={14} />
        <span>Your calendar is clear for the selected dates!</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs font-bold text-neutral-700">
        <Calendar size={14} className="text-indigo-500" />
        Existing Commitments:
      </div>
      <div className="flex flex-wrap gap-2">
        {busySlots.map((slot, idx) => (
          <div key={idx} className="px-2 py-1 bg-red-50 border border-red-100 rounded-md text-[10px] text-red-700 font-medium">
            {new Date(slot.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} @ {new Date(slot.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} - {new Date(slot.end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </div>
        ))}
      </div>
    </div>
  );
}
