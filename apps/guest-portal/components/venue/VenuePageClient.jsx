"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../providers/AuthProvider";

// New components
import VenueHero from "./VenueHero";
import VenueQuickActions from "./VenueQuickActions";
import VenueHighlights from "./VenueHighlights";
import VenueActionCards from "./VenueActionCards";
import VenueFacilities from "./VenueFacilities";
import VenueGallery from "./VenueGallery";
import VenueDetails from "./VenueDetails";

// Existing components
import VenueCtaBar from "./VenueCtaBar";
import VenuePastEvents from "./VenuePastEvents";
import ReservationCalendarModal from "./ReservationCalendarModal";

/**
 * VenuePageClient - Main client component for the venue page
 * Orchestrates all sections and handles follow/reservation logic
 */
export default function VenuePageClient({
    venue,
    upcomingEvents = [],
    pastEvents = [],
    stats = null,
    highlights = [],
    similarVenues = []
}) {
    const [isFollowing, setIsFollowing] = useState(false);
    const [followersCount, setFollowersCount] = useState(stats?.followers || venue?.followers || 0);
    const [showReservation, setShowReservation] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Get auth context - useAuth is always called at top level
    const { user } = useAuth() || {};

    // Check if user is following on mount
    useEffect(() => {
        const checkFollowStatus = async () => {
            if (!user || !venue?.id) return;

            try {
                const response = await fetch(`/api/venues/${venue.id}/follow-status`);
                if (response.ok) {
                    const data = await response.json();
                    setIsFollowing(data.isFollowing);
                }
            } catch (err) {
                console.error("Failed to check follow status:", err);
            }
        };

        checkFollowStatus();
    }, [venue?.id, user]);

    // Handle follow/unfollow
    const handleFollow = async () => {
        if (isLoading) return;

        // Optimistic update
        const newStatus = !isFollowing;
        setIsFollowing(newStatus);
        setFollowersCount(prev => newStatus ? prev + 1 : Math.max(0, prev - 1));

        try {
            setIsLoading(true);

            const response = await fetch(`/api/venues/${venue.id}/follow`, {
                method: newStatus ? 'POST' : 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                // Revert on error
                setIsFollowing(!newStatus);
                setFollowersCount(prev => !newStatus ? prev + 1 : Math.max(0, prev - 1));
                console.error("Failed to update follow status");
            }
        } catch (err) {
            // Revert on error
            setIsFollowing(!newStatus);
            setFollowersCount(prev => !newStatus ? prev + 1 : Math.max(0, prev - 1));
            console.error("Failed to update follow status:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReserve = () => {
        setShowReservation(true);
    };

    // Extract menu images from venue data
    const menuImages = venue.menuImages || venue.menu?.images || [];

    // Extract highlights from venue data  
    const venueHighlights = highlights?.length > 0 ? highlights : (venue.highlights || []);

    // Extract facilities
    const facilities = venue.facilities || [];
    const amenities = venue.amenities || [];

    // Extract gallery photos
    const galleryPhotos = venue.photos || venue.gallery || [];

    return (
        <>
            {/* 1. HERO SECTION - Venue Poster */}
            <VenueHero
                venue={venue}
                isFollowing={isFollowing}
                onFollow={handleFollow}
                followersCount={followersCount}
            />

            {/* 2. QUICK ACTION BUTTONS */}
            <VenueQuickActions
                venue={venue}
                isFollowing={isFollowing}
                onFollow={handleFollow}
                followersCount={followersCount}
            />

            {/* 3. HIGHLIGHTS SECTION (Story Style) - Only show if data exists */}
            {venueHighlights.length > 0 && (
                <VenueHighlights
                    highlights={venueHighlights}
                    venueName={venue.name}
                />
            )}

            {/* 4. ACTION CARDS - Events & Menu */}
            {(upcomingEvents.length > 0 || menuImages.length > 0) && (
                <VenueActionCards
                    venueId={venue.id}
                    upcomingEvents={upcomingEvents}
                    menuImages={menuImages}
                />
            )}

            {/* 5. FACILITIES & AMENITIES - Only show if data exists */}
            {(facilities.length > 0 || amenities.length > 0) && (
                <VenueFacilities
                    facilities={facilities}
                    amenities={amenities}
                />
            )}

            {/* 6. VENUE GALLERY (3x3 Grid) - Only show if data exists */}
            {galleryPhotos.length > 0 && (
                <VenueGallery
                    photos={galleryPhotos}
                    venueName={venue.name}
                />
            )}

            {/* 7. PAST EVENTS SECTION - Only show if data exists */}
            {pastEvents.length > 0 && (
                <VenuePastEvents
                    events={pastEvents}
                    venueName={venue.name}
                />
            )}

            {/* 8. COMPLETE VENUE DETAILS */}
            <VenueDetails venue={venue} />

            {/* Sticky CTA Bar */}
            <VenueCtaBar
                venue={venue}
                isFollowing={isFollowing}
                onFollow={handleFollow}
                onReserve={handleReserve}
                showOnScroll={true}
            />

            {/* Reservation Calendar Modal */}
            <ReservationCalendarModal
                venue={venue}
                upcomingEvents={upcomingEvents}
                isOpen={showReservation}
                onClose={() => setShowReservation(false)}
            />
        </>
    );
}
