"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";

export function useSocialActions(eventId) {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const rsvpMutation = useMutation({
        mutationFn: async ({ shouldInclude }) => {
            const token = await user.getIdToken();
            const res = await fetch(`/api/events/${eventId}/rsvp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ shouldInclude })
            });
            if (!res.ok) throw new Error("Failed to update RSVP");
            return res.json();
        },
        onMutate: async ({ shouldInclude }) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ['profile', user?.uid] });

            // Snapshot the previous value
            const previousProfile = profile;

            // Optimistically update to the new value
            // Note: AuthProvider state is separate from React Query usually, 
            // but if we were using RQS for profile, we'd update it here.
            // For now, we'll suggest moving Profile to React Query as part of the audit.

            toast(shouldInclude ? "RSVP confirmed" : "RSVP removed", "success");

            return { previousProfile };
        },
        onError: (err, variables, context) => {
            toast("Unable to update RSVP. Please try again.", "error");
        },
    });

    return {
        toggleRSVP: (shouldInclude) => rsvpMutation.mutate({ shouldInclude }),
        isRSVPLoading: rsvpMutation.isPending,
    };
}
