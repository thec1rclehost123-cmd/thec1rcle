"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
    Heart, ChevronLeft, CheckCircle2, Phone, MapPin,
    MessageCircle, Share2, Navigation, Camera, Edit3,
    Save, Plus, X, Loader2, Calendar, Music, Shirt,
    ShieldCheck, DollarSign, Users, Mail, Globe, Instagram,
    Zap, Sparkles, Clock, Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EventCard } from "@c1rcle/ui";
import { useToast } from "@/components/ui/Toast";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenueActionButton } from "@/components/venue-layout/VenuePageShell";

interface EnhancedVenueEditorProps {
    venueId: string;
    venue: any;
    upcomingEvents: any[];
    pastEvents: any[];
    highlights: any[];
    gallery: any[];
    onUpdate: (updates: any) => Promise<void>;
    error?: string | null;
}

export default function EnhancedVenueEditor({
    venueId,
    venue,
    upcomingEvents = [],
    pastEvents = [],
    highlights = [],
    gallery = [],
    onUpdate,
    error = null
}: EnhancedVenueEditorProps) {
    const { user } = useDashboardAuth();
    const { success: toastSuccess, error: toastError } = useToast();
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [localVenue, setLocalVenue] = useState(venue);
    const [localGallery, setLocalGallery] = useState(gallery);

    useEffect(() => {
        setLocalVenue(venue);
    }, [venue]);

    useEffect(() => {
        setLocalGallery(gallery);
    }, [gallery]);

    // Helper to get auth token for authenticated API calls
    const getAuthToken = async (): Promise<string | null> => {
        if (!user) {
            console.log("[getAuthToken] No user available");
            return null;
        }
        try {
            // Force refresh the token to ensure it's valid
            const token = await user.getIdToken(true);
            console.log("[getAuthToken] Got token, length:", token?.length);
            return token;
        } catch (err) {
            console.error("[getAuthToken] Failed to get auth token:", err);
            return null;
        }
    };
    const handleSave = async (section: string, updates: any) => {
        setSaving(true);
        try {
            await onUpdate(updates);
            setIsEditing(null);
            toastSuccess("Update Successful", "Your changes have been saved to the live profile.");
        } catch (err) {
            console.error(`Error saving ${section}:`, err);
        } finally {
            setSaving(false);
        }
    };

    const coverImage = venue.coverURL || venue.coverImage || venue.bannerImage || venue.image || '/events/neon-nights.jpg';
    const logo = venue.photoURL || venue.logoImage || venue.logo;
    const category = venue.venueType || venue.category || venue.type || 'Venue';
    const isVerified = venue.verified || venue.isVerified;

    return (
        <div className="bg-surface-elevated dark:bg-[#0A0A0A] min-h-screen text-text-primary dark:text-text-primary pb-32">
            {/* Global Error Alerts */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-24 left-1/2 -translate-x-1/2 z-[110] w-full max-w-lg px-6"
                    >
                        <div className="bg-red-500 text-text-primary p-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold border border-white/20">
                            <ShieldCheck className="w-5 h-5" />
                            <div className="flex-1 text-sm">
                                <p className="uppercase text-[10px] opacity-70">Update Failed</p>
                                <p>{error}</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* 1. HERO SECTION - Venue Poster */}
            <section className="relative w-full group">
                <div className="relative aspect-[3/4] sm:aspect-[4/5] md:aspect-[16/10] lg:aspect-[21/9] w-full overflow-hidden">
                    <Image
                        src={coverImage}
                        fill
                        className="object-cover"
                        alt={venue.name}
                        sizes="100vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#0A0A0A] via-transparent to-transparent opacity-90" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />

                    {/* Edit Overlay for Cover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => setIsEditing('hero')}
                            className="bg-surface-elevated/20 backdrop-blur-md border border-white/30 px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-surface-elevated/30 transition-all font-bold text-text-primary shadow-xl"
                        >
                            <Camera className="w-5 h-5" />
                            Edit Hero & Visuals
                        </button>
                    </div>

                    {/* Bottom Content */}
                    <div className="absolute bottom-0 left-0 right-0 z-30 px-6 sm:px-12 pb-6 sm:pb-10">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
                            {/* Logo */}
                            <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-4 border-white dark:border-[#0A0A0A] shadow-2xl flex-shrink-0 bg-surface-elevated/10 backdrop-blur-xl">
                                {logo ? (
                                    <Image src={logo} fill className="object-cover" alt="logo" sizes="128px" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-text-primary/20"><Camera className="w-8 h-8" /></div>
                                )}
                            </div>

                            {/* Name & Category */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-3 py-1 bg-surface-elevated/10 dark:bg-black/20 backdrop-blur-xl border border-border-subtle dark:border-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-text-primary dark:text-text-primary/80">
                                        {category}
                                    </span>
                                    {isVerified && (
                                        <span className="flex items-center gap-1 px-2 py-1 bg-[#F44A22]/20 rounded-full">
                                            <CheckCircle2 className="h-3 w-3 text-[#F44A22]" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-[#F44A22]">Verified</span>
                                        </span>
                                    )}
                                </div>
                                <div
                                    onClick={() => setIsEditing('hero')}
                                    className="group/name cursor-pointer relative inline-block"
                                >
                                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold uppercase tracking-tighter text-text-primary leading-[0.9] drop-shadow-lg group-hover/name:opacity-80 transition-opacity">
                                        {venue.displayName || venue.name}
                                    </h1>
                                    <div className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover/name:opacity-100 transition-opacity">
                                        <Edit3 className="w-5 h-5 text-text-primary/50" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 2. QUICK ACTION BUTTONS (Nav Bar) */}
            <div className="relative group">
                <div className="flex items-center justify-center gap-3 py-10 overflow-x-auto no-scrollbar">
                    {[
                        { icon: Heart, label: 'Follow', color: 'text-[#F44A22]', bg: 'bg-[#F44A22]/10' },
                        { icon: Zap, label: 'Like', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
                        { icon: Share2, label: 'Share' },
                        { icon: MessageCircle, label: 'WhatsApp', color: 'text-[#25D366]', bg: 'bg-[#25D366]/10' },
                        { icon: Instagram, label: 'Instagram', color: 'text-pink-500', bg: 'bg-pink-500/10' },
                        { icon: Navigation, label: 'Map' }
                    ].map((action, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 min-w-[72px] opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${action.bg || 'bg-black/5 dark:bg-surface-elevated/5'}`}>
                                <action.icon className={`w-5 h-5 ${action.color || 'text-text-primary/60 dark:text-text-primary/60'}`} />
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-text-primary/50 dark:text-text-primary/50">{action.label}</span>
                        </div>
                    ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-surface-elevated/40 dark:bg-black/40 backdrop-blur-[2px]">
                    <button onClick={() => setIsEditing('contact')} className="bg-accent-primary text-text-primary px-6 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg">
                        <Edit3 className="w-4 h-4" /> Edit Links & Contact
                    </button>
                </div>
            </div>

            {/* 2.5 ABOUT SECTION */}
            <section className="px-6 sm:px-12 lg:px-24 py-12 group relative">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22]">About</span>
                        <button onClick={() => setIsEditing('hero')} className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg bg-surface-secondary">
                            <Edit3 className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-lg md:text-xl font-medium text-text-primary/70 dark:text-text-primary/70 leading-relaxed">
                        {venue.bio || venue.description || "Add a compelling description of your venue to attract more guests."}
                    </p>
                </div>
            </section>

            {/* 3. HIGHLIGHTS SECTION */}
            <section className="px-6 sm:px-12 lg:px-24 py-12 group relative border-t border-black/5 dark:border-white/5">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22] block mb-2">Moments</span>
                            <h2 className="text-3xl font-bold uppercase tracking-tighter text-text-primary dark:text-text-primary">Highlights</h2>
                        </div>
                        <button onClick={() => setIsEditing('highlights')} className="opacity-0 group-hover:opacity-100 transition-opacity bg-surface-secondary p-2 rounded-lg">
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
                        {highlights.length > 0 ? highlights.map((h, i) => (
                            <div key={h.id || i} className="flex-shrink-0 flex flex-col items-center gap-2">
                                <div className="relative w-20 h-20 rounded-full border-2 border-[#F44A22]/30 p-1 overflow-hidden">
                                    <Image src={h.coverImage || h.images?.[0]} fill className="rounded-full object-cover p-1" alt="" sizes="80px" />
                                </div>
                                <span className="text-[10px] font-bold uppercase text-text-primary/60 dark:text-text-primary/40">{h.title}</span>
                            </div>
                        )) : (
                            <div className="w-full py-12 border-2 border-dashed border-black/10 dark:border-border-subtle rounded-3xl flex flex-col items-center justify-center text-text-primary/30 dark:text-text-primary/30">
                                <Sparkles className="w-8 h-8 mb-2" />
                                <p className="text-sm font-bold uppercase tracking-widest text-center">Add venue highlights & stories</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* 4. UPCOMING EVENTS */}
            <section className="px-6 sm:px-12 lg:px-24 py-12 bg-black/[0.02] dark:bg-surface-elevated/[0.02]">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22] block mb-2">Live Now</span>
                            <h2 className="text-3xl md:text-5xl font-bold uppercase tracking-tighter text-text-primary dark:text-text-primary">Upcoming Events</h2>
                        </div>
                        <button className="px-6 py-2 bg-black dark:bg-surface-elevated text-text-primary dark:text-text-primary rounded-full text-xs font-bold uppercase tracking-widest">
                            Manager Events
                        </button>
                    </div>
                    {upcomingEvents.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {upcomingEvents.slice(0, 3).map((event, i) => (
                                <EventCard key={event.id || i} event={event} index={i} />
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 border-2 border-dashed border-black/10 dark:border-border-subtle rounded-3xl flex flex-col items-center justify-center">
                            <Calendar className="w-10 h-10 mb-4 text-text-primary/20 dark:text-text-primary/20" />
                            <h3 className="text-xl font-bold uppercase tracking-widest text-text-primary/40 dark:text-text-primary/40 mb-2">No Upcoming Events</h3>
                            <VenueActionButton variant="primary">
                                <Plus className="w-4 h-4 mr-2" />
                                Create Event
                            </VenueActionButton>
                        </div>
                    )}
                </div>
            </section>

            {/* 5. GALLERY (3x3 Grid) */}
            <section className="px-6 sm:px-12 lg:px-24 py-20 group relative">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-12">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22] block mb-2">The Vibe</span>
                            <h2 className="text-4xl font-bold uppercase tracking-tighter text-text-primary dark:text-text-primary">Gallery</h2>
                        </div>
                        <button onClick={() => setIsEditing('gallery')} className="opacity-0 group-hover:opacity-100 transition-opacity bg-accent-primary text-text-primary px-6 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" /> Manage Grid
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-4 aspect-square">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className="relative aspect-square rounded-2xl overflow-hidden bg-black/5 dark:bg-surface-elevated/5 border border-black/5 dark:border-white/5">
                                {gallery[i] ? (
                                    <Image src={gallery[i]?.imageUrl || gallery[i]} fill className="object-cover" alt="" sizes="(max-width: 768px) 33vw, 20vw" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center opacity-20"><Plus className="w-6 h-6" /></div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 6. TIMING & DETAILS */}
            <section className="px-6 sm:px-12 lg:px-24 py-20 bg-black/[0.02] dark:bg-surface-elevated/[0.02] group relative">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-12">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22] block mb-2">Information</span>
                            <h2 className="text-4xl font-bold uppercase tracking-tighter text-text-primary dark:text-text-primary">Know Before You Go</h2>
                        </div>
                        <button onClick={() => setIsEditing('details')} className="opacity-0 group-hover:opacity-100 transition-opacity bg-surface-secondary p-3 rounded-xl">
                            <Edit3 className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Map & Address */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="rounded-3xl overflow-hidden border border-black/10 dark:border-border-subtle h-[400px] bg-surface-secondary flex items-center justify-center">
                                <div className="text-center opacity-40">
                                    <MapPin className="w-12 h-12 mx-auto mb-3" />
                                    <p className="text-sm font-bold uppercase">Map Preview</p>
                                </div>
                            </div>
                            <div className="p-8 rounded-3xl bg-surface-elevated dark:bg-surface-elevated/5 border border-black/5 dark:border-white/5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#F44A22] mb-4">Location</p>
                                <p className="text-xl font-bold text-text-primary/80 dark:text-text-primary/80">{venue.address || "Add address"}</p>
                                <p className="text-sm text-text-primary/40 dark:text-text-primary/40 mt-1">{venue.city || "Add city"}</p>
                            </div>
                        </div>

                        {/* Timing Cards */}
                        <div className="space-y-4">
                            <div className="p-8 rounded-3xl bg-surface-elevated dark:bg-surface-elevated/5 border border-black/5 dark:border-white/5">
                                <div className="flex items-center gap-3 mb-6">
                                    <Clock className="w-5 h-5 text-[#F44A22]" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-text-primary/40 dark:text-text-primary/40">Timings</p>
                                </div>
                                <div className="space-y-3">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                        <div key={day} className="flex justify-between items-center text-xs font-bold uppercase">
                                            <span className="text-text-primary/30 dark:text-text-primary/30">{day}</span>
                                            <span className="text-text-primary/80 dark:text-text-primary/80">
                                                {venue.operatingHours?.[day] || venue.timings?.[day] || '7:00 PM - 3:00 AM'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-8 rounded-3xl bg-gradient-to-br from-[#F44A22] to-[#CC3311] text-text-primary">
                                <p className="text-[10px] font-black uppercase tracking-widest text-text-primary/60 mb-6">Contact & Socials</p>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4"><Phone className="w-5 h-5" /><span className="text-sm font-bold">{venue.phone || "Add phone"}</span></div>
                                    <div className="flex items-center gap-4"><Instagram className="w-5 h-5" /><span className="text-sm font-bold">@{venue.socialLinks?.instagram || "add_insta"}</span></div>
                                    <div className="flex items-center gap-4"><Globe className="w-5 h-5" /><span className="text-sm font-bold">{venue.website || "yourwebsite.com"}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 7. PAST EVENTS */}
            {pastEvents.length > 0 && (
                <section className="px-6 sm:px-12 lg:px-24 py-20">
                    <div className="max-w-7xl mx-auto">
                        <div className="mb-12">
                            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22] block mb-2">History</span>
                            <h2 className="text-4xl font-bold uppercase tracking-tighter text-text-primary dark:text-text-primary">Past Craze</h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {pastEvents.slice(0, 5).map((e, i) => (
                                <div key={i} className="relative aspect-[3/4] rounded-2xl overflow-hidden grayscale hover:grayscale-0 transition-all cursor-pointer border border-black/10 dark:border-border-subtle">
                                    <Image src={e.image || e.coverURL} fill className="object-cover" alt="" sizes="(max-width: 768px) 50vw, 20vw" />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* MODAL EDITORS */}
            <AnimatePresence>
                {isEditing === 'hero' && (
                    <EditModal title="Visual Identity" onClose={() => setIsEditing(null)} onSave={() => handleSave('hero', localVenue)}>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Venue Name</label>
                                <input
                                    value={localVenue.displayName || localVenue.name}
                                    onChange={(e) => setLocalVenue({
                                        ...localVenue,
                                        name: e.target.value,
                                        displayName: e.target.value
                                    })}
                                    className="w-full bg-surface-secondary border border-border-subtle p-4 rounded-2xl text-lg font-bold outline-none ring-offset-0 focus:ring-2 focus:ring-[#F44A22]/50 transition-all"
                                    placeholder="Enter club name"
                                />
                                <p className="text-[10px] text-text-tertiary uppercase font-bold mt-2 ml-1">Changes are synced across all your club's public profiles.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Category</label>
                                    <input
                                        value={localVenue.venueType || localVenue.category}
                                        onChange={(e) => setLocalVenue({ ...localVenue, venueType: e.target.value })}
                                        className="w-full bg-surface-secondary border border-border-subtle p-4 rounded-xl text-sm font-bold outline-none"
                                    />
                                </div>
                                <div className="space-y-2 flex flex-col items-center">
                                    <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-2">Verified</label>
                                    <div className="flex-1 flex items-center">
                                        <input type="checkbox" checked={localVenue.verified} onChange={(e) => setLocalVenue({ ...localVenue, verified: e.target.checked })} className="w-6 h-6 rounded-lg accent-[#F44A22]" />
                                    </div>
                                </div>
                            </div>
                            <ImageUploadField label="Cover Image" value={coverImage} type="banner" venueId={venueId} getAuthToken={getAuthToken} onUpdate={(url) => setLocalVenue({ ...localVenue, coverURL: url, bannerImage: url, coverImage: url, image: url })} onError={(msg) => toastError("Upload Failed", msg)} />
                            <ImageUploadField label="Logo Image" value={logo} type="logo" venueId={venueId} getAuthToken={getAuthToken} onUpdate={(url) => setLocalVenue({ ...localVenue, photoURL: url, logoImage: url, logo: url })} onError={(msg) => toastError("Upload Failed", msg)} />
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary ml-1">Business Bio / About</label>
                                <textarea
                                    value={localVenue.bio || localVenue.description || ""}
                                    onChange={(e) => setLocalVenue({ ...localVenue, bio: e.target.value })}
                                    className="w-full bg-surface-secondary border border-border-default p-4 rounded-2xl text-sm font-medium text-text-primary outline-none focus:border-accent-primary transition-colors resize-none"
                                    rows={4}
                                    placeholder="Tell your guests what makes your venue unique..."
                                />
                            </div>
                        </div>
                    </EditModal>
                )}

                {isEditing === 'highlights' && (
                    <EditModal title="Manage Highlights" onClose={() => setIsEditing(null)} onSave={() => handleSave('highlights', highlights)}>
                        <div className="space-y-6">
                            <p className="text-xs text-text-tertiary uppercase font-bold tracking-widest">Your Story Sets</p>
                            <div className="space-y-3">
                                {highlights.map((h, i) => (
                                    <div key={h.id || i} className="flex items-center gap-4 p-4 bg-surface-secondary border border-border-subtle rounded-2xl">
                                        <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 border border-border-default">
                                            <Image src={h.coverImage || h.images?.[0]} fill className="object-cover" alt="" sizes="48px" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-sm tracking-tight text-text-primary">{h.title}</p>
                                            <p className="text-[10px] text-text-tertiary uppercase font-black">{h.images?.length || 0} Images</p>
                                        </div>
                                        <button className="p-2 hover:bg-surface-tertiary rounded-lg text-red-500"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                                <button className="w-full py-4 border-2 border-dashed border-border-default rounded-2xl flex items-center justify-center gap-2 hover:bg-surface-secondary transition-all text-xs font-bold uppercase tracking-widest text-text-tertiary">
                                    <Plus className="w-4 h-4" /> Create New Highlight
                                </button>
                            </div>
                        </div>
                    </EditModal>
                )}

                {isEditing === 'contact' && (
                    <EditModal title="Connect info" onClose={() => setIsEditing(null)} onSave={() => handleSave('contact', localVenue)}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Phone" icon={Phone} value={localVenue.phone} onChange={(v) => setLocalVenue({ ...localVenue, phone: v })} />
                            <InputField label="WhatsApp" icon={MessageCircle} value={localVenue.whatsapp} onChange={(v) => setLocalVenue({ ...localVenue, whatsapp: v })} />
                            <InputField label="City" icon={MapPin} value={localVenue.city} onChange={(v) => setLocalVenue({ ...localVenue, city: v })} />
                            <InputField label="Instagram" icon={Instagram} value={localVenue.socialLinks?.instagram} onChange={(v) => setLocalVenue({ ...localVenue, socialLinks: { ...localVenue.socialLinks, instagram: v } })} />
                            <div className="md:col-span-2">
                                <InputField label="Full Address" icon={MapPin} value={localVenue.address} onChange={(v) => setLocalVenue({ ...localVenue, address: v })} multiline />
                            </div>
                        </div>
                    </EditModal>
                )}

                {isEditing === 'gallery' && (
                    <EditModal title="Manage Gallery" onClose={() => setIsEditing(null)} onSave={() => handleSave('gallery', localVenue)}>
                        <GalleryEditor
                            venueId={venueId}
                            gallery={localGallery}
                            getAuthToken={getAuthToken}
                            onGalleryUpdate={setLocalGallery}
                            onError={(msg) => toastError("Gallery Error", msg)}
                            onSuccess={(msg) => toastSuccess("Success", msg)}
                        />
                    </EditModal>
                )}
            </AnimatePresence>

            {/* Sticky Floating Save Status */}
            {saving && (
                <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50">
                    <div className="bg-black dark:bg-surface-elevated text-text-primary dark:text-text-primary px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold border border-border-subtle">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving changes...
                    </div>
                </div>
            )}
        </div>
    );
}

function ImageIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
    )
}

function EditModal({ title, children, onClose, onSave }: { title: string, children: React.ReactNode, onClose: () => void, onSave: () => void }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-2xl bg-surface-base border border-border-default rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
                <div className="px-8 py-6 border-b border-border-subtle flex items-center justify-between">
                    <h3 className="text-xl font-bold uppercase tracking-tighter text-text-primary">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-surface-secondary rounded-xl text-text-tertiary hover:text-text-primary transition-colors"><X className="w-6 h-6" /></button>
                </div>
                <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {children}
                </div>
                <div className="p-8 border-t border-border-subtle bg-surface-secondary flex gap-3">
                    <button onClick={onClose} className="flex-1 py-4 px-6 rounded-2xl font-bold uppercase tracking-widest text-text-tertiary hover:bg-surface-elevated/5 transition-all">Cancel</button>
                    <button onClick={onSave} className="flex-1 py-4 px-6 rounded-2xl bg-accent-primary text-text-primary font-bold uppercase tracking-widest shadow-xl shadow-orange-500/20 hover:scale-[1.02] transition-all">Save Changes</button>
                </div>
            </motion.div>
        </div>
    );
}

function InputField({ label, icon: Icon, value, onChange, multiline }: { label: string, icon: any, value: string, onChange: (v: string) => void, multiline?: boolean }) {
    return (
        <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary ml-1">{label}</label>
            <div className="relative">
                <div className="absolute left-4 top-4 text-text-tertiary"><Icon className="w-5 h-5" /></div>
                {multiline ? (
                    <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full bg-surface-secondary border border-border-default p-4 pl-12 rounded-2xl text-sm font-bold text-text-primary outline-none focus:border-accent-primary transition-colors resize-none"
                        rows={3}
                    />
                ) : (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full bg-surface-secondary border border-border-default p-4 pl-12 rounded-2xl text-sm font-bold text-text-primary outline-none focus:border-accent-primary transition-colors"
                    />
                )}
            </div>
        </div>
    );
}

function ImageUploadField({
    label,
    value,
    type,
    venueId,
    getAuthToken,
    onUpdate,
    onError
}: {
    label: string,
    value: string,
    type: string,
    venueId: string,
    getAuthToken: () => Promise<string | null>,
    onUpdate: (url: string) => void,
    onError?: (msg: string) => void
}) {
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (file: File) => {
        setUploading(true);
        try {
            const token = await getAuthToken();
            if (!token) {
                onError?.("Authentication required. Please log in again.");
                return;
            }

            const formData = new FormData();
            formData.append("file", file);
            formData.append("venueId", venueId);
            formData.append("type", type);

            const res = await fetch("/api/venue/upload", {
                method: "POST",
                body: formData,
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Upload failed");
            }

            if (data.url) {
                onUpdate(data.url);
            }
        } catch (err: any) {
            console.error("Image upload error:", err);
            onError?.(err.message || "Failed to upload image");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary ml-1">{label}</label>
            <div
                onClick={() => inputRef.current?.click()}
                className="relative aspect-video w-full rounded-2xl overflow-hidden border border-dashed border-border-default group cursor-pointer bg-surface-secondary"
            >
                {value ? (
                    <Image src={value} fill className="object-cover group-hover:opacity-50 transition-opacity" alt="" sizes="(max-width: 768px) 100vw, 50vw" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-text-tertiary">
                        <Upload className="w-8 h-8 mb-2" />
                        <span className="text-xs font-bold uppercase">Click to upload</span>
                    </div>
                )}
                {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Loader2 className="w-8 h-8 animate-spin text-text-primary" />
                    </div>
                )}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity bg-black/30">
                    <Camera className="w-10 h-10 text-text-primary" />
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                />
            </div>
        </div>
    );
}

// Gallery Editor Component for the 3x3 grid
function GalleryEditor({
    venueId,
    gallery,
    getAuthToken,
    onGalleryUpdate,
    onError,
    onSuccess
}: {
    venueId: string;
    gallery: any[];
    getAuthToken: () => Promise<string | null>;
    onGalleryUpdate: (gallery: any[]) => void;
    onError?: (msg: string) => void;
    onSuccess?: (msg: string) => void;
}) {
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (file: File) => {
        if (gallery.length >= 9) {
            onError?.("Maximum 9 photos allowed in gallery");
            return;
        }

        setUploading(true);
        try {
            console.log("[GalleryEditor] Starting upload for venueId:", venueId);
            const token = await getAuthToken();
            console.log("[GalleryEditor] Got auth token:", token ? `length ${token.length}` : "NULL");

            if (!token) {
                onError?.("Authentication required. Please log in again.");
                return;
            }

            // First, upload the image to storage
            console.log("[GalleryEditor] Step 1: Uploading file to storage...");
            const formData = new FormData();
            formData.append("file", file);
            formData.append("venueId", venueId);
            formData.append("type", "gallery");

            const uploadRes = await fetch("/api/venue/upload", {
                method: "POST",
                body: formData,
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            console.log("[GalleryEditor] Upload response status:", uploadRes.status);
            const uploadData = await uploadRes.json();
            console.log("[GalleryEditor] Upload response data:", uploadData);

            if (!uploadRes.ok) {
                throw new Error(uploadData.error || "Upload failed");
            }

            console.log("[GalleryEditor] Step 2: Adding to gallery collection...");

            const galleryRes = await fetch("/api/venue/gallery", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    venueId,
                    action: "add",
                    data: { imageUrl: uploadData.url }
                })
            });

            console.log("[GalleryEditor] Gallery API response status:", galleryRes.status);
            const galleryData = await galleryRes.json();
            console.log("[GalleryEditor] Gallery API response data:", galleryData);

            if (!galleryRes.ok) {
                throw new Error(galleryData.error || "Failed to add to gallery");
            }

            // Update local state with new photo
            const newPhoto = galleryData.result || { id: Date.now().toString(), imageUrl: uploadData.url };
            console.log("[GalleryEditor] Success! New photo:", newPhoto);
            onGalleryUpdate([...gallery, newPhoto]);
            onSuccess?.("Photo added to gallery");

        } catch (err: any) {
            console.error("Gallery upload error:", err);
            onError?.(err.message || "Failed to upload photo");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (photoId: string) => {
        setDeletingId(photoId);
        try {
            const token = await getAuthToken();
            if (!token) {
                onError?.("Authentication required. Please log in again.");
                return;
            }

            const res = await fetch("/api/venue/gallery", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    venueId,
                    action: "remove",
                    data: { photoId }
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to remove photo");
            }

            // Update local state
            onGalleryUpdate(gallery.filter(p => p.id !== photoId));
            onSuccess?.("Photo removed from gallery");

        } catch (err: any) {
            console.error("Gallery delete error:", err);
            onError?.(err.message || "Failed to remove photo");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-xs text-text-tertiary uppercase font-bold tracking-widest">
                Gallery Photos ({gallery.length}/9)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {gallery.map((photo) => (
                    <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden border border-border-subtle group">
                        <img
                            src={photo.imageUrl || photo}
                            className="w-full h-full object-cover"
                            alt=""
                        />
                        <button
                            onClick={() => handleDelete(photo.id)}
                            disabled={deletingId === photo.id}
                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 p-1.5 rounded-lg text-text-primary transition-colors disabled:opacity-50"
                        >
                            {deletingId === photo.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                        </button>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    </div>
                ))}

                {/* Add Photo Button */}
                {gallery.length < 9 && (
                    <div
                        onClick={() => !uploading && inputRef.current?.click()}
                        className={`aspect-square rounded-xl border-2 border-dashed border-border-default flex flex-col items-center justify-center cursor-pointer hover:bg-surface-secondary transition-colors ${uploading ? 'pointer-events-none' : ''}`}
                    >
                        {uploading ? (
                            <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
                        ) : (
                            <>
                                <Plus className="w-6 h-6 mb-2 text-text-tertiary" />
                                <span className="text-[10px] font-bold uppercase text-text-tertiary">Add Photo</span>
                            </>
                        )}
                    </div>
                )}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
        </div>
    );
}

function Upload(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="12" />
        </svg>
    )
}
