"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../components/providers/AuthProvider";
import { fetchEventsByIds } from "../../lib/firebase/eventsClient";
import EditProfileModal from "../../components/EditProfileModal";
import EventGrid from "../../components/EventGrid";

// --- Visual Components ---

const AuroraBackground = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden bg-[#030303]">
    <div className="absolute -top-[30%] left-0 h-[80vh] w-full bg-gradient-to-b from-iris/20 via-purple-900/10 to-transparent blur-[120px] opacity-60" />
    <div className="absolute top-[20%] right-[-20%] h-[600px] w-[600px] rounded-full bg-gold/10 blur-[100px] opacity-40 mix-blend-screen animate-pulse" />
    <div className="absolute bottom-0 left-0 h-full w-full bg-[url('/noise.png')] opacity-[0.03]" />
  </div>
);

const Badge = ({ label, type = "default" }) => {
  const styles = {
    default: "bg-white/10 text-white/60 border-white/10",
    pro: "bg-gold/10 text-gold border-gold/20 shadow-[0_0_15px_rgba(255,215,0,0.15)]",
    host: "bg-iris/20 text-iris-light border-iris/30 shadow-[0_0_15px_rgba(93,95,239,0.2)]",
    admin: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-widest backdrop-blur-md ${styles[type] || styles.default}`}>
      {type === "pro" && <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />}
      {type === "host" && <span className="h-1.5 w-1.5 rounded-full bg-iris-light" />}
      {label}
    </span>
  );
};

const AchievementBadge = ({ icon, label, unlocked = false }) => (
  <div className={`group relative flex flex-col items-center gap-3 p-4 transition-all ${unlocked ? "opacity-100" : "opacity-30 grayscale"}`}>
    <div className={`relative flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-500 ${unlocked
      ? "border-white/20 bg-gradient-to-br from-white/10 to-transparent shadow-[0_0_30px_rgba(255,255,255,0.05)] group-hover:scale-110 group-hover:border-white/40"
      : "border-white/5 bg-white/5"
      }`}>
      <div className="text-2xl">{icon}</div>
      {unlocked && <div className="absolute inset-0 rounded-2xl bg-white/5 blur-xl" />}
    </div>
    <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">{label}</span>
  </div>
);

const MemberCard = ({ user, profile, displayName, initials, onEdit }) => (
  <div className="relative w-full overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-2xl md:p-10">
    {/* Card Shine Effect */}
    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-50" />

    <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-6">
        <div className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-white/20 shadow-2xl md:h-32 md:w-32">
          {profile?.photoURL ? (
            <Image src={profile.photoURL} alt={displayName} fill className="object-cover transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#111]">
              <span className="font-heading text-3xl font-black text-white/30">{initials}</span>
            </div>
          )}
          <button
            onClick={onEdit}
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-white">Edit</span>
          </button>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge label="Member" />
            {/* Example Badges - In real app, check profile.isPro or profile.isHost */}
            <Badge label="Pro Pass" type="pro" />
            {profile?.hostStatus === "approved" && <Badge label="Host" type="host" />}
            {profile?.hostStatus === "pending" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-orange-400 backdrop-blur-md">
                Host Pending
              </span>
            )}
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-white md:text-6xl">
            {displayName}
          </h1>
          <p className="font-mono text-xs text-white/40">{user.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-8 border-t border-white/10 pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
        <div className="text-center md:text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Joined</p>
          <p className="mt-1 font-mono text-xl text-white">
            {new Date(profile?.createdAt || Date.now()).getFullYear()}
          </p>
        </div>
        <div className="text-center md:text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Status</p>
          <p className="mt-1 font-mono text-xl text-emerald-400">Active</p>
        </div>
      </div>

      {/* Host Studio Action */}
      {profile?.hostStatus === "approved" && (
        <div className="mt-6 md:mt-0 md:ml-8 flex items-center">
          <Link
            href="/host"
            className="group flex items-center gap-2 rounded-full bg-white px-6 py-3 text-xs font-bold uppercase tracking-widest text-black transition-transform hover:scale-105"
          >
            <span>Enter Studio</span>
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  </div>
);

const TabSwitch = ({ active, onChange }) => (
  <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1 backdrop-blur-md">
    {["tickets", "rsvps"].map((tab) => (
      <button
        key={tab}
        onClick={() => onChange(tab)}
        className={`relative rounded-full px-8 py-3 text-xs font-bold uppercase tracking-widest transition-all ${active === tab ? "text-black" : "text-white/60 hover:text-white"
          }`}
      >
        {active === tab && (
          <motion.div
            layoutId="activePill"
            className="absolute inset-0 rounded-full bg-white"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        )}
        <span className="relative z-10">{tab === "tickets" ? "My Tickets" : "RSVPs"}</span>
      </button>
    ))}
  </div>
);

const EmptyState = ({ type }) => (
  <div className="relative overflow-hidden rounded-[32px] border border-white/5 bg-white/[0.02] px-6 py-24 text-center">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent opacity-50" />
    <div className="relative z-10 flex flex-col items-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 shadow-2xl backdrop-blur-sm">
        {type === "tickets" ? (
          <svg className="h-8 w-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
        ) : (
          <svg className="h-8 w-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </div>
      <h3 className="text-2xl font-heading font-black uppercase text-white">
        {type === "tickets" ? "No Tickets Found" : "No RSVPs Yet"}
      </h3>
      <p className="mt-2 max-w-xs text-sm text-white/40">
        {type === "tickets"
          ? "Your collection is empty. Time to change that."
          : "You haven't saved any events yet."}
      </p>
      <Link
        href="/explore"
        className="group mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-xs font-bold uppercase tracking-widest text-black transition-transform hover:scale-105"
      >
        <span>Explore Events</span>
        <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </Link>
    </div>
  </div>
);

const TicketItem = ({ order }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="group relative overflow-hidden rounded-[24px] bg-white text-black transition-transform hover:-translate-y-1"
  >
    <div className="flex h-full flex-col md:flex-row">
      {/* Left: Image */}
      <div className="relative h-48 w-full md:h-auto md:w-1/3">
        {order.eventImage ? (
          <Image src={order.eventImage} alt={order.eventTitle} fill className="object-cover" />
        ) : (
          <div className="h-full w-full bg-black" />
        )}
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black backdrop-blur-md">
          {order.status}
        </div>
      </div>

      {/* Right: Details */}
      <div className="flex flex-1 flex-col justify-between p-6">
        <div>
          <div className="flex items-start justify-between">
            <h3 className="font-heading text-2xl font-black uppercase leading-none">{order.eventTitle}</h3>
            <span className="font-mono text-lg font-bold">₹{order.totalAmount}</span>
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-black/60">
              {new Date(order.eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {order.eventTime}
            </p>
            <p className="text-xs font-bold uppercase tracking-wider text-black/60">{order.eventLocation}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-black/10 pt-4">
          <div className="flex gap-2">
            {order.tickets.map((t, i) => (
              <span key={i} className="rounded-md bg-black/5 px-2 py-1 text-[10px] font-bold uppercase text-black/60">
                {t.quantity}x {t.name}
              </span>
            ))}
          </div>
          <button className="text-[10px] font-bold uppercase tracking-widest underline decoration-2 underline-offset-4 opacity-60 hover:opacity-100">
            View Ticket
          </button>
        </div>
      </div>
    </div>
  </motion.div>
);

// --- Main Page ---

export default function ProfilePage() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("tickets");
  const [attendingEvents, setAttendingEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [fetchingRSVPs, setFetchingRSVPs] = useState(false);
  const [fetchingOrders, setFetchingOrders] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Fetch RSVPs
  useEffect(() => {
    if (!profile?.uid || !profile?.attendedEvents?.length) {
      setAttendingEvents([]);
      return;
    }

    const loadRSVPs = async () => {
      setFetchingRSVPs(true);
      try {
        const events = await fetchEventsByIds(profile.attendedEvents);
        setAttendingEvents(events);
      } catch (error) {
        console.error("Failed to fetch RSVPs", error);
      } finally {
        setFetchingRSVPs(false);
      }
    };

    loadRSVPs();
  }, [profile?.uid, profile?.attendedEvents]);

  // Fetch Orders
  useEffect(() => {
    if (!user?.uid) return;

    const loadOrders = async () => {
      setFetchingOrders(true);
      try {
        const res = await fetch(`/api/orders?userId=${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          setOrders(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Failed to fetch orders", error);
      } finally {
        setFetchingOrders(false);
      }
    };

    loadOrders();
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030303]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030303] px-4">
        <AuroraBackground />
        <div className="relative z-10 max-w-md text-center">
          <h1 className="text-5xl font-heading font-black uppercase tracking-tighter text-white">
            The C1rcle
          </h1>
          <p className="mt-4 text-lg text-white/60">Join the community to unlock your profile.</p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/login" className="rounded-full bg-white px-8 py-4 text-xs font-bold uppercase tracking-widest text-black hover:scale-105 transition-transform">
              Login
            </Link>
            <Link href="/explore" className="rounded-full border border-white/20 px-8 py-4 text-xs font-bold uppercase tracking-widest text-white hover:bg-white/10 transition-colors">
              Explore
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const emailHandle = user.email?.split("@")[0];
  const rawName = profile?.displayName;
  const displayName = (rawName && emailHandle && rawName.toLowerCase() === emailHandle.toLowerCase())
    ? "Member"
    : (rawName || "Member");
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#030303] text-white selection:bg-iris selection:text-white">
      <AuroraBackground />

      <div className="relative z-10 mx-auto max-w-5xl px-4 pb-24 pt-32 sm:px-6 lg:px-8">

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <MemberCard
            user={user}
            profile={profile}
            displayName={displayName}
            initials={initials}
            onEdit={() => setEditModalOpen(true)}
          />
        </motion.div>

        {/* Achievements Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mt-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Achievements</h3>
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            <AchievementBadge icon="🎉" label="Early Adopter" unlocked={true} />
            <AchievementBadge icon="🎫" label="First Ticket" unlocked={orders.length > 0} />
            <AchievementBadge icon="🔥" label="Socialite" unlocked={attendingEvents.length >= 5} />
            <AchievementBadge icon="🎤" label="Host" unlocked={profile?.hostStatus === "approved"} />
            <AchievementBadge icon="💎" label="VIP" unlocked={false} />
          </div>
        </motion.div>

        {/* Navigation */}
        <div className="mt-12 flex flex-col items-center gap-8 md:flex-row md:justify-between">
          <h2 className="text-2xl font-heading font-black uppercase tracking-tight">
            Your Activity
          </h2>
          <TabSwitch active={activeTab} onChange={setActiveTab} />
        </div>

        {/* Content Grid */}
        <div className="mt-8 min-h-[400px]">
          <AnimatePresence mode="wait">
            {activeTab === "tickets" && (
              <motion.div
                key="tickets"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {fetchingOrders ? (
                  <div className="flex justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
                  </div>
                ) : orders.length > 0 ? (
                  <div className="grid gap-6">
                    {orders.map((order) => (
                      <TicketItem key={order.id} order={order} />
                    ))}
                  </div>
                ) : (
                  <EmptyState type="tickets" />
                )}
              </motion.div>
            )}

            {activeTab === "rsvps" && (
              <motion.div
                key="rsvps"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {fetchingRSVPs ? (
                  <div className="flex justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
                  </div>
                ) : attendingEvents.length > 0 ? (
                  <EventGrid events={attendingEvents} />
                ) : (
                  <EmptyState type="rsvps" />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <EditProfileModal open={editModalOpen} onClose={() => setEditModalOpen(false)} />
    </div>
  );
}
