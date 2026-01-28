"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Calendar, ChevronLeft, ChevronRight, Play, Users, Camera } from "lucide-react";

export default function VenuePastEvents({ events = [], venueName = "Venue" }) {
    const [scrollPosition, setScrollPosition] = useState(0);

    if (!events || events.length === 0) return null;

    const scroll = (direction) => {
        const container = document.getElementById("past-events-scroll");
        if (container) {
            const scrollAmount = direction === "left" ? -400 : 400;
            container.scrollBy({ left: scrollAmount, behavior: "smooth" });
        }
    };

    return (
        <section className="py-32 bg-gradient-to-b from-white dark:from-[#0A0A0A] via-black/[0.02] dark:via-white/[0.02] to-white dark:to-[#0A0A0A] relative overflow-hidden">
            {/* Background */}
            <div className="absolute top-0 left-0 w-full h-full opacity-50">
                <div className="absolute top-1/4 right-0 w-96 h-96 bg-[#F44A22]/5 rounded-full blur-[150px]" />
                <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[150px]" />
            </div>

            <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24 relative z-10">
                {/* Section Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22] mb-4 block">Archive</span>
                        <h2 className="text-5xl md:text-8xl font-heading font-black uppercase tracking-tighter leading-none text-black dark:text-white">
                            Past<br />
                            <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-black/40 dark:from-white/40 to-black/20 dark:to-white/20">Memories.</span>
                        </h2>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => scroll("left")}
                            className="w-14 h-14 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-all"
                        >
                            <ChevronLeft className="h-5 w-5 text-black/60 dark:text-white/60" />
                        </button>
                        <button
                            onClick={() => scroll("right")}
                            className="w-14 h-14 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-all"
                        >
                            <ChevronRight className="h-5 w-5 text-black/60 dark:text-white/60" />
                        </button>
                    </div>
                </div>

                {/* Horizontal Scroll Carousel */}
                <div
                    id="past-events-scroll"
                    className="flex gap-6 overflow-x-auto no-scrollbar pb-8 -mx-6 px-6 scroll-smooth"
                >
                    {events.map((event, idx) => (
                        <Link
                            key={event.id}
                            href={`/event/${event.id}`}
                            className="group flex-shrink-0 w-[320px] md:w-[400px] relative"
                        >
                            {/* Card */}
                            <div className="relative aspect-[3/4] rounded-[2.5rem] overflow-hidden border border-black/5 dark:border-white/5 shadow-xl">
                                <Image
                                    src={event.image || event.coverImage || "/events/neon-nights.jpg"}
                                    fill
                                    className="object-cover transition-transform duration-1000 group-hover:scale-110 grayscale group-hover:grayscale-0"
                                    alt={event.name}
                                />

                                {/* Overlays */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors duration-500" />

                                {/* Past Badge */}
                                <div className="absolute top-6 left-6">
                                    <div className="px-4 py-2 bg-white/10 backdrop-blur-xl rounded-full border border-white/10">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
                                            {new Date(event.startDate || event.startAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="absolute top-6 right-6 flex gap-2">
                                    {event.attendeeCount && (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-xl rounded-full border border-white/10">
                                            <Users className="h-3 w-3 text-white/60" />
                                            <span className="text-[10px] font-bold text-white/60">{event.attendeeCount}</span>
                                        </div>
                                    )}
                                    {event.mediaCount && (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-xl rounded-full border border-white/10">
                                            <Camera className="h-3 w-3 text-white/60" />
                                            <span className="text-[10px] font-bold text-white/60">{event.mediaCount}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="absolute bottom-8 left-8 right-8 space-y-4">
                                    <div className="flex items-center gap-2 text-white/40">
                                        <Calendar className="h-4 w-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                            {new Date(event.startDate || event.startAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                    <h3 className="text-2xl font-heading font-black text-white uppercase tracking-tighter leading-none group-hover:text-[#F44A22] transition-colors">
                                        {event.name}
                                    </h3>

                                    {/* View Memory CTA */}
                                    <div className="flex items-center gap-3 pt-4 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                                        <div className="w-10 h-10 rounded-full bg-[#F44A22] flex items-center justify-center">
                                            <Play className="h-4 w-4 text-white ml-0.5" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">View Memory</span>
                                    </div>
                                </div>
                            </div>

                            {/* Reflection Effect */}
                            <div className="absolute -bottom-8 left-4 right-4 h-16 bg-gradient-to-b from-black/10 dark:from-white/5 to-transparent rounded-b-3xl blur-sm opacity-50" />
                        </Link>
                    ))}

                    {/* See All Card */}
                    <div className="flex-shrink-0 w-[280px] aspect-[3/4] rounded-[2.5rem] border-2 border-dashed border-black/10 dark:border-white/10 flex flex-col items-center justify-center gap-6 cursor-pointer hover:border-[#F44A22]/50 transition-colors group">
                        <div className="w-20 h-20 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-[#F44A22]/10 transition-colors">
                            <ChevronRight className="h-8 w-8 text-black/30 dark:text-white/30 group-hover:text-[#F44A22] transition-colors" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-black uppercase tracking-[0.2em] text-black/40 dark:text-white/40 group-hover:text-[#F44A22] transition-colors">View All</p>
                            <p className="text-xs text-black/20 dark:text-white/20 font-medium mt-1">{events.length} Events</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
