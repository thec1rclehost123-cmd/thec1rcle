"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import Image from "next/image";
import { getFirebaseStorage } from "../lib/firebase/client";
import { EventPage } from "@c1rcle/ui";
import { CITY_MAP } from "@c1rcle/core/events";
import { pickDominantColor, formatColor } from "@c1rcle/core/theme";

const categories = ["Trending", "This Week", "Nearby"];
const accentPalette = ["#8845FF", "#F59E0B", "#EC4899", "#10B981", "#3B82F6", "#F97316", "#8B5CF6"];
const featuredGuests = ["David", "Anaya", "Karan", "Sana", "Vik", "Aarya", "Neel", "Rhea"];

const createInitialFormState = () => ({
  title: "",
  summary: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  description: "",
  location: "",
  city: "pune-in",
  venue: "",
  host: "",
  category: categories[0],
  image: "/events/holi-edit.svg",
  gradientStart: "#0b0b0b",
  gradientEnd: "#050505",
  guests: "",
  tickets: [
    { id: "default", name: "General Admission", price: "999", quantity: 150 }
  ],
  accentColor: accentPalette[0],
  recurring: false,
  youtube: "",
  gallery: "",
  spotifyTrack: "",
  features: "",
  eventPassword: ""
});

export default function CreateEventForm() {
  const [form, setForm] = useState(createInitialFormState);
  const [showExplore, setShowExplore] = useState(true);
  const [showGuestlist, setShowGuestlist] = useState(false);
  const [password, setPassword] = useState(false);
  const [activity, setActivity] = useState(true);
  const [youtubeEnabled, setYoutubeEnabled] = useState(false);
  const [galleryEnabled, setGalleryEnabled] = useState(false);
  const [uploadingFlyer, setUploadingFlyer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [activeTab, setActiveTab] = useState("sell");
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [spotifyModalOpen, setSpotifyModalOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  const flyerInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const spotifyTracks = [
    { id: "none", title: "No Music", artist: "Skip this feature" },
    { id: "sunset", title: "Sunset Vibes", artist: "Chill Beats" },
    { id: "party", title: "Party Mode", artist: "DJ Collective" },
    { id: "lounge", title: "Late Night Lounge", artist: "Ambient Dreams" },
  ];

  const guestNames = useMemo(() => {
    const parsed = form.guests ? form.guests.split(",").map(n => n.trim()).filter(Boolean) : [];
    return parsed.length ? parsed : featuredGuests;
  }, [form.guests]);

  const handleChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFlyerUploadClick = () => {
    flyerInputRef.current?.click();
  };

  const handleGalleryUploadClick = () => {
    galleryInputRef.current?.click();
  };

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

      // Auto-extract dominant color for theming
      const img = new window.Image();
      img.crossOrigin = "Anonymous";
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 10;
        canvas.height = 10;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 10, 10);
        const data = ctx.getImageData(0, 0, 10, 10).data;
        const bestColor = pickDominantColor(data);
        const accentColor = formatColor.hex(bestColor);
        setForm((prev) => ({ ...prev, image: url, accentColor }));
      };

      setStatus({ type: "success", message: "✨ Flyer uploaded successfully!" });
    } catch (error) {
      console.error("Flyer upload error:", error);
      setStatus({ type: "error", message: "Failed to upload flyer." });
    } finally {
      setUploadingFlyer(false);
      input.value = "";
    }
  };

  const handleGalleryFileChange = async (event) => {
    const input = event.target;
    const files = Array.from(input.files || []);

    if (files.length === 0) return;
    if (files.length > 6) {
      setStatus({ type: "error", message: "Maximum 6 images allowed" });
      return;
    }

    const invalidFiles = files.filter(f => !f.type.startsWith("image/"));
    if (invalidFiles.length > 0) {
      setStatus({ type: "error", message: "All files must be images" });
      input.value = "";
      return;
    }

    setUploadingGallery(true);
    try {
      const uploadPromises = files.map(file => uploadPosterToStorage(file));
      const urls = await Promise.all(uploadPromises);

      setGalleryImages(urls);
      setForm((prev) => ({ ...prev, gallery: urls.join(", ") }));
      setStatus({ type: "success", message: `✨ ${urls.length} images uploaded!` });
    } catch (error) {
      setStatus({ type: "error", message: "Failed to upload gallery images." });
    } finally {
      setUploadingGallery(false);
      input.value = "";
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    // Validation
    if (!form.title.trim()) {
      setStatus({ type: "error", message: "Event name is required" });
      return;
    }
    if (!form.location.trim()) {
      setStatus({ type: "error", message: "Location is required" });
      return;
    }
    if (!form.startDate) {
      setStatus({ type: "error", message: "Start date is required" });
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
          city: form.city,
          venue: form.venue,
          host: form.host,
          category: form.category,
          image: form.image,
          gradientStart: form.gradientStart,
          gradientEnd: form.gradientEnd,
          guests: form.guests,
          // Feature fields
          gallery: galleryEnabled ? form.gallery : "",
          youtube: youtubeEnabled ? form.youtube : "",
          spotifyTrack: form.spotifyTrack,
          features: form.features,
          accentColor: form.accentColor,
          tickets: form.tickets.map(t => ({
            ...t,
            price: Number(t.price),
            quantity: Number(t.quantity || 150)
          })),
          settings: {
            showExplore,
            password: password ? form.eventPassword : "",
            activity,
            recurring: form.recurring,
            showGuestlist
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Unable to create event");
      }

      const created = await response.json();
      setStatus({ type: "success", message: `🎉 ${created.title} is now live!` });

      // Reset form
      setForm(createInitialFormState());
      setYoutubeEnabled(false);
      setGalleryEnabled(false);
      setPassword(false);
      setShowExplore(true);
      setActivity(true);
      setShowGuestlist(false);
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Unable to create event" });
    } finally {
      setSubmitting(false);
    }
  };

  // Placeholder for real-time draft saving
  useEffect(() => {
    if (form.title || form.description) {
      const timer = setTimeout(() => {
        setSavingDraft(true);
        // Simulate API call
        setTimeout(() => setSavingDraft(false), 1000);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [form]);

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-[1600px]">
      {/* Floating Action Tabs and Save Status */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-8 flex items-center justify-between"
      >
        <div className="inline-flex rounded-full bg-black/5 dark:bg-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10 p-1 shadow-glow-lg">
          <button
            type="button"
            onClick={() => setActiveTab("sell")}
            className={`relative px-8 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === "sell"
              ? "text-white dark:text-black"
              : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
              }`}
          >
            {activeTab === "sell" && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-black dark:bg-white rounded-full shadow-lg"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">Sell Tickets</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rsvp")}
            className={`relative px-8 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === "rsvp"
              ? "text-white dark:text-black"
              : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
              }`}
          >
            {activeTab === "rsvp" && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-black dark:bg-white rounded-full shadow-lg"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">RSVP Only</span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setMobilePreviewOpen(true)}
            className="xl:hidden rounded-full border border-black/10 dark:border-white/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60 transition hover:bg-black/5 dark:hover:bg-white/5"
          >
            Preview
          </button>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="hidden sm:flex items-center gap-2 text-xs uppercase tracking-widest text-black/40 dark:text-white/40"
          >
            {savingDraft ? (
              <>
                <IconLoader className="animate-spin w-3 h-3" />
                Saving...
              </>
            ) : "Changes saved"}
          </motion.div>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-black dark:bg-white px-6 sm:px-8 py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-widest text-white dark:text-black transition hover:scale-105"
          >
            {submitting ? "Publishing..." : "Publish Event"}
          </button>
        </div>
      </motion.div>

      <div className="flex flex-col xl:grid xl:grid-cols-[600px_1fr] gap-12">
        {/* Left Column - Form Fields (Wizard Content) */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="space-y-6 max-h-[calc(100vh-180px)] overflow-y-auto pr-4 custom-scrollbar pb-20"
        >
          {/* Event Name - Hero Input */}
          <div className="group">
            <input
              type="text"
              value={form.title}
              onChange={handleChange("title")}
              placeholder="Event Title..."
              className="w-full bg-transparent text-4xl font-bold text-black dark:text-white placeholder:text-black/20 dark:placeholder:text-white/20 focus:outline-none transition-all duration-300"
              required
            />
            <div className="h-0.5 bg-black/10 dark:bg-white/10 mt-2" />
          </div>

          {/* Short Summary with glassmorphism */}
          <motion.div
            whileHover={{ y: -2 }}
            className="glass-panel rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 backdrop-blur-xl px-5 py-4 shadow-glow"
          >
            <div className="flex items-center gap-3 text-sm text-iris-glow mb-3">
              <IconSparkles />
              <span className="font-medium">Quick Hook</span>
            </div>
            <input
              type="text"
              value={form.summary}
              onChange={handleChange("summary")}
              placeholder="One line that captures the vibe..."
              className="w-full bg-transparent text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none"
            />
          </motion.div>

          {/* Dates - Elegant Card */}
          <GlassSection icon={<IconCalendar />} title="Dates" badge="Required">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DateTimeInput
                label="Start"
                dateValue={form.startDate}
                timeValue={form.startTime}
                onDateChange={handleChange("startDate")}
                onTimeChange={handleChange("startTime")}
                required
              />
              <DateTimeInput
                label="End"
                dateValue={form.endDate}
                timeValue={form.endTime}
                onDateChange={handleChange("endDate")}
                onTimeChange={handleChange("endTime")}
              />
            </div>

            <motion.div whileHover={{ x: 4 }} className="mt-4">
              <Toggle
                label="Recurring Series"
                value={form.recurring}
                onChange={(val) => setForm(prev => ({ ...prev, recurring: val }))}
              />
            </motion.div>
          </GlassSection>

          {/* Event Details */}
          <GlassSection icon={<IconEdit />} title="Event Details">
            <div className="space-y-4">
              <FloatingInput
                icon={<IconAlignLeft />}
                placeholder="Tell your story..."
                value={form.description}
                onChange={handleChange("description")}
                multiline
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-panel group relative flex flex-col rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 backdrop-blur-xl px-5 py-4 shadow-glow">
                  <div className="flex items-center gap-3 text-sm text-[#F44A22] mb-2">
                    <IconMapPin className="w-4 h-4" />
                    <span className="font-medium uppercase tracking-widest text-[10px]">City</span>
                  </div>
                  <select
                    value={form.city}
                    onChange={handleChange("city")}
                    className="w-full bg-transparent text-black dark:text-white font-semibold focus:outline-none appearance-none cursor-pointer"
                    required
                  >
                    {CITY_MAP.map(city => (
                      <option key={city.key} value={city.key} className="bg-white dark:bg-black text-black dark:text-white">
                        {city.label}
                      </option>
                    ))}
                    <option value="other-in">Other City, IN</option>
                  </select>
                </div>

                <FloatingInput
                  icon={<IconNavigation />}
                  placeholder="Area / Specific Location (e.g. Koregaon Park)"
                  value={form.location}
                  onChange={handleChange("location")}
                  required
                />
              </div>
              <FloatingInput
                icon={<IconBuilding />}
                placeholder="Venue Name (optional)"
                value={form.venue}
                onChange={handleChange("venue")}
              />
            </div>
          </GlassSection>

          {/* Tickets with gradient */}
          <GlassSection icon={<IconTicket />} title="Tickets" badge="Pricing">
            <div className="space-y-3">
              {form.tickets.map((ticket, index) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group relative overflow-hidden rounded-xl border border-black/20 dark:border-white/20 bg-gradient-to-br from-black/10 to-black/5 dark:from-white/10 dark:to-white/5 p-4"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-iris/0 via-iris/5 to-iris/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-iris to-iris-dim flex items-center justify-center shrink-0">
                      <IconTicket />
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-black/50 dark:text-white/50 mb-1 block">Ticket Name</label>
                        <input
                          type="text"
                          value={ticket.name}
                          onChange={(e) => {
                            const newTickets = [...form.tickets];
                            newTickets[index].name = e.target.value;
                            setForm(prev => ({ ...prev, tickets: newTickets }));
                          }}
                          className="w-full bg-transparent text-black dark:text-white font-semibold placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none border-b border-transparent focus:border-iris/50 transition-all"
                          placeholder="Ticket Name"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-black/50 dark:text-white/50 mb-1 block">Price (₹)</label>
                        <input
                          type="number"
                          value={ticket.price}
                          onChange={(e) => {
                            const newTickets = [...form.tickets];
                            newTickets[index].price = e.target.value;
                            setForm(prev => ({ ...prev, tickets: newTickets }));
                          }}
                          className="w-full bg-transparent text-black dark:text-white font-semibold placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none border-b border-transparent focus:border-iris/50 transition-all"
                          placeholder="999"
                        />
                      </div>
                    </div>
                    {form.tickets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newTickets = form.tickets.filter((_, i) => i !== index);
                          setForm(prev => ({ ...prev, tickets: newTickets }));
                        }}
                        className="text-black/40 dark:text-white/40 hover:text-red-500 transition-colors p-2"
                      >
                        <IconTrash />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => {
                setForm(prev => ({
                  ...prev,
                  tickets: [
                    ...prev.tickets,
                    { id: Date.now().toString(), name: "", price: "", quantity: 150 }
                  ]
                }));
              }}
              className="w-full rounded-xl border-2 border-dashed border-black/20 dark:border-white/20 py-4 text-sm font-medium text-black/60 dark:text-white/60 hover:border-iris/50 hover:text-iris-glow transition-all duration-300 mt-4"
            >
              <span className="flex items-center justify-center gap-2">
                <IconPlus />
                Add Another Ticket Tier
              </span>
            </motion.button>
          </GlassSection>

          {/* Guestlist with avatars */}
          <GlassSection icon={<IconUsers />} title="Guestlist" badge="Social">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex -space-x-3">
                {guestNames.slice(0, 6).map((guest, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ scale: 1.2, zIndex: 10 }}
                    className="h-11 w-11 rounded-full border-2 border-black bg-gradient-to-br from-iris via-gold to-iris-glow flex items-center justify-center text-xs font-bold text-white shadow-lg cursor-pointer"
                  >
                    {guest.substring(0, 2).toUpperCase()}
                  </motion.div>
                ))}
              </div>
              <div className="text-sm">
                <div className="text-black dark:text-white font-medium">{guestNames[0]}</div>
                <div className="text-black/60 dark:text-white/60">and {guestNames.length - 1} others going</div>
              </div>
            </div>
            <input
              type="text"
              value={form.guests}
              onChange={handleChange("guests")}
              placeholder="Add guests (comma separated)"
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/30 px-4 py-3 text-sm text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:border-iris/50 focus:outline-none focus:ring-2 focus:ring-iris/20 transition-all"
            />
          </GlassSection>

          {/* Event Features */}
          <GlassSection icon={<IconStar />} title="Event Features" badge="Optional">
            <div className="space-y-4">
              <FeatureToggle
                icon={<IconVideo />}
                label="YouTube Teaser"
                description="Embed a hype video"
                value={youtubeEnabled}
                onChange={setYoutubeEnabled}
              />
              {youtubeEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pl-8"
                >
                  <input
                    type="url"
                    value={form.youtube}
                    onChange={handleChange("youtube")}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full rounded-xl border border-iris/30 bg-black/5 dark:bg-black/30 px-4 py-2.5 text-sm text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:border-iris/50 focus:outline-none focus:ring-2 focus:ring-iris/20 transition-all"
                  />
                  <p className="mt-2 text-xs text-black/50 dark:text-white/50">Paste a YouTube URL to embed on your event page</p>
                </motion.div>
              )}

              <FeatureToggle
                icon={<IconImage />}
                label="Image Gallery"
                description="Showcase past events"
                value={galleryEnabled}
                onChange={setGalleryEnabled}
              />
              {galleryEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pl-8"
                >
                  <button
                    type="button"
                    onClick={handleGalleryUploadClick}
                    disabled={uploadingGallery}
                    className="w-full rounded-xl border-2 border-dashed border-iris/30 bg-iris/5 px-4 py-6 text-sm font-medium text-black/80 dark:text-white/80 hover:border-iris/50 hover:bg-iris/10 transition-all disabled:opacity-50"
                  >
                    {uploadingGallery ? "Uploading..." : galleryImages.length > 0 ? `${galleryImages.length} images uploaded` : "Click to upload images (max 6)"}
                  </button>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleGalleryFileChange}
                    className="hidden"
                  />
                  {galleryImages.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {galleryImages.slice(0, 6).map((url, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
                          <Image src={url} alt={`Gallery ${i + 1}`} fill className="object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-black/50 dark:text-white/50">Upload up to 6 images to showcase</p>
                </motion.div>
              )}
            </div>
          </GlassSection>

          {/* Page Settings */}
          <GlassSection icon={<IconSettings />} title="Page Settings">
            <div className="space-y-4">
              <Toggle label="Show on Explore Page" value={showExplore} onChange={setShowExplore} />
              <Toggle label="Guestlist Visibility" value={showGuestlist} onChange={setShowGuestlist} />
              <p className="text-[10px] text-black/40 dark:text-white/40 uppercase tracking-widest pl-1">
                {showGuestlist
                  ? "Confirmed attendees will be visible on your event page."
                  : "Only individual interest list will be shown."}
              </p>

              <Toggle label="Password Protected" value={password} onChange={setPassword} />
              {password && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pl-8"
                >
                  <input
                    type="text"
                    value={form.eventPassword}
                    onChange={handleChange("eventPassword")}
                    placeholder="Enter event password"
                    className="w-full rounded-xl border border-iris/30 bg-black/5 dark:bg-black/30 px-4 py-2.5 text-sm text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:border-iris/50 focus:outline-none focus:ring-2 focus:ring-iris/20 transition-all"
                  />
                </motion.div>
              )}
            </div>
          </GlassSection>

          {/* Flyer Upload (Relocated for better wizard flow) */}
          <GlassSection icon={<IconImage />} title="Event Poster" badge="Hero Image">
            <div
              className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 cursor-pointer group"
              onClick={handleFlyerUploadClick}
            >
              {form.image && (
                <Image src={form.image} alt="Flyer" fill className="object-cover" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-bold uppercase tracking-widest">
                  {uploadingFlyer ? "Uploading..." : "Change Image"}
                </span>
              </div>
              <input ref={flyerInputRef} type="file" accept="image/*" onChange={handleFlyerFileChange} className="hidden" />
            </div>
          </GlassSection>
        </motion.div>

        {/* Right Column - Full Event Page Preview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="hidden xl:block relative"
        >
          <div className="sticky top-28 h-[calc(100vh-140px)] overflow-hidden rounded-[32px] border border-black/10 dark:border-white/10 bg-black shadow-floating flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-2">Live Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white/60">
                  Draft Mode
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar-hidden bg-black scale-[0.85] origin-top translate-y-2">
              <div className="mx-auto w-[1140px] shadow-2xl overflow-hidden pointer-events-none rounded-[40px]">
                <EventPage
                  event={{
                    ...form,
                    id: "preview-id",
                    settings: {
                      showGuestlist
                    }
                  }}
                  host={{
                    name: "Studio Host",
                    avatar: "/events/holi-edit.svg",
                    followers: 1240,
                    location: "Studio Mode",
                    bio: "Preview of how your host profile appears to users."
                  }}
                  isPreview={true}
                />
              </div>
            </div>

            <div className="p-4 bg-zinc-900/80 border-t border-white/5 text-center">
              <p className="text-[10px] font-medium text-white/40 uppercase tracking-[0.2em]">
                Scaling preview to fit workspace • Proportions preserved
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Status Messages */}
      <AnimatePresence>
        {status.message && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`rounded-xl border px-4 py-3 text-sm backdrop-blur-xl ${status.type === "error"
              ? "border-red-500/30 text-red-300 bg-red-500/10"
              : "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
              }`}
          >
            {status.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Preview Modal */}
      <AnimatePresence>
        {mobilePreviewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-900 shadow-xl">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Event Preview</span>
                <button
                  type="button"
                  onClick={() => setMobilePreviewOpen(false)}
                  className="rounded-full bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/20"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <EventPage
                  event={{
                    ...form,
                    id: "preview-id",
                    settings: {
                      showGuestlist
                    }
                  }}
                  host={{
                    name: "Studio Host",
                    avatar: "/events/holi-edit.svg",
                    followers: 1240,
                    location: "Studio Mode",
                    bio: "Preview of how your host profile appears to users."
                  }}
                  isPreview={true}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

// Helper Components with enhanced styling

function GlassSection({ icon, title, badge, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -2 }}
      className="glass-panel rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 backdrop-blur-xl p-6 shadow-glow space-y-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-black dark:text-white">
          <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.5 }}>
            {icon}
          </motion.div>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {badge && (
          <span className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40 font-medium">
            {badge}
          </span>
        )}
      </div>
      {children}
    </motion.div>
  );
}

function DateTimeInput({ label, dateValue, timeValue, onDateChange, onTimeChange, required }) {
  return (
    <div>
      <label className="block text-xs text-black/50 dark:text-white/50 mb-2 uppercase tracking-wider">{label}</label>
      <div className="flex gap-2">
        <input
          type="date"
          value={dateValue}
          onChange={onDateChange}
          required={required}
          className="flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black/40 px-3 py-2.5 text-sm text-black dark:text-white focus:border-iris/50 focus:outline-none focus:ring-2 focus:ring-iris/20 transition-all"
        />
        <input
          type="time"
          value={timeValue}
          onChange={onTimeChange}
          className="w-28 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black/40 px-3 py-2.5 text-sm text-black dark:text-white focus:border-iris/50 focus:outline-none focus:ring-2 focus:ring-iris/20 transition-all"
        />
      </div>
    </div>
  );
}

function FloatingInput({ icon, placeholder, value, onChange, multiline, required }) {
  const Component = multiline ? "textarea" : "input";
  return (
    <motion.div
      whileHover={{ x: 2 }}
      className="flex items-start gap-3 group"
    >
      <div className="text-black/60 dark:text-white/60 mt-1 group-hover:text-iris-glow transition-colors">{icon}</div>
      <Component
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        rows={multiline ? 3 : undefined}
        className="flex-1 bg-transparent text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none resize-none border-b border-black/10 dark:border-white/10 pb-2 focus:border-iris/50 transition-all"
      />
    </motion.div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <motion.div
      whileHover={{ x: 2 }}
      className="flex items-center justify-between group"
    >
      <span className="text-sm text-black dark:text-white group-hover:text-iris-glow transition-colors">{label}</span>
      <ToggleSwitch value={value} onChange={onChange} />
    </motion.div>
  );
}

function ToggleSwitch({ value, onChange }) {
  return (
    <motion.button
      type="button"
      onClick={() => onChange(!value)}
      whileTap={{ scale: 0.95 }}
      className={`relative h-6 w-11 rounded-full transition-all duration-300 ${value ? "bg-gradient-to-r from-iris to-iris-glow shadow-glow" : "bg-black/20 dark:bg-white/20"
        }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${value ? "right-0.5 bg-white" : "left-0.5 bg-white/80"
          }`}
      />
    </motion.button>
  );
}

function FeatureToggle({ icon, label, description, value, onChange }) {
  return (
    <motion.div
      whileHover={{ scale: 1.01, x: 4 }}
      className="flex items-center justify-between p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
      onClick={() => onChange(!value)}
    >
      <div className="flex items-center gap-3">
        <div className="text-iris-glow">{icon}</div>
        <div>
          <div className="text-sm text-black dark:text-white font-medium">{label}</div>
          <div className="text-xs text-black/50 dark:text-white/50">{description}</div>
        </div>
      </div>
      <ToggleSwitch value={value} onChange={onChange} />
    </motion.div>
  );
}

// Icons remain the same as before...
function IconSparkles() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function IconAlignLeft() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function IconTicket() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconMusic() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function IconLoader() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function IconNavigation() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}
