"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "./providers/AuthProvider";
import { consumeIntent } from "../lib/utils/intentStore";
import { useRouter } from "next/navigation";
import { trackEvent } from "../lib/utils/analytics";
import { useToast } from "./providers/ToastProvider";
import { setEventRsvp } from "../features/events/api/eventEngagementApi";
import { followHost, followVenue } from "../features/social/api/socialApi";

const AuthModal = dynamic(() => import("./AuthModal"), { ssr: false });

export default function GlobalAuthManager() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { user, loading } = useAuth();
    const router = useRouter();
    const replayInFlightRef = useRef(false);
    const { toast } = useToast();

    const handleReplayIntent = useCallback(async () => {
        if (replayInFlightRef.current) return;
        const intent = consumeIntent();
        if (!intent || !user) return;
        replayInFlightRef.current = true;

        trackEvent("auth_completed", {
            intent: intent.type,
            eventId: intent.eventId
        });

        try {
            if (intent.type === "RSVP") {
                await setEventRsvp(intent.eventId, true);
                toast({ type: "success", message: "Successfully RSVP'd!" });
            } else if (intent.type === "BOOK") {
                if (window.location.pathname.includes(`/event/${intent.eventId}`)) {
                    window.dispatchEvent(new CustomEvent('OPEN_TICKET_MODAL'));
                } else {
                    router.push(`/event/${intent.eventId}?autoBook=true`);
                }
            } else if (intent.type === "RESERVE_VENUE") {
                const venueSlug = intent.payload?.venueSlug || intent.payload?.targetId;
                if (window.location.pathname.includes("/venue/")) {
                    window.dispatchEvent(new CustomEvent("OPEN_VENUE_RESERVATION"));
                } else if (venueSlug) {
                    router.push(`/venue/${venueSlug}?openReservation=1`);
                } else {
                    throw new Error("Missing venue reservation target");
                }
            } else if (intent.type === "VIEW_TICKETS") {
                router.push("/tickets");
            } else if (intent.type === "FOLLOW_HOST" || intent.type === "FOLLOW_VENUE") {
                const targetType = intent.type === "FOLLOW_HOST" ? "host" : "venue";
                const targetId = intent.payload?.targetId;
                if (!targetId) throw new Error("Missing follow target");
                if (targetType === "host") {
                    await followHost(targetId);
                } else {
                    await followVenue(targetId);
                }
                toast({
                    type: "success",
                    message: `You're now following this ${intent.type.includes("HOST") ? "Host" : "Venue"}! We'll notify you of new events.`
                });
            }
        } catch (error) {
            console.error("Failed to replay intent:", error);
            toast({ type: "error", message: "Something went wrong. Please try again." });
        } finally {
            replayInFlightRef.current = false;
        }
    }, [user, router, toast]);

    useEffect(() => {
        const handleOpenModal = (e) => {
            setIsModalOpen(true);
            trackEvent("auth_prompt_opened", {
                intent: e.detail?.intent || "unknown",
                eventId: e.detail?.eventId || "unknown"
            });
        };
        window.addEventListener("OPEN_AUTH_MODAL", handleOpenModal);
        return () => window.removeEventListener("OPEN_AUTH_MODAL", handleOpenModal);
    }, []);

    useEffect(() => {
        if (user && !loading) {
            handleReplayIntent();
        }
    }, [user, loading, handleReplayIntent]);

    if (!isModalOpen) return null;

    return (
        <AuthModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onAuthSuccess={() => {
                handleReplayIntent();
            }}
        />
    );
}
