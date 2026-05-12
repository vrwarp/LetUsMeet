import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Calendar as CalendarIcon, MapPin, Type, ArrowRight, Loader2, User, Mail, Clock, X, Sparkles } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { createPoll } from "@/lib/pollService";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

interface TimeSlotInput {
  date: string;
  startTime?: string; // for EXACT
  endTime?: string;   // for EXACT
  label?: string;    // for FUZZY
  time?: string;     // for FUZZY
}

export default function CreatePollPage() {
  const navigate = useNavigate();
  const [organizerName, setOrganizerName] = useState("");
  const [organizerEmail, setOrganizerEmail] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [schedulingMode, setSchedulingMode] = useState<"EXACT" | "FUZZY">("EXACT");
  const [slots, setSlots] = useState<TimeSlotInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeInput, setActiveInput] = useState<HTMLElement | null>(null);
  const [aiQuery, setAiQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pendingGeneratedSlots, setPendingGeneratedSlots] = useState<TimeSlotInput[] | null>(null);
  const { user } = useAuth();

  const [hasPrefilled, setHasPrefilled] = useState(false);

  useEffect(() => {
    if (!hasPrefilled && user && !user.isAnonymous) {
      if (user.displayName) setOrganizerName(user.displayName);
      if (user.email) setOrganizerEmail(user.email);
      if (user.displayName || user.email) {
        setHasPrefilled(true);
      }
    }
  }, [user, hasPrefilled]);


  const handlePickerClick = (e: React.MouseEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (activeInput === el) {
      el.blur();
      setActiveInput(null);
    } else {
      (el as any).showPicker?.();
      setActiveInput(el);
    }
  };

  // Reset active input on blur to ensure next click opens it
  const handleBlur = () => {
    setActiveInput(null);
  };

  const addSlot = () => {
    const lastSlot = slots[slots.length - 1];
    const defaultDate = new Date().toISOString().split('T')[0];
    
    if (schedulingMode === "EXACT") {
      setSlots([...slots, { 
        date: lastSlot?.date || defaultDate, 
        startTime: lastSlot?.startTime || "09:00", 
        endTime: lastSlot?.endTime || "10:00" 
      }]);
    } else {
      setSlots([...slots, { 
        date: lastSlot?.date || defaultDate, 
        label: "", 
        time: "" 
      }]);
    }
  };

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
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
  
  const handleGenerateSlots = async () => {
    if (!aiQuery.trim()) return;

    setIsGenerating(true);
    setAiError(null);
    setAiReasoning(null);
    setPendingGeneratedSlots(null);

    try {
      const extractTimeSlots = httpsCallable(functions, "extractTimeSlots");
      const result = await extractTimeSlots({ query: aiQuery });
      
      const data = result.data as { 
        reasoning: string; 
        time_slots: Array<{ date: string; start_time: string; end_time: string }> 
      };

      if (data && data.time_slots && data.time_slots.length > 0) {
        const generatedSlots: TimeSlotInput[] = data.time_slots.map((slot) => ({
          date: slot.date,
          startTime: slot.start_time,
          endTime: slot.end_time,
        }));

        if (slots.length > 0) {
          setPendingGeneratedSlots(generatedSlots);
        } else {
          setSlots(generatedSlots);
        }
        setAiReasoning(data.reasoning);
        // We no longer clear aiQuery here as per user request
      } else {
        setAiError("Could not understand the time slots from your query. Please try again.");
      }
    } catch (err: any) {
      console.error("AI Generation Error:", err);
      setAiError(err.message || "Failed to generate slots. Please try manually.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyPendingSlots = (mode: 'REPLACE' | 'APPEND') => {
    if (!pendingGeneratedSlots) return;
    if (mode === 'REPLACE') {
      setSlots(pendingGeneratedSlots);
    } else {
      setSlots([...slots, ...pendingGeneratedSlots]);
    }
    setPendingGeneratedSlots(null);
    setAiReasoning(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    setError(null);

    try {
      const { pollId, adminToken } = await createPoll({
        title,
        location,
        organizerName,
        organizerEmail,
        schedulingMode,
        description,
        timeSlots: schedulingMode === "EXACT"
          ? slots.map(slot => ({
            startTime: new Date(`${slot.date}T${slot.startTime || "09:00"}`).toISOString(),
            endTime: new Date(`${slot.date}T${slot.endTime || "10:00"}`).toISOString(),
          })) as any[]
          : slots.map(slot => ({
            date: slot.date,
            label: slot.label || "General",
            time: slot.time || undefined,
          })) as any[],
      });

      console.log("CREATE POLL RESULT:", { pollId, adminToken });

      // Store admin token for the creator
      if (adminToken) {
        localStorage.setItem(`adminToken_${pollId}`, adminToken);
      }

      navigate(`/poll/${pollId}`);
    } catch (err: any) {
      console.error("Failed to create poll", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-8">
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
              className="w-full"
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
              className="w-full"
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
              className="w-full text-lg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
 
          <div className="flex flex-col gap-2">
            <label htmlFor="poll-description" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <Type size={16} className="text-indigo-500" />
              Description (Optional)
            </label>
            <textarea
              id="poll-description"
              placeholder="e.g., Let's discuss the project roadmap and next steps."
              className="w-full min-h-[100px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              className="w-full"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        {/* Scheduling Mode Selection */}
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm flex flex-col gap-6">
          <label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
            <Type size={16} className="text-brand-green" />
            Scheduling Mode
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setSchedulingMode("EXACT");
                // Optionally reset slots or keep date
              }}
              className={`p-6 rounded-2xl border-2 transition-all text-left flex flex-col gap-1 hover:scale-[1.02] active:scale-[0.98] ${schedulingMode === "EXACT"
                ? "border-brand-green bg-brand-green-light/20 shadow-md shadow-brand-green/5"
                : "border-neutral-100 bg-white hover:border-neutral-200"
                }`}
            >
              <span className={`font-bold text-lg ${schedulingMode === "EXACT" ? "text-brand-green-dark" : "text-neutral-700"}`}>Exact Times</span>
              <span className="text-sm text-neutral-500 leading-snug">Pinpoint specific slots for a structured meeting or call.</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSchedulingMode("FUZZY");
              }}
              className={`p-6 rounded-2xl border-2 transition-all text-left flex flex-col gap-1 hover:scale-[1.02] active:scale-[0.98] ${schedulingMode === "FUZZY"
                ? "border-brand-green bg-brand-green-light/20 shadow-md shadow-brand-green/5"
                : "border-neutral-100 bg-white hover:border-neutral-200"
                }`}
            >
              <span className={`font-bold text-lg ${schedulingMode === "FUZZY" ? "text-brand-green-dark" : "text-neutral-700"}`}>Flexible Windows</span>
              <span className="text-sm text-neutral-500 leading-snug">Check general availability for casual meetups or social events.</span>
            </button>
          </div>
        </div>

        {/* Time Slots Card */}
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <CalendarIcon size={16} className="text-brand-green" />
              Propose Time Slots
            </label>
          </div>

          {schedulingMode === "EXACT" && (
            <div className="mb-6 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 shadow-inner">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-600 flex-shrink-0">
                  <Sparkles size={14} />
                </div>
                <label htmlFor="ai-query" className="text-sm font-bold text-indigo-900">
                  Auto-Generate with AI ✨
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-indigo-700 leading-tight">
                  Describe your availability in plain text (e.g., "Next Tuesday and Thursday from 2pm to 4pm").
                </p>
                
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <textarea
                    id="ai-query"
                    placeholder="Type your availability here..."
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-indigo-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all bg-white resize-none min-h-[60px] sm:min-h-[38px] max-h-[200px]"
                    value={aiQuery}
                    onChange={(e) => {
                      setAiQuery(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleGenerateSlots}
                    disabled={isGenerating || !aiQuery.trim()}
                    className="px-4 h-[38px] bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {isGenerating ? <Loader2 size={14} className="animate-spin" /> : "Generate"}
                  </button>
                </div>

                  {aiError && (
                    <p className="text-xs text-red-500 font-medium bg-red-50 p-2 rounded border border-red-100">
                      {aiError}
                    </p>
                  )}

                  {aiReasoning && (
                    <div className="text-[11px] text-indigo-800 bg-indigo-100/50 p-2 pr-7 rounded-lg border border-indigo-200/50 leading-relaxed italic relative">
                      <span className="font-bold not-italic">AI Reasoning: </span>
                      {aiReasoning}
                      {!pendingGeneratedSlots && (
                        <button 
                          onClick={() => setAiReasoning(null)}
                          className="absolute top-1.5 right-1.5 text-indigo-400 hover:text-indigo-600 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  )}

                  {pendingGeneratedSlots && (
                    <div className="mt-2 p-3 bg-white border border-indigo-200 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-indigo-900">Proposed slots ({pendingGeneratedSlots.length}):</span>
                        <button 
                          onClick={() => {
                            setPendingGeneratedSlots(null);
                            setAiReasoning(null);
                          }}
                          className="text-neutral-400 hover:text-neutral-600 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      
                      <div className="flex flex-col gap-2 mb-4">
                        {pendingGeneratedSlots.slice(0, 3).map((slot, i) => (
                          <div key={i} className="text-xs text-indigo-700 bg-indigo-50/50 px-3 py-2 rounded-lg border border-indigo-100/50 flex items-center justify-between">
                            <span className="font-bold">{slot.date ? new Date(slot.date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : "Unknown date"}</span>
                            <span>{slot.startTime} - {slot.endTime}</span>
                          </div>
                        ))}
                        {pendingGeneratedSlots.length > 3 && (
                          <div className="text-[10px] text-center text-indigo-400 font-bold uppercase tracking-wider mt-1">
                            + {pendingGeneratedSlots.length - 3} more slots
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => handleApplyPendingSlots('REPLACE')}
                          className="flex-1 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm active:scale-[0.98]"
                        >
                          Replace Existing
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPendingSlots('APPEND')}
                          className="flex-1 py-2.5 bg-white text-indigo-600 border border-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-50 transition-colors active:scale-[0.98]"
                        >
                          Append to Current
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {slots.map((slot, index) => (
              <div key={index} className="relative group">
                <div className="flex flex-col gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100 transition-all hover:border-neutral-200 shadow-sm relative">
                  <div className="flex items-center justify-between gap-2">
                    <label className="relative group/date cursor-pointer flex-1">
                      <div className="flex items-center px-3 py-2 text-neutral-700 font-medium bg-white rounded-xl border border-neutral-200 group-focus-within/date:border-indigo-500 group-focus-within/date:ring-2 group-focus-within/date:ring-indigo-500/20 transition-all shadow-sm">
                        <CalendarIcon size={14} className="text-indigo-400 mr-2 flex-shrink-0" />
                        <span className="truncate text-xs font-bold">
                          {slot.date ? new Date(slot.date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : "Select date"}
                        </span>
                      </div>
                      <input
                        type="date"
                        required
                        aria-label="Date"
                        data-testid={`slot-date-${index}`}
                        onClick={handlePickerClick}
                        onBlur={handleBlur}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                        value={slot.date}
                        onChange={(e) => updateSlot(index, "date", e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeSlot(index)}
                      aria-label="Remove time slot"
                      className="w-9 h-9 flex items-center justify-center bg-white text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl border border-neutral-200 shadow-sm transition-all flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="w-full">
                    {schedulingMode === "EXACT" ? (
                      <div className="flex items-center gap-2">
                        <label className="relative group/start cursor-pointer flex-1">
                          <div className="flex items-center px-3 py-2 text-neutral-700 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/start:border-indigo-500 group-focus-within/start:ring-2 group-focus-within/start:ring-indigo-500/20 transition-all w-full shadow-sm">
                            <Clock size={14} className="text-indigo-400 mr-2 flex-shrink-0" />
                            <span className="text-sm">{slot.startTime || "09:00"}</span>
                          </div>
                          <input
                            type="time"
                            required
                            aria-label="Start time"
                            data-testid={`slot-start-${index}`}
                            onClick={handlePickerClick}
                            onBlur={handleBlur}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                            value={slot.startTime}
                            onChange={(e) => updateSlot(index, "startTime", e.target.value)}
                          />
                        </label>
                        <span className="text-neutral-400 font-bold text-[10px] uppercase tracking-widest flex-shrink-0">to</span>
                        <label className="relative group/end cursor-pointer flex-1">
                          <div className="flex items-center px-3 py-2 text-neutral-700 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/end:border-indigo-500 group-focus-within/end:ring-2 group-focus-within/end:ring-indigo-500/20 transition-all w-full shadow-sm">
                            <Clock size={14} className="text-indigo-400 mr-2 flex-shrink-0" />
                            <span className="text-sm">{slot.endTime || "10:00"}</span>
                          </div>
                          <input
                            type="time"
                            required
                            aria-label="End time"
                            data-testid={`slot-end-${index}`}
                            onClick={handlePickerClick}
                            onBlur={handleBlur}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                            value={slot.endTime}
                            onChange={(e) => updateSlot(index, "endTime", e.target.value)}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Label (e.g. Morning)"
                            className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 text-sm font-bold outline-none bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20"
                            value={slot.label}
                            onChange={(e) => updateSlot(index, "label", e.target.value)}
                          />
                          <label className="relative group/time cursor-pointer flex-shrink-0">
                            <div className="flex items-center px-3 py-2 text-neutral-600 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/time:border-indigo-400 group-focus-within/time:ring-2 group-focus-within/time:ring-indigo-500/10 transition-all w-24 shadow-sm hover:border-neutral-300">
                              <span className="text-neutral-400 font-black mr-2 text-sm">~</span>
                              <span className="truncate text-sm">{slot.time || "--:--"}</span>
                            </div>
                            <input
                              type="time"
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                              value={slot.time || ""}
                              onChange={(e) => updateSlot(index, "time", e.target.value)}
                            />
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {["Morning", "Afternoon", "Evening"].map(suggestion => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => updateSlot(index, "label", suggestion)}
                              className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white text-[10px] font-bold text-neutral-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all uppercase tracking-wide border border-neutral-200 hover:border-indigo-100 shadow-sm"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addSlot}
              data-testid="add-slot-btn"
              className="flex flex-col items-center justify-center gap-2 p-3 border-2 border-dashed border-neutral-200 rounded-xl text-neutral-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all font-bold text-sm min-h-[102px]"
            >
              <Plus size={20} />
              Add time slot
            </button>
          </div>
        </div>

        {error && (
          <div className="p-5 bg-white border-2 border-brand-red ring-[6px] ring-brand-red/10 text-brand-red rounded-2xl text-sm font-bold shadow-xl shadow-brand-red/5 flex items-center gap-3 animate-fade-in-up">
            <div className="w-8 h-8 bg-brand-red text-white rounded-full flex items-center justify-center flex-shrink-0">!</div>
            {error}
          </div>
        )}

        <button
          type="submit"
          data-testid="create-submit-btn"
          disabled={isSubmitting || !title || !organizerName || !organizerEmail || slots.length === 0}
          className="btn-primary-green w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={24} />
              Creating...
            </>
          ) : (
            <>
              Share Poll
              <ArrowRight size={24} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
