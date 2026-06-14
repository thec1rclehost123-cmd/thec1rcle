"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Calendar, UtensilsCrossed, ChevronRight, Clock, Music, X, ZoomIn, ChevronLeft } from "lucide-react";

/**
 * VenueActionCards - Two side-by-side cards for Upcoming Events and Food Menu
 */
export default function VenueActionCards({
    venueId,
    upcomingEvents = [],
    menuImages = []
}) {
    const [showEventsList, setShowEventsList] = useState(false);
    const [showMenuViewer, setShowMenuViewer] = useState(false);
    const [currentMenuIndex, setCurrentMenuIndex] = useState(0);

    const hasEvents = upcomingEvents.length > 0;
    const hasMenu = menuImages.length > 0;

    // If neither exists, don't render the section
    if (!hasEvents && !hasMenu) return null;

    return (
        <>
            <section className="px-4 sm:px-6 md:px-12 lg:px-24 py-8">
                <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                    {/* CARD 1: Upcoming Events */}
                    {hasEvents && (
                        <button
                            onClick={() => setShowEventsList(true)}
                            className="group relative aspect-[4/5] rounded-3xl overflow-hidden border border-black/5 dark:border-white/5 hover:border-[#F44A22]/30 transition-all duration-500 shadow-lg hover:shadow-xl"
                        >
                            {/* Background Image */}
                            <Image
                                src={upcomingEvents[0]?.image || upcomingEvents[0]?.coverImage || '/events/neon-nights.jpg'}
                                fill
                                className="object-cover transition-transform duration-700 group-hover:scale-110"
                                alt="Upcoming Events"
                            />

                            {/* Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                            {/* Badge */}
                            <div className="absolute top-4 left-4">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F44A22] rounded-full">
                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-white">
                                        {upcomingEvents.length} Events
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="absolute bottom-0 left-0 right-0 p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xl flex items-center justify-center">
                                        <Calendar className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-black text-white uppercase tracking-tight">Upcoming</h3>
                                        <p className="text-[10px] text-white/60 font-bold">Events & Shows</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                </div>
                            </div>
                        </button>
                    )}

                    {/* CARD 2: Food Menu */}
                    {hasMenu && (
                        <button
                            onClick={() => setShowMenuViewer(true)}
                            className="group relative aspect-[4/5] rounded-3xl overflow-hidden border border-black/5 dark:border-white/5 hover:border-[#F44A22]/30 transition-all duration-500 shadow-lg hover:shadow-xl"
                        >
                            {/* Background Image */}
                            <Image
                                src={menuImages[0]}
                                fill
                                className="object-cover transition-transform duration-700 group-hover:scale-110"
                                alt="Food Menu"
                            />

                            {/* Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                            {/* Badge */}
                            <div className="absolute top-4 left-4">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-xl rounded-full border border-white/10">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-white">
                                        {menuImages.length} Page{menuImages.length > 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="absolute bottom-0 left-0 right-0 p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xl flex items-center justify-center">
                                        <UtensilsCrossed className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-black text-white uppercase tracking-tight">Food Menu</h3>
                                        <p className="text-[10px] text-white/60 font-bold">Drinks & More</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                </div>
                            </div>
                        </button>
                    )}

                    {/* Placeholder for single card layout */}
                    {!hasEvents && hasMenu && <div />}
                    {hasEvents && !hasMenu && <div />}
                </div>
            </section>

            {/* Events List Modal */}
            {showEventsList && (
                <div className="fixed inset-0 z-[90] bg-black/90 backdrop-blur-xl flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/10">
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">Upcoming Events</h2>
                            <p className="text-xs text-white/40 font-bold">{upcomingEvents.length} events scheduled</p>
                        </div>
                        <button
                            onClick={() => setShowEventsList(false)}
                            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                        >
                            <X className="h-5 w-5 text-white" />
                        </button>
                    </div>

                    {/* Events Grid */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                            {upcomingEvents.map((event) => (
                                <Link
                                    key={event.id}
                                    href={`/event/${event.id}`}
                                    onClick={() => setShowEventsList(false)}
                                    className="group relative aspect-[3/4] rounded-3xl overflow-hidden border border-white/10 hover:border-[#F44A22]/30 transition-all"
                                >
                                    <Image
                                        src={event.image || event.coverImage || '/events/neon-nights.jpg'}
                                        fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                                        alt={event.name}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                                    {/* Date Badge */}
                                    <div className="absolute top-4 left-4 flex flex-col items-center justify-center w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl">
                                        <span className="text-[9px] font-black text-white/60 uppercase">
                                            {new Date(event.startDate || event.startAt).toLocaleDateString(undefined, { month: 'short' })}
                                        </span>
                                        <span className="text-lg font-black text-white leading-none">
                                            {new Date(event.startDate || event.startAt).getDate()}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div className="absolute bottom-0 left-0 right-0 p-5 space-y-2">
                                        <div className="flex items-center gap-2 text-white/50">
                                            <Clock className="h-3 w-3" />
                                            <span className="text-[10px] font-bold">
                                                {new Date(event.startDate || event.startAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {event.artist && (
                                                <>
                                                    <span className="text-white/20">•</span>
                                                    <Music className="h-3 w-3" />
                                                    <span className="text-[10px] font-bold">{event.artist}</span>
                                                </>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight leading-tight group-hover:text-[#F44A22] transition-colors">
                                            {event.name}
                                        </h3>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Menu Viewer Modal - Fullscreen Image Viewer */}
            {showMenuViewer && (
                <div className="fixed inset-0 z-[90] bg-black flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-bold text-white">
                                Page {currentMenuIndex + 1} of {menuImages.length}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    // Zoom functionality - open in new tab
                                    window.open(menuImages[currentMenuIndex], '_blank');
                                }}
                                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                            >
                                <ZoomIn className="h-5 w-5 text-white" />
                            </button>
                            <button
                                onClick={() => setShowMenuViewer(false)}
                                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                            >
                                <X className="h-5 w-5 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Menu Image */}
                    <div className="flex-1 relative flex items-center justify-center p-4">
                        <Image
                            src={menuImages[currentMenuIndex]}
                            fill
                            className="object-contain"
                            alt={`Menu page ${currentMenuIndex + 1}`}
                        />

                        {/* Navigation */}
                        {menuImages.length > 1 && (
                            <>
                                <button
                                    onClick={() => setCurrentMenuIndex(prev => Math.max(0, prev - 1))}
                                    disabled={currentMenuIndex === 0}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="h-6 w-6 text-white" />
                                </button>
                                <button
                                    onClick={() => setCurrentMenuIndex(prev => Math.min(menuImages.length - 1, prev + 1))}
                                    disabled={currentMenuIndex === menuImages.length - 1}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="h-6 w-6 text-white" />
                                </button>
                            </>
                        )}
                    </div>

                    {/* Thumbnails */}
                    {menuImages.length > 1 && (
                        <div className="flex items-center justify-center gap-2 p-4 border-t border-white/10 overflow-x-auto">
                            {menuImages.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentMenuIndex(idx)}
                                    className={`relative w-16 h-20 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${currentMenuIndex === idx ? 'border-[#F44A22]' : 'border-white/10 hover:border-white/30'
                                        }`}
                                >
                                    <Image
                                        src={img}
                                        fill
                                        className="object-cover"
                                        alt={`Menu page ${idx + 1}`}
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
