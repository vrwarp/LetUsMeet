import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Calendar as CalendarIcon, MapPin, Type, ArrowRight, Loader2, User, Mail, Clock, X } from "lucide-react";
import { createPollAction } from "@/lib/pollApi";

interface TimeSlotInput {
  date: string;
  startTime: string; // for EXACT
  endTime: string;   // for EXACT
  label?: string;    // for FUZZY
  time?: string;     // for FUZZY
}

export default function CreatePollPage() {
  const navigate = useNavigate();
  const [organizerName, setOrganizerName] = useState("");
  const [organizerEmail, setOrganizerEmail] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [schedulingMode, setSchedulingMode] = useState<"EXACT" | "FUZZY">("EXACT");
  const [slots, setSlots] = useState<TimeSlotInput[]>([
    { date: new Date().toISOString().split('T')[0], startTime: "09:00", endTime: "10:00" }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSlot = () => {
    const lastSlot = slots[slots.length - 1];
    setSlots([...slots, { ...lastSlot }]);
  };

  const removeSlot = (index: number) => {
    if (slots.length > 1) {
      setSlots(slots.filter((_, i) => i !== index));
    }
  };

  const updateSlot = (index: number, field: keyof TimeSlotInput, value: string) => {
    const newSlots = [...slots];
    const oldSlot = newSlots[index];

    if (field === "startTime" && schedulingMode === "EXACT") {
      const oldStart = oldSlot.startTime;
      const oldEnd = oldSlot.endTime;

      if (oldStart && oldEnd) {
        const [startH, startM] = oldStart.split(':').map(Number);
        const [endH, endM] = oldEnd.split(':').map(Number);
        let durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        if (durationMinutes < 0) durationMinutes += 24 * 60;

        const [newStartH, newStartM] = value.split(':').map(Number);
        const newEndTotalMinutes = (newStartH * 60 + newStartM) + durationMinutes;

        const newEndH = Math.floor(newEndTotalMinutes / 60) % 24;
        const newEndM = newEndTotalMinutes % 60;
        const newEndTime = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`;

        newSlots[index] = { ...oldSlot, startTime: value, endTime: newEndTime };
      } else {
        newSlots[index] = { ...oldSlot, [field]: value };
      }
    } else {
      newSlots[index] = { ...oldSlot, [field]: value };
    }
    setSlots(newSlots);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    setError(null);

    try {
      const result = (await createPollAction({
        title,
        location,
        organizerName,
        organizerEmail,
        schedulingMode,
        description: "",
        timeSlots: schedulingMode === "EXACT"
          ? slots.map(slot => ({
            startTime: new Date(`${slot.date}T${slot.startTime}`).toISOString(),
            endTime: new Date(`${slot.date}T${slot.endTime}`).toISOString(),
          }))
          : slots.map(slot => ({
            date: slot.date,
            label: slot.label || "General",
            time: slot.time || undefined,
          })),
      })) as { data: { pollId: string; adminToken: string } };

      console.log("CREATE POLL RESULT:", JSON.stringify(result));

      // Store admin token for the creator
      if (result.data.adminToken) {
        localStorage.setItem(`adminToken_${result.data.pollId}`, result.data.adminToken);
      }

      navigate(`/poll/${result.data.pollId}`);
    } catch (err: any) {
      console.error("Failed to create poll", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">Create a Meeting Poll</h1>
        <p className="text-neutral-500">Define the details and suggest some time slots.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        {/* Organizer Info Card */}
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="organizer-name" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <User size={16} className="text-indigo-500" />
              Your Name
            </label>
            <input
              id="organizer-name"
              required
              type="text"
              data-testid="organizer-name-input"
              placeholder="e.g., Jane Doe"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="organizer-email" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <Mail size={16} className="text-indigo-500" />
              Your Email
            </label>
            <input
              id="organizer-email"
              required
              type="email"
              data-testid="organizer-email-input"
              placeholder="e.g., jane@example.com"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={organizerEmail}
              onChange={(e) => setOrganizerEmail(e.target.value)}
            />
          </div>
        </div>

        {/* Basic Info Card */}
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="poll-title" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <Type size={16} className="text-indigo-500" />
              Meeting Title
            </label>
            <input
              id="poll-title"
              required
              type="text"
              data-testid="poll-title-input"
              placeholder="e.g., Team Sync, Dinner with friends"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-lg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="poll-location" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <MapPin size={16} className="text-indigo-500" />
              Location (Optional)
            </label>
            <input
              id="poll-location"
              type="text"
              data-testid="poll-location-input"
              placeholder="e.g., Zoom, Starbucks, Office"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        {/* Scheduling Mode Selection */}
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm flex flex-col gap-6">
          <label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
            <Type size={16} className="text-indigo-500" />
            Scheduling Mode
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setSchedulingMode("EXACT");
                // Optionally reset slots or keep date
              }}
              className={`p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-1 ${schedulingMode === "EXACT"
                ? "border-indigo-500 bg-indigo-50/50"
                : "border-neutral-100 bg-white hover:border-neutral-200"
                }`}
            >
              <span className={`font-bold ${schedulingMode === "EXACT" ? "text-indigo-700" : "text-neutral-700"}`}>Exact Times</span>
              <span className="text-xs text-neutral-500">Pick specific start and end times</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSchedulingMode("FUZZY");
              }}
              className={`p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-1 ${schedulingMode === "FUZZY"
                ? "border-indigo-500 bg-indigo-50/50"
                : "border-neutral-100 bg-white hover:border-neutral-200"
                }`}
            >
              <span className={`font-bold ${schedulingMode === "FUZZY" ? "text-indigo-700" : "text-neutral-700"}`}>General blocks</span>
              <span className="text-xs text-neutral-500">Morning, Afternoon, Evening</span>
            </button>
          </div>
        </div>

        {/* Time Slots Card */}
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <CalendarIcon size={16} className="text-indigo-500" />
              Propose Time Slots
            </label>
          </div>

          <div className="flex flex-col gap-4">
            {slots.map((slot, index) => (
              <div key={index} className="flex flex-wrap items-center gap-3 p-4 bg-neutral-50 rounded-xl border border-neutral-100 group relative">
                <label className="relative flex-1 min-w-[160px] group/date cursor-pointer">
                  <div className="flex items-center px-3 py-2 text-neutral-700 font-medium bg-white rounded-lg border border-neutral-200 group-focus-within/date:border-indigo-500 group-focus-within/date:ring-2 group-focus-within/date:ring-indigo-500/20 transition-all">
                    <CalendarIcon size={16} className="text-indigo-400 mr-2 flex-shrink-0" />
                    <span className="truncate">
                      {slot.date ? new Date(slot.date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : "Select date"}
                    </span>
                  </div>
                  <input
                    type="date"
                    required
                    aria-label="Date"
                    data-testid={`slot-date-${index}`}
                    onClick={(e) => (e.currentTarget as any).showPicker?.()}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    value={slot.date}
                    onChange={(e) => updateSlot(index, "date", e.target.value)}
                  />
                </label>
                {schedulingMode === "EXACT" ? (
                  <div className="flex items-center gap-2">
                    <label className="relative group/start cursor-pointer">
                      <div className="flex items-center px-3 py-2 text-neutral-700 font-medium bg-white rounded-lg border border-neutral-200 group-focus-within/start:border-indigo-500 group-focus-within/start:ring-2 group-focus-within/start:ring-indigo-500/20 transition-all w-32">
                        <Clock size={16} className="text-indigo-400 mr-2 flex-shrink-0" />
                        <span>{slot.startTime || "09:00"}</span>
                      </div>
                      <input
                        type="time"
                        required
                        aria-label="Start time"
                        data-testid={`slot-start-${index}`}
                        onClick={(e) => (e.currentTarget as any).showPicker?.()}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                        value={slot.startTime}
                        onChange={(e) => updateSlot(index, "startTime", e.target.value)}
                      />
                    </label>
                    <span className="text-neutral-600 font-medium text-sm uppercase tracking-wider">to</span>
                    <label className="relative group/end cursor-pointer">
                      <div className="flex items-center px-3 py-2 text-neutral-700 font-medium bg-white rounded-lg border border-neutral-200 group-focus-within/end:border-indigo-500 group-focus-within/end:ring-2 group-focus-within/end:ring-indigo-500/20 transition-all w-32">
                        <Clock size={16} className="text-indigo-400 mr-2 flex-shrink-0" />
                        <span>{slot.endTime || "10:00"}</span>
                      </div>
                      <input
                        type="time"
                        required
                        aria-label="End time"
                        data-testid={`slot-end-${index}`}
                        onClick={(e) => (e.currentTarget as any).showPicker?.()}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                        value={slot.endTime}
                        onChange={(e) => updateSlot(index, "endTime", e.target.value)}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder="Label (e.g., Dinner)"
                          data-testid={`slot-label-${index}`}
                          className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none bg-white transition-all font-medium text-neutral-700 placeholder:text-neutral-300 shadow-sm"
                          value={slot.label || ""}
                          onChange={(e) => updateSlot(index, "label", e.target.value)}
                        />
                      </div>
                      <label className="relative group/time cursor-pointer flex-shrink-0">
                        <div className="flex items-center px-4 py-3.5 text-neutral-600 font-bold bg-white rounded-xl border-2 border-dashed border-neutral-200 group-focus-within/time:border-indigo-400 group-focus-within/time:ring-2 group-focus-within/time:ring-indigo-500/10 transition-all w-32 italic shadow-sm hover:border-neutral-300 leading-none">
                          <span className="text-neutral-400 font-black mr-2 text-sm leading-none">~</span>
                          <span className="truncate text-base leading-none">{slot.time || "--:--"}</span>
                        </div>
                        <div className="absolute -top-2 left-2 bg-neutral-100 px-1.5 py-0.5 rounded-md border border-neutral-200 text-[8px] font-black uppercase tracking-widest text-neutral-400 shadow-sm z-20 group-hover/time:bg-indigo-50 group-hover/time:border-indigo-200 group-hover/time:text-indigo-500 transition-colors">
                          Approx
                        </div>
                        {slot.time && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              updateSlot(index, "time", "");
                            }}
                            className="absolute inset-y-0 right-2 flex items-center justify-center p-1 text-neutral-300 hover:text-red-500 z-30 transition-all opacity-0 group-hover/time:opacity-100"
                            aria-label="Clear time"
                          >
                            <X size={14} strokeWidth={3} />
                          </button>
                        )}
                        <input
                          type="time"
                          aria-label="Approximate time"
                          data-testid={`slot-time-${index}`}
                          onClick={(e) => (e.currentTarget as any).showPicker?.()}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                          value={slot.time || ""}
                          onChange={(e) => updateSlot(index, "time", e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      {["Morning", "Afternoon", "Evening", "Lunch", "Dinner"].map(suggestion => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => updateSlot(index, "label", suggestion)}
                          className="whitespace-nowrap px-2.5 py-1 rounded-full bg-neutral-100 text-[10px] font-bold text-neutral-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all uppercase tracking-wide border border-transparent hover:border-indigo-100 shadow-sm"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeSlot(index)}
                  disabled={slots.length === 1}
                  aria-label="Remove time slot"
                  className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:hidden"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addSlot}
              data-testid="add-slot-btn"
              className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-neutral-200 rounded-xl text-neutral-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all font-medium mt-2"
            >
              <Plus size={18} />
              Add another option
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          data-testid="create-submit-btn"
          disabled={isSubmitting || !title || !organizerName || !organizerEmail}
          className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={24} />
              Creating...
            </>
          ) : (
            <>
              Create and Share
              <ArrowRight size={24} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
