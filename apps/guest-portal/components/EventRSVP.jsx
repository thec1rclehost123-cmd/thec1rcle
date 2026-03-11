"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import EventDetail from "./EventDetail";
import { useAuth } from "./providers/AuthProvider";
import { useToast } from "./providers/ToastProvider";
import { saveIntent } from "../lib/utils/intentStore";
import { useSocialActions } from "../hooks/useSocialActions";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const NotLiveModal = ({ isOpen, onClose }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm overflow-hidden rounded-[40px] bg-white p-10 text-black text-center"
        >
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/5">
              <svg className="h-8 w-8 text-black/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h2 className="font-heading text-2xl font-black uppercase tracking-tight">This event is not live.</h2>
          <p className="mt-4 text-sm font-medium text-black/60">
            This event has either ended or is currently disabled. You can still access your tickets from the profile section.
          </p>
          <div className="mt-10 flex flex-col gap-3">
            <button
              onClick={onClose}
              className="rounded-full bg-black py-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-black/80"
            >
              Close
            </button>
            <Link
              href="/explore"
              className="rounded-full border border-black/10 py-4 text-xs font-black uppercase tracking-widest text-black transition hover:bg-black/5"
            >
              Back to Explore
            </Link>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default function EventRSVP({ event, host, interestedData = { count: 0, users: [] }, isCompleted = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, updateEventList } = useAuth();
  const { toggleRSVP, isRSVPLoading } = useSocialActions(event?.id);
  const { toast } = useToast();
  const [promoterCode, setPromoterCode] = useState(null);
  const [liveInterestedData, setLiveInterestedData] = useState(interestedData);
  const unsubscribeRef = useRef(null);
  const [notLiveModalOpen, setNotLiveModalOpen] = useState(() => {
    const isPastFromStatus = event?.status === "past" || event?.lifecycle === "completed";
    const isPastFromDate = event?.endDate && new Date(event.endDate) < new Date();
    const isDisabled = event?.settings?.activity === false;
    return isCompleted || isPastFromStatus || isPastFromDate || isDisabled;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) {
        setPromoterCode(ref);
        fetch("/api/promoter/links/click", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: ref })
        }).catch(err => console.warn("[EventRSVP] Failed to track promoter click", err));
      }
    }
  }, []);

  // Track event view client-side so the server component can use ISR caching.
  // Fire-and-forget: never blocks render, never surfaces errors to the user.
  useEffect(() => {
    if (event?.id) {
      fetch(`/api/events/${event.id}/view`, { method: "POST" })
        .catch(() => { /* non-critical */ });
    }
  }, [event?.id]);

  // Real-time interested count — listens to stats.saves on the event doc.
  // Lazy-loads firebase/firestore to keep it out of the initial bundle.
  useEffect(() => {
    if (!event?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const { getFirebaseDb } = await import("../lib/firebase/client");
        const { onSnapshot, doc } = await import("firebase/firestore");
        const db = await getFirebaseDb();
        if (cancelled) return;
        unsubscribeRef.current = onSnapshot(
          doc(db, "events", event.id),
          (snap) => {
            if (!snap.exists()) return;
            const saves = snap.data()?.stats?.saves;
            if (typeof saves === "number") {
              setLiveInterestedData(prev => ({ ...prev, count: saves }));
            }
          },
          () => { /* silently ignore permission / network errors */ }
        );
      } catch {
        // Firebase client unavailable (e.g. missing env vars in dev) — no-op
      }
    })();

    return () => {
      cancelled = true;
      unsubscribeRef.current?.();
    };
  }, [event?.id]);

  const ensureAuthenticated = (type) => {
    if (user) return true;
    saveIntent(type, event?.id);
    window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL', {
      detail: { intent: type, eventId: event?.id }
    }));
    return false;
  };

  const handleAction = async (type, data) => {
    switch (type) {
      case "BOOK":
        if (!user) {
          saveIntent("BOOK", event.id);
          window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL', {
            detail: { intent: "BOOK", eventId: event.id }
          }));
          return;
        }

        // Surge Protection Check
        try {
          const surgeRes = await fetch(`/api/events/${event.id}/queue`);
          const surgeData = await surgeRes.json();

          if (surgeData.surgeActive) {
            const admissionToken = sessionStorage.getItem(`admission_token_${event.id}`);
            if (!admissionToken) {
              const queryParams = new URLSearchParams();
              if (data.tickets) {
                data.tickets.forEach(t => queryParams.append(`t_${t.id}`, t.quantity));
              }
              if (promoterCode) queryParams.append("ref", promoterCode);

              const returnTo = `/checkout/${event.id}?${queryParams.toString()}`;
              router.push(`/event/${event.id}/queue?returnTo=${encodeURIComponent(returnTo)}`);
              return;
            }
          }
        } catch (err) {
          console.warn("[EventRSVP] Surge check failed, proceeding with caution", err);
        }

        if (data.tickets) {
          const queryParams = new URLSearchParams();
          data.tickets.forEach(t => queryParams.append(`t_${t.id}`, t.quantity));
          if (promoterCode) queryParams.append("ref", promoterCode);
          router.push(`/checkout/${event.id}?${queryParams.toString()}`);
        }
        break;

      case "RSVP":
        if (!ensureAuthenticated("RSVP")) return;
        const hasRSVPd = Boolean(event?.id && profile?.attendedEvents?.includes(event.id));
        toggleRSVP(!hasRSVPd);
        break;

      case "LIKE":
        if (!ensureAuthenticated("LIKE")) return;
        // Logic for liking could be added here
        break;

      case "SHARE":
        if (typeof window === "undefined") return;
        const url = window.location.href;
        const payload = `${event?.title || "THE C1RCLE event"} • ${url}`;
        if (data.id === "copy") {
          navigator.clipboard?.writeText(url)
            .then(() => toast("Link copied", "success"))
            .catch(() => toast("Unable to copy", "error"));
        } else if (data.id === "whatsapp") {
          window.open(`https://wa.me/?text=${encodeURIComponent(payload)}`, "_blank");
        } else if (data.id === "instagram") {
          window.open(`https://www.instagram.com/?url=${encodeURIComponent(url)}`, "_blank");
        }
        break;

      default:
        console.log("Unhandled action:", type, data);
    }
  };

  return (
    <>
      <EventDetail
        event={event}
        host={host}
        interestedData={liveInterestedData}
        user={user}
        profile={profile}
        toast={toast}
        onAction={handleAction}
      />
      <NotLiveModal isOpen={notLiveModalOpen} onClose={() => setNotLiveModalOpen(false)} />
    </>
  );
}
