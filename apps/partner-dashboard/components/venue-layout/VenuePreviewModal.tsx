"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    X,
    Monitor,
    Smartphone,
    Sun,
    Moon,
    ExternalLink,
    MapPin,
    Calendar,
    Users,
    Heart,
    Star,
    Music,
    Clock,
    Phone,
    Mail,
    Instagram,
    Globe,
    ChevronRight,
    CheckCircle2,
    Play
} from "lucide-react";

interface VenuePreviewModalProps {
    venue: any;
    onClose: () => void;
}

export default function VenuePreviewModal({ venue, onClose }: VenuePreviewModalProps) {
    const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
    const [theme, setTheme] = useState<"light" | "dark">("dark");

    const previewUrl = `${process.env.NEXT_PUBLIC_GUEST_PORTAL_URL || ""}/venue/${venue?.slug || venue?.id}`;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-6xl max-h-[90vh] bg-[#0D0D0F] rounded-3xl border border-white/10 overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div>
                        <h2 className="text-xl font-bold text-white">Page Preview</h2>
                        <p className="text-sm text-white/50">See how your venue page appears to guests</p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Device Toggle */}
                        <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
                            <button
                                onClick={() => setDevice("desktop")}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold transition-all ${device === "desktop"
                                    ? "bg-white text-black"
                                    : "text-white/60 hover:text-white"
                                    }`}
                            >
                                <Monitor className="w-4 h-4" />
                                Desktop
                            </button>
                            <button
                                onClick={() => setDevice("mobile")}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold transition-all ${device === "mobile"
                                    ? "bg-white text-black"
                                    : "text-white/60 hover:text-white"
                                    }`}
                            >
                                <Smartphone className="w-4 h-4" />
                                Mobile
                            </button>
                        </div>

                        {/* Theme Toggle */}
                        <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
                            <button
                                onClick={() => setTheme("light")}
                                className={`p-2 rounded-lg transition-all ${theme === "light"
                                    ? "bg-white text-black"
                                    : "text-white/60 hover:text-white"
                                    }`}
                            >
                                <Sun className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setTheme("dark")}
                                className={`p-2 rounded-lg transition-all ${theme === "dark"
                                    ? "bg-white text-black"
                                    : "text-white/60 hover:text-white"
                                    }`}
                            >
                                <Moon className="w-4 h-4" />
                            </button>
                        </div>

                        {/* View Live */}
                        <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-[11px] font-bold hover:bg-emerald-400 transition-all"
                        >
                            <ExternalLink className="w-4 h-4" />
                            View Live
                        </a>

                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl">
                            <X className="w-5 h-5 text-white/60" />
                        </button>
                    </div>
                </div>

                {/* Preview Container */}
                <div className="flex-1 overflow-auto p-8 flex justify-center">
                    <div
                        className={`transition-all duration-500 ${device === "mobile"
                            ? "w-[390px] h-[844px]"
                            : "w-full max-w-5xl h-[700px]"
                            } rounded-2xl overflow-hidden border-4 ${device === "mobile" ? "border-gray-800" : "border-gray-700"
                            } shadow-2xl`}
                    >
                        {/* Mock Preview Content */}
                        <div className={`w-full h-full overflow-y-auto ${theme === "dark" ? "bg-[#0A0A0A] text-white" : "bg-white text-black"}`}>
                            {/* Hero Section */}
                            <div className="relative h-80">
                                {venue?.coverURL ? (
                                    <img src={venue.coverURL} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-purple-900 to-slate-900" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                                {/* Hero Content */}
                                <div className="absolute bottom-6 left-6 right-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${theme === "dark" ? "bg-white/10 text-white/60" : "bg-black/10 text-black/60"
                                            }`}>
                                            {venue?.venueType || "Venue"}
                                        </span>
                                        {venue?.isVerified && (
                                            <span className="flex items-center gap-1 px-3 py-1 bg-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-400">
                                                <CheckCircle2 className="w-3 h-3" /> Verified
                                            </span>
                                        )}
                                    </div>
                                    <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
                                        {venue?.displayName || venue?.name || "Venue Name"}
                                    </h1>
                                    <p className="flex items-center gap-2 text-white/60 text-sm">
                                        <MapPin className="w-4 h-4" />
                                        {venue?.neighborhood || venue?.city || "Location"}
                                    </p>
                                </div>
                            </div>

                            {/* Stats Bar */}
                            <div className={`p-4 flex items-center justify-around border-b ${theme === "dark" ? "border-white/10 bg-white/[0.02]" : "border-black/10 bg-black/[0.02]"
                                }`}>
                                <div className="text-center">
                                    <p className="text-xl font-bold">{venue?.stats?.followersCount || "2.4K"}</p>
                                    <p className={`text-[10px] font-bold uppercase ${theme === "dark" ? "text-white/40" : "text-black/40"}`}>Followers</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-xl font-bold">{venue?.stats?.eventsCount || "42"}</p>
                                    <p className={`text-[10px] font-bold uppercase ${theme === "dark" ? "text-white/40" : "text-black/40"}`}>Events</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-xl font-bold">4.8</p>
                                    <p className={`text-[10px] font-bold uppercase ${theme === "dark" ? "text-white/40" : "text-black/40"}`}>Rating</p>
                                </div>
                            </div>

                            {/* CTA Buttons */}
                            <div className="p-4 flex gap-3">
                                <button className="flex-1 py-3 bg-[#F44A22] text-white rounded-xl text-[11px] font-bold uppercase tracking-wider">
                                    {venue?.primaryCta === "tickets" ? "Get Tickets" : "Reserve Table"}
                                </button>
                                <button className={`flex-1 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider border ${theme === "dark" ? "border-white/20 text-white" : "border-black/20 text-black"
                                    }`}>
                                    Follow
                                </button>
                            </div>

                            {/* About Section */}
                            <div className="p-6">
                                <h3 className={`text-sm font-black uppercase tracking-widest mb-3 ${theme === "dark" ? "text-white/60" : "text-black/60"}`}>About</h3>
                                <p className={`text-sm leading-relaxed ${theme === "dark" ? "text-white/70" : "text-black/70"}`}>
                                    {venue?.bio || "Your venue description will appear here. Add a compelling bio to attract guests."}
                                </p>

                                {/* Tags */}
                                {venue?.genres?.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {venue.genres.slice(0, 5).map((genre: string) => (
                                            <span key={genre} className={`px-3 py-1.5 rounded-full text-[10px] font-bold ${theme === "dark" ? "bg-white/10 text-white/60" : "bg-black/10 text-black/60"
                                                }`}>
                                                {genre}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Photo Grid Preview */}
                            {venue?.photos?.length > 0 && (
                                <div className="p-6 pt-0">
                                    <h3 className={`text-sm font-black uppercase tracking-widest mb-3 ${theme === "dark" ? "text-white/60" : "text-black/60"}`}>Gallery</h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        {venue.photos.slice(0, 6).map((photo: string, idx: number) => (
                                            <div key={idx} className="aspect-square rounded-xl overflow-hidden">
                                                <img src={photo} alt="" className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Contact Preview */}
                            <div className={`m-6 p-6 rounded-2xl ${theme === "dark" ? "bg-white/5" : "bg-black/5"}`}>
                                <h3 className={`text-sm font-black uppercase tracking-widest mb-4 ${theme === "dark" ? "text-white/60" : "text-black/60"}`}>Contact</h3>
                                <div className="space-y-3">
                                    {venue?.phone && (
                                        <div className="flex items-center gap-3">
                                            <Phone className="w-4 h-4 opacity-40" />
                                            <span className="text-sm">{venue.phone}</span>
                                        </div>
                                    )}
                                    {venue?.email && (
                                        <div className="flex items-center gap-3">
                                            <Mail className="w-4 h-4 opacity-40" />
                                            <span className="text-sm">{venue.email}</span>
                                        </div>
                                    )}
                                    {venue?.socialLinks?.instagram && (
                                        <div className="flex items-center gap-3">
                                            <Instagram className="w-4 h-4 opacity-40" />
                                            <span className="text-sm">@{venue.socialLinks.instagram.replace("@", "")}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
