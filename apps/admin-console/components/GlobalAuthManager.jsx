"use client";

import { useEffect, useState, useCallback } from "react";
import AuthModal from "./AuthModal";
import { useAuth } from "./providers/AuthProvider";
import { getIntent, clearIntent } from "../lib/utils/intentStore";
import { useRouter } from "next/navigation";
import { trackEvent } from "../lib/utils/analytics";
import { useToast } from "./providers/ToastProvider";

export default function GlobalAuthManager() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { user, updateEventList, loading } = useAuth();
    const router = useRouter();

    const { toast } = useToast();

    const handleReplayIntent = useCallback(async () => {
        const intent = getIntent();
        if (!intent || !user) return;

        trackEvent("auth_completed", {
            intent: intent.type,
            eventId: intent.eventId
        });

        try {
            if (intent.type === "RSVP") {
                await updateEventList("attendedEvents", intent.eventId, true);
                toast({ type: "success", message: "Successfully RSVP'd!" });
            } else if (intent.type === "BOOK") {
                if (window.location.pathname.includes(`/event/${intent.eventId}`)) {
                    window.dispatchEvent(new CustomEvent('OPEN_TICKET_MODAL'));
                } else {
                    router.push(`/event/${intent.eventId}?autoBook=true`);
                }
            } else if (intent.type === "VIEW_TICKETS") {
                router.push("/tickets");
            } else if (intent.type === "FOLLOW_HOST" || intent.type === "FOLLOW_VENUE") {
                toast({
                    type: "success",
                    message: `You're now following this ${intent.type.includes("HOST") ? "Host" : "Venue"}! We'll notify you of new events.`
                });
            } else if (intent.type === "LIKE_POST") {
                toast({ type: "success", message: "Post added to your favorites!" });
            }
            // After replay, clear it
            clearIntent();
        } catch (error) {
            console.error("Failed to replay intent:", error);
            toast({ type: "error", message: "Something went wrong. Please try again." });
        }
    }, [user, updateEventList, router, toast]);

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
