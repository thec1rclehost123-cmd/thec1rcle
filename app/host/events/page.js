"use client";

import { CalendarDays, Plus, Search, MapPin, Clock, Ticket, MoreVertical, Loader2, ArrowUpRight } from "lucide-react";
import { StudioCard } from "../../../components/host/StudioComponents";
import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { getFirebaseDb } from "../../../lib/firebase/client";
import { useAuth } from "../../../components/providers/AuthProvider";
import Image from "next/image";
import { motion } from "framer-motion";

export default function EventsPage() {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const db = getFirebaseDb();
        const q = query(
            collection(db, "events"),
            where("host", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Client-side sort
            eventsData.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
            setEvents(eventsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching events:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric"
        });
    };

    return (
        <div className="max-w-[1800px] mx-auto space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-heading font-bold text-white mb-1">Events</h1>
                    <p className="text-[#888] text-sm font-medium">Manage your nightlife portfolio.</p>
                </div>
                <Link
                    href="/create"
                    className="px-6 py-3 bg-[#F44A22] text-white rounded-full font-bold uppercase tracking-widest text-xs hover:bg-[#D43A12] transition-all shadow-[0_0_20px_-5px_rgba(244,74,34,0.5)] hover:shadow-[0_0_25px_-5px_rgba(244,74,34,0.6)] hover:-translate-y-0.5 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Create Event
                </Link>
            </div>

            {loading ? (
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="w-8 h-8 text-[#F44A22] animate-spin" />
                </div>
            ) : events.length === 0 ? (
                <StudioCard className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-white/10 bg-transparent">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                        <CalendarDays className="w-8 h-8 text-white/20" />
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2">No Events Found</h3>
                    <p className="text-[#666] text-sm text-center max-w-xs mb-8">
                        Your portfolio is empty. Launch your first event to start tracking analytics.
                    </p>
                    <Link
                        href="/create"
                        className="px-8 py-3 bg-white text-black rounded-full text-xs font-bold uppercase tracking-wider hover:scale-105 transition-transform"
                    >
                        Launch Event
                    </Link>
                </StudioCard>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {events.map((event, i) => (
                        <motion.div
                            key={event.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                            className="group relative flex flex-col h-full"
                        >
                            <StudioCard noPadding className="h-full flex flex-col hover:border-white/20 transition-colors duration-500">
                                {/* Image Section */}
                                <div className="relative h-56 w-full overflow-hidden">
                                    {event.image ? (
                                        <Image
                                            src={event.image}
                                            alt={event.title}
                                            fill
                                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center bg-[#111] text-white/10">
                                            <CalendarDays className="w-12 h-12" />
                                        </div>
                                    )}

                                    {/* Gradient Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent opacity-90" />

                                    {/* Top Badges */}
                                    <div className="absolute top-4 right-4 z-20 flex gap-2">
                                        <span className="px-3 py-1 rounded-full bg-[#F44A22]/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider shadow-lg">
                                            Selling Fast
                                        </span>
                                        <button className="p-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Title Overlay */}
                                    <div className="absolute bottom-4 left-4 right-4">
                                        <h3 className="text-xl font-heading font-bold text-white leading-tight mb-1 line-clamp-2 group-hover:text-[#F44A22] transition-colors">
                                            {event.title}
                                        </h3>
                                        <div className="flex items-center gap-2 text-xs text-white/60">
                                            <MapPin className="w-3 h-3" />
                                            <span className="truncate">{event.location}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Stats Section */}
                                <div className="p-5 flex-1 flex flex-col justify-between bg-[#0A0A0A]">
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div>
                                            <p className="text-[10px] text-[#666] font-bold uppercase tracking-wider mb-1">Date</p>
                                            <p className="text-sm font-bold text-white flex items-center gap-2">
                                                <CalendarDays className="w-3.5 h-3.5 text-[#F44A22]" />
                                                {formatDate(event.startDate)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-[#666] font-bold uppercase tracking-wider mb-1">Time</p>
                                            <p className="text-sm font-bold text-white flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5 text-[#F44A22]" />
                                                {event.startTime}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="space-y-2 mb-6">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-[#888]">Ticket Sales</span>
                                            <span className="text-white font-bold">
                                                {Math.floor(Math.random() * 80)}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-[#F44A22] rounded-full"
                                                style={{ width: `${Math.floor(Math.random() * 80)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3 mt-auto">
                                        <Link
                                            href={`/events/${event.id}`}
                                            className="flex-1 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-xs font-bold text-white hover:bg-white/[0.08] hover:border-white/10 transition-all text-center flex items-center justify-center gap-2 group/btn"
                                        >
                                            View Page
                                            <ArrowUpRight className="w-3 h-3 opacity-50 group-hover/btn:opacity-100 transition-opacity" />
                                        </Link>
                                        <button className="w-full py-3 bg-white text-black rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#e5e5e5] transition-colors flex items-center justify-center gap-2 group/btn">
                                            Manage Event
                                            <ArrowUpRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform text-[#F44A22]" />
                                        </button>
                                    </div>
                                </div>
                            </StudioCard>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
