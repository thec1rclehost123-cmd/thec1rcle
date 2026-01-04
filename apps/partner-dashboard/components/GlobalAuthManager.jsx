"use client";

import { useEffect, useState, useCallback } from "react";
import AuthModal from "./AuthModal";
import { useAuth } from "./providers/AuthProvider";
import { getIntent, clearIntent } from "../lib/utils/intentStore";
import { useRouter } from "next/navigation";
import { trackEvent } from "../lib/utils/analytics";

export default function GlobalAuthManager() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { user, updateEventList, loading } = useAuth();
    const router = useRouter();

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
            } else if (intent.type === "BOOK") {
                // Force the ticket modal to open on the event page if we are there
                // or redirect to checkout if that's the preferred flow
                if (window.location.pathname.includes(`/event/${intent.eventId}`)) {
                    window.dispatchEvent(new CustomEvent('OPEN_TICKET_MODAL'));
                } else {
                    router.push(`/event/${intent.eventId}?autoBook=true`);
                }
            }
            // After replay, clear it
            clearIntent();
        } catch (error) {
            console.error("Failed to replay intent:", error);
        }
    }, [user, updateEventList, router]);

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
