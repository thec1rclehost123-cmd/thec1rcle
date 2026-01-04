"use client";

/**
 * Intent Store Utility
 * Persists user actions that were interrupted by auth requirements.
 */

const INTENT_KEY = "posh_user_intent";

export const saveIntent = (type, eventId, payload = {}, returnUrl = null) => {
    if (typeof window === "undefined") return;
    const intent = {
        type, // "LIKE" | "RSVP" | "BOOK"
        eventId,
        payload,
        returnUrl: returnUrl || window.location.pathname,
        timestamp: Date.now(),
    };
    sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent));
};

export const getIntent = () => {
    if (typeof window === "undefined") return null;
    const data = sessionStorage.getItem(INTENT_KEY);
    if (!data) return null;
    try {
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
};

export const clearIntent = () => {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(INTENT_KEY);
};
