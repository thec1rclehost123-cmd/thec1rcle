"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../../components/providers/AuthProvider";
import { getUserEvents, fetchProfile } from "../actions";
import EditProfileModal from "../../../components/EditProfileModal";
import { useParams, useRouter } from "next/navigation";

// --- Visual Components ---

const AuroraBackground = () => (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--bg-color)]">
        <div className="absolute -top-[30%] left-0 h-[80vh] w-full bg-gradient-to-b from-orange/10 dark:from-iris/10 via-transparent to-transparent blur-[120px] opacity-60 transition-colors duration-500" />
        <div className="absolute top-[20%] right-[-20%] h-[600px] w-[600px] rounded-full bg-orange/5 dark:bg-gold/5 blur-[100px] opacity-40 mix-blend-multiply dark:mix-blend-screen animate-pulse" />
    </div>
);

const Badge = ({ label, type = "default" }) => {
    const styles = {
        default: "bg-black/[0.05] dark:bg-white/10 text-black/60 dark:text-white/60 border-black/5 dark:border-white/10",
        pro: "bg-orange/10 dark:bg-gold/10 text-orange dark:text-gold border-orange/20 dark:border-gold/20 shadow-sm dark:shadow-[0_0_15px_rgba(255,215,0,0.15)]",
        host: "bg-iris/10 dark:bg-iris/20 text-iris dark:text-iris-light border-iris/20 dark:border-iris/30 shadow-sm dark:shadow-[0_0_15px_rgba(93,95,239,0.2)]",
        admin: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/10 dark:border-red-500/20",
    };

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-widest backdrop-blur-md transition-shadow duration-300 ${styles[type] || styles.default}`}>
            {type === "pro" && <span className="h-1.5 w-1.5 rounded-full bg-orange dark:bg-gold animate-pulse" />}
            {type === "host" && <span className="h-1.5 w-1.5 rounded-full bg-iris dark:bg-iris-light" />}
            {label}
        </span>
    );
};

const MemberCard = ({ user, profile, displayName, initials, isOwner, onEdit, onLogout }) => (
    <div className="relative w-full overflow-hidden rounded-[32px] border border-black/5 dark:border-white/10 bg-white dark:bg-white/5 p-8 transition-all duration-500 shadow-sm dark:shadow-none md:p-10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange/20 dark:via-white/20 to-transparent" />

        {isOwner && (
            <button
                onClick={onLogout}
                className="absolute top-6 right-6 p-3 rounded-full text-black/40 dark:text-white/40 hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-all duration-300 group ring-1 ring-transparent hover:ring-red-500/20 z-20"
                title="Sign Out"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
            </button>
        )}

        <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-6">
                <div className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-black/10 dark:border-white/20 shadow-xl md:h-32 md:w-32">
                    {profile?.photoURL ? (
                        <Image src={profile.photoURL} alt={displayName} fill className="object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-black/[0.03] dark:bg-[#111]">
                            <span className="font-heading text-3xl font-black text-black/20 dark:text-white/30">{initials}</span>
                        </div>
                    )}
                    {isOwner && (
                        <button
                            onClick={onEdit}
                            className="absolute inset-0 flex items-center justify-center bg-black/60 dark:bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-sm"
                        >
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white">Edit</span>
                        </button>
                    )}
                </div>

                <div>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <Badge label="Member" />
                        <Badge label="Pro Pass" type="pro" />
                        {profile?.hostStatus === "approved" && <Badge label="Host" type="host" />}
                        {profile?.hostStatus === "pending" && isOwner && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/5 dark:bg-orange-500/10 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400 backdrop-blur-md">
                                Host Pending
                            </span>
                        )}
                    </div>
                    <h1 className="text-4xl font-black uppercase tracking-tight text-black dark:text-white md:text-6xl">
                        {displayName}
                    </h1>
                    {isOwner && <p className="font-mono text-xs text-black/40 dark:text-white/40">{profile?.email || ""}</p>}
                </div>
            </div>

            <div className="flex items-center gap-8 border-t border-black/5 dark:border-white/10 pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
                <div className="text-center md:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Joined</p>
                    <p className="mt-1 font-mono text-xl text-black dark:text-white" suppressHydrationWarning>
                        {new Date(profile?.createdAt || Date.now()).getFullYear()}
                    </p>
                </div>
                <div className="text-center md:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Status</p>
                    <p className="mt-1 font-mono text-xl text-emerald-600 dark:text-emerald-400">Active</p>
                </div>
            </div>
        </div>
    </div>
);

const EventCard = ({ event, isOwner }) => {
    const date = new Date(event.startAt);
    const dateString = date.toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Kolkata'
    });
    const timeString = date.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        timeZone: 'Asia/Kolkata'
    });

    const isUpcoming = new Date(event.startAt) > new Date();
    const eventLink = `/event/${event.eventId}`;
    const ticketsLink = `/tickets?eventId=${event.eventId}`;

    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="group relative flex flex-col overflow-hidden rounded-[24px] bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 transition-all shadow-sm hover:shadow-md hover:bg-gray-50 dark:hover:bg-white/[0.06]"
        >
            <Link href={eventLink} className="aspect-[4/5] relative overflow-hidden">
                {event.posterUrl ? (
                    <Image
                        src={event.posterUrl}
                        alt={event.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-black/5 dark:bg-white/5">
                        <span className="font-heading text-4xl font-black text-black/10 dark:text-white/10">
                            {event.title.split(' ').map(n => n[0]).join('')}
                        </span>
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                {/* Status Badge */}
                <div className="absolute left-4 top-4">
                    <span className={`rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-widest backdrop-blur-md border ${isUpcoming ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-black/10 dark:bg-white/10 text-white dark:text-white/60 border-white/10"
                        }`}>
                        {isUpcoming ? "Upcoming" : "Attended"}
                    </span>
                </div>
            </Link>

            <div className="flex flex-1 flex-col p-5">
                <div className="mb-4">
                    <Link href={eventLink}>
                        <h3 className="font-heading text-lg font-black uppercase leading-tight text-black dark:text-white line-clamp-1 hover:text-orange dark:hover:text-gold-light transition-colors">
                            {event.title}
                        </h3>
                    </Link>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">
                        {dateString} • {timeString}
                    </p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-black/20 dark:text-white/20">
                        {event.venueName}, {event.city}
                    </p>
                </div>

                <div className="mt-auto flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/5">
                    <div className="flex gap-2">
                        <span className="rounded-md bg-black/5 dark:bg-white/5 px-2 py-1 text-[8px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">
                            {event.participationType}
                        </span>
                    </div>
                    <Link
                        href={isOwner ? (event.participationType === "TICKET" ? ticketsLink : eventLink) : eventLink}
                        className="text-[9px] font-bold uppercase tracking-widest text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
                    >
                        {isOwner ? (
                            event.participationType === "TICKET" ? "View Ticket" :
                                event.participationType === "HOST" ? "Manage Event" :
                                    event.participationType === "RSVP" ? "View RSVP" : "View Event"
                        ) : "View Event"}
                    </Link>
                </div>
            </div>
        </motion.div>
    );
};

export default function PublicProfilePage() {
    const params = useParams();
    const router = useRouter();
    const { userId } = params;
    const { user: currentUser, profile: currentProfile, logout } = useAuth();

    const [profile, setProfile] = useState(null);
    const [events, setEvents] = useState({ upcoming: [], attended: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("upcoming");
    const [editModalOpen, setEditModalOpen] = useState(false);

    const isOwner = currentUser?.uid === userId;

    useEffect(() => {
        if (!userId || userId === "[userId]") return;

        const loadData = async () => {
            setLoading(true);
            try {
                // Fetch Profile
                if (isOwner && currentProfile) {
                    setProfile(currentProfile);
                } else {
                    const fetchedProfile = await fetchProfile(userId);
                    if (!fetchedProfile) {
                        // ...
                    } else {
                        setProfile(fetchedProfile);
                    }
                }

                // Fetch Events
                const fetchedEvents = await getUserEvents(userId, currentUser?.uid);
                setEvents(fetchedEvents);
            } catch (error) {
                console.error("Failed to load profile data", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [userId, currentUser?.uid]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--bg-color)]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 dark:border-white/20 border-t-orange dark:border-t-white" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="relative flex min-h-screen items-center justify-center bg-[var(--bg-color)]">
                <AuroraBackground />
                <div className="text-center">
                    <h1 className="text-4xl font-heading font-black uppercase text-black dark:text-white">Profile Not Found</h1>
                    <Link href="/explore" className="mt-8 inline-block rounded-full bg-black dark:bg-white px-8 py-4 text-xs font-bold uppercase tracking-widest text-white dark:text-black shadow-md">
                        Back to Explore
                    </Link>
                </div>
            </div>
        );
    }

    const displayName = profile.displayName || "Member";
    const initials = displayName.slice(0, 2).toUpperCase();

    return (
        <div className="bg-[var(--bg-color)] text-[var(--text-primary)] transition-colors duration-500 selection:bg-orange/30 flex-1 flex flex-col">
            <AuroraBackground />

            <div className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <MemberCard
                        user={currentUser}
                        profile={profile}
                        displayName={displayName}
                        initials={initials}
                        isOwner={isOwner}
                        onEdit={() => setEditModalOpen(true)}
                        onLogout={() => {
                            logout();
                            router.replace('/login');
                        }}
                    />
                </motion.div>

                {/* Events Section */}
                <div className="mt-20">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
                        <div className="space-y-4">
                            <h2 className="text-4xl md:text-8xl font-heading font-black uppercase tracking-tighter text-black dark:text-white">
                                Events
                            </h2>
                            <div className="flex gap-8">
                                <button
                                    onClick={() => setActiveTab("upcoming")}
                                    className={`text-[10px] font-bold uppercase tracking-[0.3em] transition-colors ${activeTab === "upcoming" ? "text-orange dark:text-gold" : "text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white"}`}
                                >
                                    Upcoming Engagement
                                </button>
                                {events.attended.length > 0 && (
                                    <button
                                        onClick={() => setActiveTab("attended")}
                                        className={`text-[10px] font-bold uppercase tracking-[0.3em] transition-colors ${activeTab === "attended" ? "text-orange dark:text-gold" : "text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white"}`}
                                    >
                                        Attended Events
                                    </button>
                                )}
                            </div>
                        </div>

                        <p className="text-black/20 dark:text-white/40 text-xs font-mono">
                            {events[activeTab]?.length || 0} total
                        </p>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            {events[activeTab]?.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                                    {events[activeTab].map((event) => (
                                        <EventCard key={event.eventId} event={event} isOwner={isOwner} />
                                    ))}
                                </div>
                            ) : (
                                <div className="py-24 text-center rounded-[40px] border border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.02]">
                                    <p className="text-black/30 dark:text-white/40 text-sm font-bold uppercase tracking-widest">
                                        No upcoming events yet.
                                    </p>
                                    <Link href="/explore" className="mt-8 inline-block text-[10px] font-bold uppercase tracking-widest transition-opacity text-orange dark:text-white/60 hover:opacity-100">
                                        Explore the C1rcle
                                    </Link>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            <EditProfileModal user={currentUser} profile={profile} open={editModalOpen} onClose={() => setEditModalOpen(false)} />
        </div>
    );
}
