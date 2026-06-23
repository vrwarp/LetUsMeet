import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';


import { useNavigate, Link } from "react-router-dom";
import { Plus, Trash2, Calendar as CalendarIcon, MapPin, Type, ArrowRight, ArrowLeft, Loader2, User, Clock, X, Sparkles, Check } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { createBlindPoll } from "@/lib/pollService";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import Button from "@/components/Button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/components/toast/toastContext";
import { dragAnnouncements } from "@/lib/dndAnnouncements";

interface TimeSlotInput {
  id: string;
  date: string;
  startTime?: string; // for EXACT
  endTime?: string;   // for EXACT
  label?: string;    // for FUZZY
  time?: string;     // for FUZZY
}

import timeExactLettuce from "../assets/time-exact-lettuce.webp";
import timeFuzzyMeat from "../assets/time-fuzzy-meat.webp";

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}


function SortableSlotItem({
  id,
  index,
  slot,
  schedulingMode,
  isReady,
  updateSlot,
  removeSlot,
  handlePickerClick,
  handleBlur
}: {
  id: string;
  index: number;
  slot: TimeSlotInput;
  schedulingMode: "EXACT" | "FUZZY";
  isReady: boolean;
  updateSlot: (index: number, field: keyof TimeSlotInput, value: string) => void;
  removeSlot: (index: number) => void;
  handlePickerClick: (e: React.MouseEvent<HTMLInputElement>) => void;
  handleBlur: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group/item">
      <div className="flex flex-col gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100 transition-all hover:border-neutral-200 shadow-sm">
        {schedulingMode === "EXACT" ? (
          <>
            {/* EXACT Row 1 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="flex items-center justify-center cursor-grab active:cursor-grabbing p-1 text-neutral-600 hover:text-neutral-700 transition-colors flex-shrink-0 touch-none"
              >
                <GripVertical size={20} aria-hidden="true" />
                <span className="sr-only">Reorder slot {index + 1}</span>
              </button>
              <label className="relative group/date cursor-pointer flex-1 min-w-0">
                <div className="flex items-center px-3 h-10 text-neutral-700 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/date:border-indigo-500 group-focus-within/date:ring-2 group-focus-within/date:ring-indigo-500/20 transition-all shadow-sm">
                  <CalendarIcon size={14} className="text-indigo-400 mr-2 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate text-sm font-bold">{slot.date ? new Date(slot.date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : "Select date"}</span>
                </div>
                <input
                  type="date"
                  required
                  aria-label="Slot date"
                  data-testid={`slot-date-${index}`}
                  onClick={handlePickerClick}
                  onBlur={handleBlur}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  value={slot.date}
                  onChange={(e) => updateSlot(index, "date", e.target.value)}
                  disabled={!isReady}
                />
              </label>
              <button
                type="button"
                onClick={() => removeSlot(index)}
                aria-label="Remove time slot"
                disabled={!isReady}
                className="w-9 h-9 flex items-center justify-center bg-white text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl border border-neutral-200 shadow-sm transition-all flex-shrink-0"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>

            {/* EXACT Row 2 */}
            <div className="w-full">
              <div className="flex items-center gap-2">
                <label className="relative group/start cursor-pointer flex-1">
                  <div className="flex items-center px-3 py-2 text-neutral-700 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/start:border-indigo-500 group-focus-within/start:ring-2 group-focus-within/start:ring-indigo-500/20 transition-all w-full shadow-sm">
                    <Clock size={14} className="text-indigo-400 mr-2 flex-shrink-0" aria-hidden="true" />
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
                    disabled={!isReady}
                  />
                </label>
                <span className="text-neutral-600 font-bold text-[10px] uppercase tracking-widest flex-shrink-0">to</span>
                <label className="relative group/end cursor-pointer flex-1">
                  <div className="flex items-center px-3 py-2 text-neutral-700 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/end:border-indigo-500 group-focus-within/end:ring-2 group-focus-within/end:ring-indigo-500/20 transition-all w-full shadow-sm">
                    <Clock size={14} className="text-indigo-400 mr-2 flex-shrink-0" aria-hidden="true" />
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
                    disabled={!isReady}
                  />
                </label>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* FUZZY Row 1: Grip handle, Label, Trash */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="flex items-center justify-center cursor-grab active:cursor-grabbing p-1 text-neutral-600 hover:text-neutral-700 transition-colors flex-shrink-0 touch-none"
              >
                <GripVertical size={20} aria-hidden="true" />
                <span className="sr-only">Reorder slot {index + 1}</span>
              </button>
              <input
                type="text"
                aria-label="Slot label"
                data-testid={`slot-label-${index}`}
                placeholder="Label (e.g. Morning)"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-neutral-200 text-sm font-bold outline-none bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20"
                value={slot.label || ""}
                onChange={(e) => updateSlot(index, "label", e.target.value)}
                disabled={!isReady}
              />
              <button
                type="button"
                onClick={() => removeSlot(index)}
                aria-label="Remove time slot"
                disabled={!isReady}
                className="w-9 h-9 flex items-center justify-center bg-white text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl border border-neutral-200 shadow-sm transition-all flex-shrink-0"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>

            {/* FUZZY Row 2: Date, Time */}
            <div className="flex items-center gap-2">
              <label className="relative group/date cursor-pointer flex-1 min-w-0">
                <div className="flex items-center px-3 h-10 text-neutral-700 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/date:border-indigo-500 group-focus-within/date:ring-2 group-focus-within/date:ring-indigo-500/20 transition-all shadow-sm">
                  <CalendarIcon size={14} className="text-indigo-400 mr-2 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate text-sm font-bold">{slot.date ? new Date(slot.date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : "Select date"}</span>
                </div>
                <input
                  type="date"
                  required
                  aria-label="Slot date"
                  data-testid={`slot-date-${index}`}
                  onClick={handlePickerClick}
                  onBlur={handleBlur}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  value={slot.date}
                  onChange={(e) => updateSlot(index, "date", e.target.value)}
                  disabled={!isReady}
                />
              </label>

              <label className="relative group/time cursor-pointer flex-shrink-0">
                <div className="flex items-center px-3 h-10 text-neutral-600 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/time:border-indigo-400 group-focus-within/time:ring-2 group-focus-within/time:ring-indigo-500/10 transition-all w-[110px] shadow-sm hover:border-neutral-300">
                  <span className="text-neutral-600 font-black mr-2 text-sm" aria-hidden="true">~</span>
                  <span className="truncate text-sm">{slot.time || "--:--"}</span>
                  {slot.time && (
                    <button
                      type="button"
                      aria-label="Clear approximate time"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        updateSlot(index, "time", "");
                      }}
                      disabled={!isReady}
                      className="ml-auto text-neutral-400 hover:text-red-500 transition-colors relative z-20"
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <input
                  type="time"
                  aria-label="Approximate time"
                  data-testid={`slot-time-${index}`}
                  onClick={handlePickerClick}
                  onBlur={handleBlur}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  value={slot.time || ""}
                  onChange={(e) => updateSlot(index, "time", e.target.value)}
                  disabled={!isReady}
                />
              </label>
            </div>

            {/* FUZZY Row 3: Suggestions */}
            <div className="flex flex-wrap gap-1">
              {["Morning", "Afternoon", "Evening"].map(suggestion => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => updateSlot(index, "label", suggestion)}
                  disabled={!isReady}
                  className="whitespace-nowrap px-2 py-1 rounded-full bg-white text-[10px] font-bold text-neutral-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all uppercase tracking-tight border border-neutral-200 hover:border-indigo-100 shadow-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CreatePollPage() {
  const navigate = useNavigate();
  const [organizerName, setOrganizerName] = useState("");
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
  const { toast } = useToast();
  const [isReady, setIsReady] = useState(false);

  useDocumentTitle("Create a poll — LetUsMeet");

  useEffect(() => {
    setIsReady(true);
  }, []);


  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSlots((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const [hasPrefilled, setHasPrefilled] = useState(false);

  useEffect(() => {
    if (!hasPrefilled && user && !user.isAnonymous) {
      if (user.displayName) setOrganizerName(user.displayName);
      if (user.displayName) {
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
    const newId = generateId();
    
    if (schedulingMode === "EXACT") {
      setSlots([...slots, { 
        id: newId,
        date: lastSlot?.date || defaultDate, 
        startTime: lastSlot?.startTime || "09:00", 
        endTime: lastSlot?.endTime || "10:00" 
      }]);
    } else {
      setSlots([...slots, { 
        id: newId,
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

    const maxRetries = 2;
    let attempts = 0;

    while (attempts <= maxRetries) {
      try {
        if (schedulingMode === "EXACT") {
          const extractTimeSlots = httpsCallable(functions, "extractTimeSlots");
          const result = await extractTimeSlots({ query: aiQuery });
          const data = result.data as { reasoning: string; time_slots: any[] };

          if (data?.time_slots?.length > 0) {
            setPendingGeneratedSlots(data.time_slots.map((s) => ({
              id: generateId(), date: s.date, startTime: s.start_time, endTime: s.end_time, label: "", time: ""
            })));
            setAiReasoning(data.reasoning);
          } else {
            setAiError("Hmm, we couldn't pull any times from that. Try adding specific days and times.");
          }
        } else {
          const extractFuzzySlots = httpsCallable(functions, "extractFuzzySlots");
          const result = await extractFuzzySlots({ query: aiQuery });
          const data = result.data as { reasoning: string; fuzzy_slots: any[] };

          if (data?.fuzzy_slots?.length > 0) {
            setPendingGeneratedSlots(data.fuzzy_slots.map((s) => ({
              id: generateId(), date: s.date, label: s.label, time: s.time || "", startTime: "", endTime: ""
            })));
            setAiReasoning(data.reasoning);
          } else {
            setAiError("Hmm, we couldn't pull any time blocks from that. Try naming days plus mornings/afternoons/evenings.");
          }
        }
        break;
      } catch (error: any) {
        console.error("AI Generation Error:", error);
        const retryableCodes = ['internal', 'unavailable', 'deadline-exceeded'];
        if (retryableCodes.includes(error.code) && attempts < maxRetries) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          continue;
        }
        setAiError(error.message || "Failed to generate time slots. Please check your input and try again.");
        break;
      }
    }
    setIsGenerating(false);
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

    // Guard invalid/empty dates before they throw an opaque RangeError into the
    // generic catch below.
    if (schedulingMode === "EXACT" && slots.some(slot => !slot.date || Number.isNaN(new Date(`${slot.date}T${slot.startTime || "09:00"}`).getTime()))) {
      setError("Every time needs a date.");
      setIsSubmitting(false);
      return;
    }

    try {
      const metadata = {
        title: title.trim(),
        location,
        organizerName: organizerName.trim(),
        schedulingMode,
        description,
        timeSlots: schedulingMode === "EXACT"
          ? slots.map(slot => ({
            id: slot.id || generateId(),
            startTime: new Date(`${slot.date}T${slot.startTime || "09:00"}`).toISOString(),
            endTime: new Date(`${slot.date}T${slot.endTime || "10:00"}`).toISOString(),
          })) as any[]
          : slots.map(slot => ({
            id: slot.id || generateId(),
            date: slot.date,
            label: slot.label || "General",
            time: slot.time || undefined,
          })) as any[],
      };

      const { pollId, key, adminToken } = await createBlindPoll(metadata);
      toast({ variant: "success", message: "Poll created — share the link to collect responses." });
      navigate(`/poll/${pollId}?adminToken=${adminToken}#key=${key}`);

    } catch (err: unknown) {
      console.error("Failed to create poll", err);
      setError(err instanceof Error ? err.message : "We couldn't create your poll. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };


  const cancelDestination = user && !user.isAnonymous ? "/dashboard" : "/";
  const missingTitle = !title.trim();
  const missingSlots = slots.length === 0;
  const showSubmitHint = (missingTitle || missingSlots) && !isSubmitting;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-8">
      <Link
        to={cancelDestination}
        className="inline-flex items-center gap-2 text-brand-green-dark font-bold mb-8"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Cancel
      </Link>

      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">Create a poll</h1>
        <p className="text-neutral-500">Add a few details and propose the times that could work.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div className="bg-white p-4 sm:p-8 rounded-2xl border border-neutral-200 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="organizer-name" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <User size={16} className="text-indigo-500" aria-hidden="true" />
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
              disabled={!isReady}
            />
          </div>
        </div>

        {/* Basic Info Card */}
        <div className="bg-white p-4 sm:p-8 rounded-2xl border border-neutral-200 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="poll-title" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <Type size={16} className="text-indigo-500" aria-hidden="true" />
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
              disabled={!isReady}
            />
          </div>
 
          <div className="flex flex-col gap-2">
            <label htmlFor="poll-description" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <Type size={16} className="text-indigo-500" aria-hidden="true" />
              Description (Optional)
            </label>
            <textarea
              id="poll-description"
              placeholder="e.g., Let's discuss the project roadmap and next steps."
              className="w-full min-h-[100px] resize-none [field-sizing:content] [@supports(field-sizing:content)]:h-auto"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isReady}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="poll-location" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <MapPin size={16} className="text-indigo-500" aria-hidden="true" />
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
              disabled={!isReady}
            />
          </div>
        </div>

        {/* Scheduling Mode Selection */}
        <div className="bg-white p-4 sm:p-8 rounded-2xl border border-neutral-200 shadow-sm flex flex-col gap-6">
          <span id="scheduling-mode-label" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
            <Type size={16} className="text-brand-green" aria-hidden="true" />
            Scheduling Mode
          </span>
          <div role="radiogroup" aria-labelledby="scheduling-mode-label" aria-label="Scheduling mode" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              role="radio"
              aria-checked={schedulingMode === "EXACT"}
              disabled={!isReady}
              onClick={() => {
                setSchedulingMode("EXACT");
                setPendingGeneratedSlots(null);
                setAiReasoning(null);
              }}
              className={`p-6 rounded-2xl border-2 transition-all text-left flex flex-col gap-1 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden scheduling-mode-exact ${schedulingMode === "EXACT"
                ? "border-brand-green bg-brand-green-light/20 shadow-md shadow-brand-green/5"
                : "border-neutral-100 bg-white hover:border-neutral-200"
                }`}
              style={{
                '--exact-bg': `url(${timeExactLettuce})`,
              } as React.CSSProperties}
            >
              {schedulingMode === "EXACT" && (
                <span className="absolute top-3 right-3 z-20 flex items-center gap-1 text-brand-green-dark">
                  <Check size={16} strokeWidth={3} aria-hidden="true" />
                  <span className="sr-only">Selected</span>
                </span>
              )}
              <div className="relative z-10 flex flex-col gap-1">
                <span className={`font-bold text-lg ${schedulingMode === "EXACT" ? "text-brand-green-dark" : "text-neutral-700"}`}>Exact Times</span>
                <span className="text-sm text-neutral-600 leading-snug">Pick specific start and end times (e.g. 2:00–3:00 PM).</span>
              </div>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={schedulingMode === "FUZZY"}
              disabled={!isReady}
              onClick={() => {
                setSchedulingMode("FUZZY");
                setPendingGeneratedSlots(null);
                setAiReasoning(null);
              }}
              className={`p-6 rounded-2xl border-2 transition-all text-left flex flex-col gap-1 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden scheduling-mode-fuzzy ${schedulingMode === "FUZZY"
                ? "border-brand-green bg-brand-green-light/20 shadow-md shadow-brand-green/5"
                : "border-neutral-100 bg-white hover:border-neutral-200"
                }`}
              style={{
                '--fuzzy-bg': `url(${timeFuzzyMeat})`,
              } as React.CSSProperties}
            >
              {schedulingMode === "FUZZY" && (
                <span className="absolute top-3 right-3 z-20 flex items-center gap-1 text-brand-green-dark">
                  <Check size={16} strokeWidth={3} aria-hidden="true" />
                  <span className="sr-only">Selected</span>
                </span>
              )}
              <div className="relative z-10 flex flex-col gap-1">
                <span className={`font-bold text-lg ${schedulingMode === "FUZZY" ? "text-brand-green-dark" : "text-neutral-700"}`}>Flexible Windows</span>
                <span className="text-sm text-neutral-600 leading-snug">Offer flexible blocks like mornings or evenings, no exact time needed.</span>
              </div>
            </button>
          </div>
        </div>

        {/* Time Slots Card */}
        <div className="bg-white p-4 sm:p-8 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <CalendarIcon size={16} className="text-brand-green" aria-hidden="true" />
              Propose Time Slots
            </label>
          </div>

          <div className="mb-6 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 shadow-inner">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-600 flex-shrink-0">
                  <Sparkles size={14} aria-hidden="true" />
                </div>
                <label htmlFor="ai-query" className="text-sm font-bold text-indigo-900">
                  Add times with AI
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-indigo-700 leading-tight">
                  Describe your availability in plain text (e.g., {schedulingMode === "EXACT" 
                    ? '"Next Tuesday and Thursday from 2pm to 4pm"' 
                    : '"Next weekend evenings and Monday morning"'}
                  ).
                </p>
                
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <textarea
                    id="ai-query"
                    placeholder="Type your availability here..."
                    className="flex-1 px-3 py-[8px] text-sm leading-5 rounded-lg border border-indigo-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all bg-white resize-none h-[68px] min-h-[38px] [field-sizing:content] [@supports(field-sizing:content)]:h-auto"
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    disabled={!isReady}
                  />
                  <button
                    type="button"
                    onClick={handleGenerateSlots}
                    disabled={!isReady || isGenerating || !aiQuery.trim()}
                    className="w-full sm:w-[100px] h-[38px] bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap flex-shrink-0"
                  >
                    {isGenerating ? <Loader2 size={14} className="animate-spin" /> : "Add times"}
                  </button>
                </div>

                  {aiError && (
                    <p role="alert" className="mt-2 text-xs text-red-600 font-medium bg-red-50 p-2 rounded border border-red-100">
                      {aiError}
                    </p>
                  )}

                  {aiReasoning && (
                    <div className="text-[11px] text-indigo-800 bg-indigo-100/50 p-2 pr-7 rounded-lg border border-indigo-200/50 leading-relaxed italic relative">
                      <span className="font-bold not-italic">How we read that: </span>
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
                      
                      <div className="flex flex-col gap-2 mb-4 max-h-[300px] overflow-y-auto pr-1">
                        {pendingGeneratedSlots.map((slot, i) => (
                          <div key={i} className="text-xs text-indigo-700 bg-indigo-50/50 px-3 py-2 rounded-lg border border-indigo-100/50 flex items-center justify-between">
                            <span className="font-bold">
                              {slot.date ? new Date(slot.date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : "Unknown date"}
                            </span>

                            {schedulingMode === "EXACT" ? (
                              <span>{slot.startTime} - {slot.endTime}</span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <span className="bg-white px-2 py-1 rounded border border-indigo-100 uppercase tracking-wide text-[10px] font-bold text-neutral-600">
                                  {slot.label}
                                </span>
                                {slot.time && <span className="opacity-75">~ {slot.time}</span>}
                              </span>
                            )}
                          </div>
                        ))}
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

          {slots.length === 0 && (
            <p data-testid="slots-empty-hint" className="mb-4 text-sm text-neutral-500 font-medium">
              Add at least one time below, or describe your availability above and we'll fill it in.
            </p>
          )}

                   <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            accessibility={{ announcements: dragAnnouncements }}
          >
            <SortableContext
              items={slots.map(s => s.id)}
              strategy={rectSortingStrategy}
            >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {slots.map((slot, index) => (
              <SortableSlotItem
                key={slot.id}
                id={slot.id}
                index={index}
                slot={slot}
                schedulingMode={schedulingMode}
                isReady={isReady}
                updateSlot={updateSlot}
                removeSlot={removeSlot}
                handlePickerClick={handlePickerClick}
                handleBlur={handleBlur}
              />
            ))}

            <button
              type="button"
              onClick={addSlot}
              data-testid="add-slot-btn"
              disabled={!isReady}
              className="flex flex-col items-center justify-center gap-2 p-3 border-2 border-dashed border-neutral-300 rounded-xl text-neutral-800 hover:border-indigo-500 hover:text-indigo-700 hover:bg-indigo-50/30 transition-all font-bold text-sm min-h-[102px] w-full h-full disabled:text-neutral-600 disabled:border-neutral-200 disabled:cursor-not-allowed"
            >
              <Plus size={20} aria-hidden="true" />
              Add time slot
            </button>
          </div>
          </SortableContext>
          </DndContext>
        </div>

        {error && (
          <div role="alert" className="p-5 bg-white border-2 border-brand-red ring-[6px] ring-brand-red/10 text-brand-red rounded-2xl text-sm font-bold shadow-xl shadow-brand-red/5 flex items-center gap-3 animate-fade-in-up">
            <div className="w-8 h-8 bg-brand-red text-white rounded-full flex items-center justify-center flex-shrink-0" aria-hidden="true">!</div>
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            size="lg"
            data-testid="create-submit-btn"
            aria-busy={isSubmitting}
            disabled={!isReady || isSubmitting || !title.trim() || !organizerName.trim() || slots.length === 0}
            className="w-full font-black gap-3 shadow-xl shadow-brand-green/20 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={24} aria-hidden="true" />
                Creating...
              </>
            ) : (
              <>
                Create poll & get link
                <ArrowRight size={24} aria-hidden="true" />
              </>
            )}
          </Button>
          {showSubmitHint && (
            <p data-testid="submit-hint" className="text-center text-sm text-neutral-500 font-medium">
              Add a title and at least one time to continue.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
