"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import Input from "./ui/Input";
import Toggle from "./ui/Toggle";
import TextArea from "./ui/TextArea";
import AddTicketModal from "./AddTicketModal";
import { getFirebaseStorage } from "../lib/firebase/client";

const categories = ["Trending", "This Week", "Nearby"];
const accentPalette = ["#ffffff", "#F5E6D7", "#F59E0B", "#A855F7", "#0EA5E9", "#22C55E", "#F43F5E"];
const spotifyTracks = [
  { id: "sunset", title: "Sunset Alley", artist: "Rhea & Co." },
  { id: "nightcap", title: "Nightcap Echoes", artist: "Mira & K" },
  { id: "afterglow", title: "Afterglow Drip", artist: "Neel Remix" }
];
const featuredGuests = ["David", "Anaya", "Karan", "Sana", "Vik", "Aarya", "Neel", "Rhea", "Kabir", "Mira"];


const defaultTickets = [
  {
    id: "default",
    name: "Default Ticket",
    price: 999,
    quantity: 150
  }
];

const createTicketState = () => defaultTickets.map((ticket) => ({ ...ticket }));

const createInitialFormState = () => ({
  title: "",
  summary: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  description: "",
  location: "",
  venue: "",
  host: "",
  category: categories[0],
  image: "/events/holi-edit.svg",
  gradientStart: "#0b0b0b",
  gradientEnd: "#050505",
  gallery: "",
  guests: "",
  ticketName: "Default Ticket",
  ticketPrice: "999",
  youtube: "",
  features: "",
  accentColor: accentPalette[0],
  spotifyTrack: spotifyTracks[0].id
});

const formatGuests = (value) =>
  value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

const DRAFT_STORAGE_KEY = "c1rcle-india:create-event-draft";

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const combineDateTime = (date, time) => {
  if (!date) return null;
  const parsed = new Date(`${date}T${time || "00:00"}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const validateForm = (form, tickets) => {
  const errors = {};

  if (!form.title?.trim()) {
    errors.title = "Event name is required.";
  }

  if (!form.host?.trim()) {
    errors.host = "Host handle is required.";
  }

  if (!form.location?.trim()) {
    errors.location = "Add a neighborhood or venue.";
  }

  const startDate = parseDate(form.startDate);
  if (!startDate) {
    errors.startDate = "Start date is required.";
  }

  if (form.endDate) {
    const endDate = parseDate(form.endDate);
    if (!endDate) {
      errors.endDate = "Provide a valid end date.";
    } else if (startDate && endDate < startDate) {
      errors.endDate = "End date cannot be before the start date.";
    }
  }

  const startDateTime = combineDateTime(form.startDate, form.startTime);
  const endDateTime = combineDateTime(form.endDate || form.startDate, form.endTime);
  if (startDateTime && endDateTime && endDateTime < startDateTime) {
    errors.endTime = "End time cannot be before the start time.";
  }

  const invalidTicket = tickets.some(
    (ticket) => !ticket.name?.trim() || Number(ticket.price) < 0 || Number(ticket.quantity) < 0
  );

  if (invalidTicket) {
    errors.tickets = "Ticket name, price, and quantity must be positive.";
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });
};

const formatPreviewDate = (date, time) => {
  if (!date) return "Add your start date";
  const previewDate = new Date(`${date}T${time || "18:00"}`);
  if (Number.isNaN(previewDate.getTime())) return date;
  return previewDate.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });
};

const getInitials = (value = "") =>
  value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const getContrastColor = (hex = "") => {
  const safeHex = hex.replace("#", "");
  const normalized =
    safeHex.length === 3
      ? `${safeHex[0]}${safeHex[0]}${safeHex[1]}${safeHex[1]}${safeHex[2]}${safeHex[2]}`
      : safeHex.padEnd(6, "f");
  const r = parseInt(normalized.slice(0, 2), 16) || 0;
  const g = parseInt(normalized.slice(2, 4), 16) || 0;
  const b = parseInt(normalized.slice(4, 6), 16) || 0;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65 ? "#000" : "#fff";
};

export default function CreateEventForm() {
  const [recurring, setRecurring] = useState(false);
  const [showExplore, setShowExplore] = useState(true);
  const [password, setPassword] = useState(false);
  const [activity, setActivity] = useState(true);
  const [form, setForm] = useState(createInitialFormState);
  const [tickets, setTickets] = useState(createTicketState);
  const [featureToggles, setFeatureToggles] = useState({ youtube: false, gallery: false });
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [uploadingFlyer, setUploadingFlyer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [shakeForm, setShakeForm] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState("");
  const flyerInputRef = useRef(null);
  const skipAutoSave = useRef(false);

  const { errors, isValid } = useMemo(() => validateForm(form, tickets), [form, tickets]);

  useEffect(() => {
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === "default"
          ? {
              ...ticket,
              name: form.ticketName || "Default Ticket",
              price: Number(form.ticketPrice) || 0
            }
          : ticket
      )
    );
  }, [form.ticketName, form.ticketPrice]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let restored = false;
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.form) {
          setForm((prev) => ({ ...prev, ...saved.form }));
        }
        if (Array.isArray(saved.tickets) && saved.tickets.length) {
          setTickets(saved.tickets);
        }
        if (saved.settings) {
          setShowExplore(Boolean(saved.settings.showExplore ?? true));
          setPassword(Boolean(saved.settings.password ?? false));
          setActivity(Boolean(saved.settings.activity ?? true));
          setRecurring(Boolean(saved.settings.recurring ?? false));
        }
        if (saved.features) {
          setFeatureToggles((prev) => ({ ...prev, ...saved.features }));
        }
        if (saved.updatedAt) {
          setLastSavedAt(saved.updatedAt);
        }
        restored = true;
      }
    } catch (error) {
      setStatus({ type: "error", message: "Unable to load your last draft." });
    } finally {
      setDraftLoaded(true);
    }

    if (restored) {
      skipAutoSave.current = true;
      setStatus({ type: "success", message: "Restored your last draft on this device." });
    }
  }, []);

  const saveDraft = useCallback(
    ({ silent = false } = {}) => {
      if (typeof window === "undefined") return false;
      try {
        const payload = {
          form,
          tickets,
          settings: {
            showExplore,
            password,
            activity,
            recurring
          },
          features: featureToggles,
          updatedAt: new Date().toISOString()
        };

        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
        setLastSavedAt(payload.updatedAt);
        if (!silent) {
          setStatus({ type: "success", message: "Draft saved." });
        }
        return true;
      } catch (error) {
        if (!silent) {
          setStatus({ type: "error", message: "Unable to save draft." });
        }
        return false;
      }
    },
    [form, tickets, showExplore, password, activity, recurring, featureToggles]
  );

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    setLastSavedAt("");
    skipAutoSave.current = true;
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    if (skipAutoSave.current) {
      skipAutoSave.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      saveDraft({ silent: true });
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [draftLoaded, saveDraft]);

  const guestNames = useMemo(() => {
    const parsed = form.guests ? formatGuests(form.guests) : [];
    return parsed.length ? parsed : featuredGuests;
  }, [form.guests]);

  const previewGuests = guestNames.slice(0, 8);
  const primaryGuest = previewGuests[0] || "First guest";
  const overflowGuests = Math.max(guestNames.length - previewGuests.length, 0);
  const additionalGuests = Math.max(guestNames.length - 1, 0);
  const currentTrack = spotifyTracks.find((track) => track.id === form.spotifyTrack) || spotifyTracks[0];
  const lastSavedLabel = useMemo(() => formatTimestamp(lastSavedAt), [lastSavedAt]);

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleFeature = (feature) => {
    setFeatureToggles((prev) => {
      const nextValue = !prev[feature];
      if (!nextValue) {
        setForm((prevForm) => ({ ...prevForm, [feature]: "" }));
      }
      return { ...prev, [feature]: nextValue };
    });
  };

  const handleTicketAdd = (ticket) => {
    setTickets((prev) => [...prev, { ...ticket, id: `tier-${prev.length + 1}` }]);
    setTicketModalOpen(false);
  };

  const handleDraftSave = () => {
    saveDraft();
  };

  const handleFlyerUploadClick = () => {
    flyerInputRef.current?.click();
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Invalid file result"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read the flyer file."));
      reader.readAsDataURL(file);
    });

  const uploadPosterToStorage = async (file) => {
    const storage = getFirebaseStorage();
    const safeName = file.name?.toLowerCase().replace(/[^a-z0-9.]/g, "-") || "poster";
    const posterRef = ref(storage, `posters/${Date.now()}-${safeName}`);
    await uploadBytes(posterRef, file);
    return getDownloadURL(posterRef);
  };

  const handleFlyerFileChange = async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatus({ type: "error", message: "Please upload an image file." });
      input.value = "";
      return;
    }

    setUploadingFlyer(true);
    try {
      const url = await uploadPosterToStorage(file);
      setForm((prev) => ({ ...prev, image: url }));
      setStatus({ type: "success", message: "Poster uploaded to storage." });
    } catch (uploadError) {
      console.error("Flyer upload failed, falling back to data URL", uploadError);
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setForm((prev) => ({ ...prev, image: dataUrl }));
        setStatus({ type: "error", message: "Using local image preview. Upload storage unavailable." });
      } catch (readerError) {
        setStatus({ type: "error", message: readerError.message || "Failed to process the flyer file." });
      }
    } finally {
      setUploadingFlyer(false);
      input.value = "";
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    if (!isValid) {
      const firstError = Object.values(errors)[0] || "Please fix the highlighted fields.";
      setStatus({ type: "error", message: firstError });
      setShakeForm(true);
      return;
    }

    setSubmitting(true);
    setStatus({ type: "", message: "" });

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          summary: form.summary,
          startDate: form.startDate,
          endDate: form.endDate,
          startTime: form.startTime,
          endTime: form.endTime,
          description: form.description,
          location: form.location,
          venue: form.venue,
          host: form.host,
          category: form.category,
          image: form.image,
          gradientStart: form.gradientStart,
          gradientEnd: form.gradientEnd,
          guests: form.guests,
          gallery: form.gallery,
          features: form.features,
          youtube: form.youtube,
          accentColor: form.accentColor,
          spotifyTrack: form.spotifyTrack,
          tickets,
          settings: {
            showExplore,
            password,
            activity,
            recurring
          }
        })
      });

      if (!response.ok) {
        let errorMessage = "Unable to create event";
        try {
          const errorBody = await response.json();
          if (errorBody?.error) errorMessage = errorBody.error;
        } catch {
          // ignore JSON parse issues and fall back to default error
        }
        throw new Error(errorMessage);
      }

      const created = await response.json();
      setStatus({ type: "success", message: `Saved ${created.title}. It is now available on Explore.` });
      setForm(createInitialFormState());
      setRecurring(false);
      setShowExplore(true);
      setPassword(false);
      setActivity(true);
      setTickets(createTicketState());
      setFeatureToggles({ youtube: false, gallery: false });
      clearDraft();
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Unable to create event" });
    } finally {
      setSubmitting(false);
    }
  };

  const flyerBackground =
    form.image?.startsWith("/") || form.image?.startsWith("http")
      ? {
          backgroundImage: `url(${form.image})`,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }
      : {
          background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0))"
        };

  return (
    <>
      <AddTicketModal open={ticketModalOpen} onClose={() => setTicketModalOpen(false)} onSave={handleTicketAdd} />
      <motion.form
        onSubmit={handleSubmit}
        className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]"
        animate={shakeForm ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        onAnimationComplete={() => {
          if (shakeForm) setShakeForm(false);
        }}
      >
        {status.message && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm lg:col-span-2 ${
              status.type === "error" ? "border-red-500/30 text-red-300" : "border-emerald-400/30 text-emerald-300"
            }`}
            role="status"
            aria-live="polite"
          >
            {status.message}
          </div>
        )}
        <div className="space-y-6">
          <section className="glass-panel rounded-[32px] border border-white/10 bg-black/60 p-6 shadow-glow">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/40">Summary</p>
                <p className="text-white/70">Title, hook, and host info shown on the RSVP page.</p>
              </div>
              <span className="rounded-full border border-white/10 px-4 py-1 text-[11px] uppercase tracking-[0.35em] text-white/60">
                Sell Tickets
              </span>
            </div>
            <div className="mt-6 space-y-4">
              <Input
                label="Event Name"
                placeholder="My Event Name"
                helper="Appears on RSVP cards & onsite check-in."
                value={form.title}
                onChange={handleChange("title")}
                required
              />
              <Input
                label="Short Summary"
                placeholder="One line hook"
                helper="Keep it under 60 characters for mobile."
                value={form.summary}
                onChange={handleChange("summary")}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Host Handle"
                  placeholder="@after_dark"
                  helper="Matches your public @ on THE C1RCLE."
                  value={form.host}
                  onChange={handleChange("host")}
                  required
                />
                <label className="flex flex-col gap-2 text-sm text-white/70">
                  <span className="text-xs uppercase tracking-[0.4em] text-white/60">Category</span>
                  <select
                    value={form.category}
                    onChange={handleChange("category")}
                    className="rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-white focus:border-white/40 focus:outline-none"
                  >
                    {categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                  <span className="text-xs text-white/40">Impacts placement on Explore and marketing emails.</span>
                </label>
              </div>
            </div>
          </section>
          <section className="glass-panel rounded-[32px] border border-white/10 bg-black/60 p-6 shadow-glow">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs uppercase tracking-[0.4em] text-white/40">Dates</p>
              <Toggle label="Recurring Series" value={recurring} onChange={setRecurring} />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Input
                type="date"
                label="Start date"
                helper="When doors open for the drop."
                value={form.startDate}
                onChange={handleChange("startDate")}
                required
              />
              <Input
                type="date"
                label="End date"
                helper="Optional wrap date for multi-day runs."
                value={form.endDate}
                onChange={handleChange("endDate")}
              />
              <Input
                type="time"
                label="Start time"
                helper="Displayed in guest reminders."
                value={form.startTime}
                onChange={handleChange("startTime")}
              />
              <Input
                type="time"
                label="End time"
                helper="Required for strict curfews."
                value={form.endTime}
                onChange={handleChange("endTime")}
              />
            </div>
          </section>
          <section className="glass-panel rounded-[32px] border border-white/10 bg-black/60 p-6 shadow-glow">
            <p className="text-xs uppercase tracking-[0.4em] text-white/40">Event Details</p>
            <div className="mt-6 space-y-4">
              <TextArea
                label="Description"
                placeholder="Tell your story"
                helper="300 characters recommended — this powers search and reminders."
                value={form.description}
                onChange={handleChange("description")}
              />
              <Input
                label="Location"
                placeholder="Neighborhood"
                helper="General neighborhood or city shown across the app."
                value={form.location}
                onChange={handleChange("location")}
                required
              />
              <Input
                label="Venue"
                placeholder="Venue name"
                helper="Optional building or rooftop name for internal crew."
                value={form.venue}
                onChange={handleChange("venue")}
              />
            </div>
          </section>
          <section className="glass-panel rounded-[32px] border border-white/10 bg-black/60 p-6 shadow-glow">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs uppercase tracking-[0.4em] text-white/40">Tickets</p>
              <button
                type="button"
                onClick={() => setTicketModalOpen(true)}
                className="rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/70 transition hover:border-white/40"
              >
                Add Ticket
              </button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Input
                label="Ticket Name"
                helper="Defaults to your primary tier — rename anytime."
                value={form.ticketName}
                onChange={handleChange("ticketName")}
              />
              <Input
                type="number"
                label="Ticket Price (₹)"
                helper="Displayed inclusive of fees on guest checkout."
                value={form.ticketPrice}
                onChange={handleChange("ticketPrice")}
                min="0"
                step="1"
              />
            </div>
            <div className="mt-6 space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70"
                >
                  <div>
                    <p className="text-base text-white">{ticket.name}</p>
                    <p className="text-xs text-white/60">{ticket.quantity} available</p>
                  </div>
                  <p className="text-lg font-semibold text-white">₹{ticket.price}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-white/60">
              Need help launching your paid event? <span className="text-white">Join our Street Team orientation →</span>
            </p>
          </section>
          <section className="glass-panel rounded-[32px] border border-white/10 bg-black/60 p-6 shadow-glow">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.4em] text-white/40">Guestlist</p>
              <span className="text-xs text-white/60">Auto-syncs to the RSVP drawer</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="flex -space-x-3">
                {previewGuests.map((guest) => (
                  <span
                    key={guest}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-xs font-semibold uppercase text-white"
                  >
                    {guest
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                ))}
                {overflowGuests > 0 && (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/20 text-xs text-white/60">
                    +{overflowGuests}
                  </span>
                )}
              </div>
              <div className="text-xs text-white/60">
                <p className="text-white">
                  {primaryGuest} and {additionalGuests} others going
                </p>
                <p>Drop comma separated names to overwrite this preview.</p>
              </div>
            </div>
            <div className="mt-6">
              <Input
                label="Guests"
                placeholder="Anaya, Rohit, Mira"
                helper="Comma separated names"
                value={form.guests}
                onChange={handleChange("guests")}
              />
            </div>
          </section>
          <section className="glass-panel rounded-[32px] border border-white/10 bg-black/60 p-6 shadow-glow space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.4em] text-white/40">Event Features</p>
              <span className="text-xs uppercase tracking-[0.3em] text-white/40">Optional</span>
            </div>
            {["youtube", "gallery"].map((feature) => (
              <div key={feature} className="space-y-3 rounded-2xl border border-white/10 bg-black/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{feature === "youtube" ? "YouTube Video" : "Image Gallery"}</p>
                    <p className="text-xs text-white/60">
                      {feature === "youtube"
                        ? "Embed the latest recap or teaser directly on the page."
                        : "Spotlight up to six stills or past flyers."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFeature(feature)}
                    aria-pressed={featureToggles[feature]}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                      featureToggles[feature] ? "bg-white" : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-black transition ${
                        featureToggles[feature] ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                {featureToggles[feature] && (
                  feature === "youtube" ? (
                    <Input
                      label="Video Link"
                      placeholder="https://youtube.com/watch?v=..."
                      helper="Paste a public YouTube URL; it auto-embeds on your page."
                      value={form.youtube}
                      onChange={handleChange("youtube")}
                    />
                  ) : (
                    <TextArea
                      label="Image Paths"
                      placeholder="/events/holi-edit.svg, /events/genz-night.svg"
                      helper="Comma separate image paths — max 6."
                      value={form.gallery}
                      onChange={handleChange("gallery")}
                    />
                  )
                )}
              </div>
            ))}
          </section>
          <section className="glass-panel rounded-[32px] border border-white/10 bg-black/60 p-6 shadow-glow space-y-5">
            <p className="text-xs uppercase tracking-[0.4em] text-white/40">Page Settings</p>
            <Toggle label="Show on Explore" value={showExplore} onChange={setShowExplore} />
            <Toggle label="Password Protected Event" value={password} onChange={setPassword} />
            <Toggle label="Enable Event Activity" value={activity} onChange={setActivity} />
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Accent Color</p>
              <div className="flex flex-wrap gap-3">
                {accentPalette.map((color) => (
                  <button
                    type="button"
                    key={color}
                    onClick={() => setForm((prev) => ({ ...prev, accentColor: color }))}
                    className={`h-10 w-10 rounded-2xl border-2 transition ${
                      form.accentColor === color ? "border-white" : "border-white/10"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select accent ${color}`}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
        <aside className="space-y-6">
          <PhonePreview
            form={form}
            guests={previewGuests}
            totalGuests={guestNames.length}
            accentColor={form.accentColor}
            currentTrack={currentTrack}
          />
          <div className="flyer-grid rounded-[36px] border border-white/10 bg-black/60 p-5 shadow-glow">
            <div className="rounded-[28px] border border-white/10 bg-black/60 p-4">
              <div
                className="relative aspect-[3/4] w-full overflow-hidden rounded-[28px] border border-white/10"
                style={flyerBackground}
              >
                {!form.image && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-white/50">Drop path to preview</div>
                )}
              </div>
              <input ref={flyerInputRef} type="file" accept="image/*" className="hidden" onChange={handleFlyerFileChange} />
              <button
                type="button"
                onClick={handleFlyerUploadClick}
                disabled={uploadingFlyer}
                className="mt-4 w-full rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/40"
              >
                {uploadingFlyer ? "Uploading..." : "Upload Flyer"}
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <Input
                label="Hero Image Path"
                placeholder="/events/holi-edit.svg"
                helper="Use a file in /public or paste an external URL."
                value={form.image}
                onChange={handleChange("image")}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Gradient Start"
                  placeholder="#0b0b0b"
                  value={form.gradientStart}
                  onChange={handleChange("gradientStart")}
                />
                <Input label="Gradient End" placeholder="#050505" value={form.gradientEnd} onChange={handleChange("gradientEnd")} />
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-[32px] border border-white/10 bg-black/60 p-6 shadow-glow space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Spotify Song Selector</p>
              <p className="text-sm text-white/70">Embed a mood track from the crew.</p>
            </div>
            <label className="flex flex-col gap-2 text-sm text-white/70">
              <span className="text-xs uppercase tracking-[0.4em] text-white/60">Pick Track</span>
              <select
                value={form.spotifyTrack}
                onChange={handleChange("spotifyTrack")}
                className="rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-white focus:border-white/40 focus:outline-none"
              >
                {spotifyTracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.title} — {track.artist}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/10 via-transparent to-white/5 px-4 py-3 text-sm text-white/70">
              <p className="text-base font-semibold text-white">{currentTrack.title}</p>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">{currentTrack.artist}</p>
            </div>
          </div>
          <div className="glass-panel rounded-[32px] border border-white/10 bg-black/60 p-6 shadow-glow space-y-4">
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="w-full rounded-full bg-white px-4 py-3 text-xs uppercase tracking-[0.3em] text-black transition disabled:cursor-not-allowed disabled:bg-white/50"
            >
              {submitting ? "Creating..." : "Create Event"}
            </button>
            {!isValid && (
              <p className="text-center text-xs text-white/60">Review the required fields before publishing.</p>
            )}
            <button
              type="button"
              onClick={handleDraftSave}
              className="w-full rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em]"
            >
              Save Draft
            </button>
            {lastSavedLabel && <p className="text-center text-[11px] text-white/40">Draft saved {lastSavedLabel}</p>}
          </div>
        </aside>
      </motion.form>
    </>
  );
}

function PhonePreview({ form, guests, totalGuests, accentColor, currentTrack }) {
  const dateLabel = formatPreviewDate(form.startDate, form.startTime);
  const locationLabel = form.location || "Add a neighborhood";
  const displayTitle = form.title || "Name your drop";
  const summary = form.summary || "Write a punchy line that sells the vibe.";
  const hostHandle = form.host || "@yourcrew";
  const fallbackGuests = guests?.length ? guests : ["Anaya", "Rohit", "Mira"];
  const overflow = Math.max((totalGuests || fallbackGuests.length) - fallbackGuests.length, 0);
  const previewPoster = form.image;
  const ctaColor = accentColor || "#ffffff";
  const ctaTextColor = getContrastColor(ctaColor);

  const posterBackground = previewPoster
    ? {
        backgroundImage: `url(${previewPoster})`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      }
    : {
        backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0))"
      };

  return (
    <motion.div
      className="glass-panel rounded-[40px] border border-white/10 bg-black/70 p-5 shadow-glow"
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="mx-auto w-full max-w-[360px] rounded-[44px] border border-white/10 bg-gradient-to-b from-white/5 via-transparent to-black/40 p-4 text-white shadow-[0_35px_100px_rgba(0,0,0,0.65)]">
        <div className="rounded-[32px] border border-white/10 bg-black/80 p-4 space-y-4">
          <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[28px] border border-white/5" style={posterBackground}>
            {!previewPoster && (
              <div className="absolute inset-0 flex items-center justify-center text-center text-xs text-white/60">
                Upload a flyer to preview the phone render.
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">{hostHandle}</p>
            <p className="text-2xl font-display">{displayTitle}</p>
            <p className="text-sm text-white/60">{summary}</p>
          </div>
          <div className="rounded-3xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-white/70">
            <p className="text-white">{dateLabel}</p>
            <p>{locationLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-3">
              {fallbackGuests.slice(0, 3).map((guest) => (
                <span
                  key={guest}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-black/30 bg-white/80 text-xs font-semibold uppercase text-black"
                >
                  {getInitials(guest)}
                </span>
              ))}
              {overflow > 0 && (
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-white/30 text-xs text-white/70">
                  +{overflow}
                </span>
              )}
            </div>
            <p className="text-xs text-white/50">{Math.max(totalGuests || fallbackGuests.length, fallbackGuests.length)} invited</p>
          </div>
          <button
            type="button"
            className="w-full rounded-full px-4 py-3 text-[11px] uppercase tracking-[0.35em]"
            style={{ backgroundColor: ctaColor, color: ctaTextColor }}
          >
            Preview CTA
          </button>
          <div className="rounded-3xl border border-white/10 bg-black/50 px-4 py-3 text-xs text-white/60">
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">Featured Track</p>
            <p className="text-base font-semibold text-white">{currentTrack.title}</p>
            <p className="text-xs text-white/50">{currentTrack.artist}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
