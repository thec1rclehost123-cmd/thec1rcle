"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import Image from "next/image";
import { getFirebaseStorage } from "../lib/firebase/client";

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
  venue: "",
  host: "",
  category: categories[0],
  image: "/events/holi-edit.svg",
  gradientStart: "#0b0b0b",
  gradientEnd: "#050505",
  guests: "",
  ticketName: "General Admission",
  ticketPrice: "999",
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
      setForm((prev) => ({ ...prev, image: url }));
      setStatus({ type: "success", message: "✨ Flyer uploaded successfully!" });
    } catch (error) {
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
          tickets: [{
            id: "default",
            name: form.ticketName,
            price: Number(form.ticketPrice),
            quantity: 150
          }],
          settings: {
            showExplore,
            password: password ? form.eventPassword : "",
            activity,
            recurring: form.recurring
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
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Unable to create event" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Floating Action Tabs */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-8 flex items-center justify-between"
      >
        <div className="inline-flex rounded-full bg-black/5 dark:bg-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10 p-1 shadow-glow-lg">
          <button
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

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-xs uppercase tracking-widest text-black/40 dark:text-white/40"
        >
          Draft auto-saved
        </motion.div>
      </motion.div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
        {/* Left Column - Form Fields */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {/* Event Name - Hero Input */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="group"
          >
            <input
              type="text"
              value={form.title}
              onChange={handleChange("title")}
              placeholder="My Event Name"
              className="w-full bg-transparent text-5xl font-bold text-black/40 dark:text-white/40 placeholder:text-black/20 dark:placeholder:text-white/20 focus:text-black dark:focus:text-white focus:outline-none transition-all duration-300 group-hover:text-black/60 dark:group-hover:text-white/60"
              required
            />
            <motion.div
              className="h-1 bg-gradient-to-r from-iris via-gold to-iris opacity-0 group-focus-within:opacity-100 transition-opacity mt-4"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
            />
          </motion.div>

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
              <FloatingInput
                icon={<IconMapPin />}
                placeholder="Location (e.g., Koregaon Park, Pune)"
                value={form.location}
                onChange={handleChange("location")}
                required
              />
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
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="group relative overflow-hidden rounded-xl border border-black/20 dark:border-white/20 bg-gradient-to-br from-black/10 to-black/5 dark:from-white/10 dark:to-white/5 p-4"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-iris/0 via-iris/5 to-iris/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-iris to-iris-dim flex items-center justify-center">
                    <IconTicket />
                  </div>
                  <div>
                    <div className="text-black dark:text-white font-semibold">{form.ticketName}</div>
                    <div className="text-sm text-black/60 dark:text-white/60">₹{form.ticketPrice}</div>
                  </div>
                </div>
                <button type="button" className="text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">
                  <IconEdit />
                </button>
              </div>
            </motion.div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              className="w-full rounded-xl border-2 border-dashed border-black/20 dark:border-white/20 py-4 text-sm font-medium text-black/60 dark:text-white/60 hover:border-iris/50 hover:text-iris-glow transition-all duration-300"
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
                  <p className="mt-2 text-xs text-black/50 dark:text-white/50">Guests will need this password to RSVP</p>
                </motion.div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-black dark:text-white">Enable Live Activity</span>
                  <span className="rounded-full bg-gradient-to-r from-iris to-gold px-2.5 py-0.5 text-[10px] font-bold text-white shadow-lg">
                    NEW
                  </span>
                </div>
                <ToggleSwitch value={activity} onChange={setActivity} />
              </div>
            </div>
          </GlassSection>
        </motion.div>

        {/* Right Column - Live Preview */}
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-6 lg:sticky lg:top-28 lg:self-start"
        >
          {/* Flyer Preview with magical glow */}
          <motion.div
            whileHover={{ y: -4 }}
            className="glass-panel rounded-3xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl p-6 shadow-floating"
          >
            <div
              className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-black/20 dark:border-white/20 bg-gradient-to-br from-iris/10 via-white dark:via-black to-gold/10 cursor-pointer group"
              onClick={handleFlyerUploadClick}
            >
              {form.image && (
                <Image
                  src={form.image}
                  alt="Event flyer"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  className="rounded-full bg-white px-8 py-3 text-sm font-bold text-black shadow-2xl"
                >
                  {uploadingFlyer ? (
                    <span className="flex items-center gap-2">
                      <IconLoader className="animate-spin" />
                      Uploading...
                    </span>
                  ) : (
                    "Upload Flyer"
                  )}
                </motion.button>
              </div>
              <input
                ref={flyerInputRef}
                type="file"
                accept="image/*"
                onChange={handleFlyerFileChange}
                className="hidden"
              />
            </div>
          </motion.div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => setSpotifyModalOpen(true)}
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 backdrop-blur-xl px-4 py-3.5 flex items-center gap-3 text-left hover:border-iris/30 hover:bg-black/10 dark:hover:bg-white/10 transition-all group"
            >
              <IconMusic className="text-iris-glow" />
              <div className="flex-1">
                <span className="text-sm text-black/80 dark:text-white/80 group-hover:text-black dark:group-hover:text-white block">
                  {form.spotifyTrack && form.spotifyTrack !== "none"
                    ? spotifyTracks.find(t => t.id === form.spotifyTrack)?.title || "Add Spotify Track"
                    : "Add Spotify Track"
                  }
                </span>
                {form.spotifyTrack && form.spotifyTrack !== "none" && (
                  <span className="text-xs text-black/50 dark:text-white/50">
                    {spotifyTracks.find(t => t.id === form.spotifyTrack)?.artist}
                  </span>
                )}
              </div>
              <IconChevronRight className="ml-auto text-black/40 dark:text-white/40" />
            </motion.button>

            {/* Spotify Modal */}
            <AnimatePresence>
              {spotifyModalOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                  onClick={() => setSpotifyModalOpen(false)}
                >
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.9 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-md rounded-2xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-black/95 backdrop-blur-xl p-6 shadow-glow-lg"
                  >
                    <h3 className="text-xl font-bold text-black dark:text-white mb-4">Select Track</h3>
                    <div className="space-y-2">
                      {spotifyTracks.map((track) => (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() => {
                            setForm(prev => ({ ...prev, spotifyTrack: track.id }));
                            setSpotifyModalOpen(false);
                          }}
                          className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${form.spotifyTrack === track.id
                            ? "border-iris bg-iris/20"
                            : "border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 hover:bg-black/5 dark:hover:bg-white/5"
                            }`}
                        >
                          <div className="text-sm font-medium text-black dark:text-white">{track.title}</div>
                          <div className="text-xs text-black/60 dark:text-white/60">{track.artist}</div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Accent Color Picker */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 backdrop-blur-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-black dark:text-white">Accent Color</span>
                <motion.div
                  className="h-6 w-6 rounded-lg border-2 border-black/30 dark:border-white/30"
                  style={{ backgroundColor: form.accentColor }}
                  whileHover={{ scale: 1.2, rotate: 180 }}
                  transition={{ type: "spring" }}
                />
              </div>
              <div className="flex gap-2">
                {accentPalette.map((color) => (
                  <motion.button
                    key={color}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, accentColor: color }))}
                    whileHover={{ scale: 1.2, y: -4 }}
                    whileTap={{ scale: 0.9 }}
                    className={`h-9 w-9 rounded-lg transition-all ${form.accentColor === color
                      ? "ring-2 ring-black dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-black scale-110"
                      : "hover:ring-2 hover:ring-black/30 dark:hover:ring-white/30"
                      }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </motion.div>
          </div>

          {/* Create Button with gradient */}
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={submitting}
            className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-r from-iris via-iris-glow to-gold p-[2px] shadow-glow-lg group"
          >
            <div className="relative rounded-2xl bg-gradient-to-r from-iris via-iris-glow to-gold px-6 py-4">
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative text-base font-bold text-white flex items-center justify-center gap-2">
                {submitting ? (
                  <>
                    <IconLoader className="animate-spin" />
                    Creating Magic...
                  </>
                ) : (
                  <>
                    <IconSparkles />
                    Create Event
                  </>
                )}
              </span>
            </div>
          </motion.button>

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
        </motion.div>
      </form>
    </div>
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
