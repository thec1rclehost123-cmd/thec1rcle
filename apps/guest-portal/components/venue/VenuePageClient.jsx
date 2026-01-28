"use client";

import { useState, useEffect } from "react";
import VenueCtaBar from "./VenueCtaBar";
import VenueReelsSection from "./VenueReelsSection";
import VenueSocialProof from "./VenueSocialProof";
import VenuePastEvents from "./VenuePastEvents";
import VenueRestaurantSection from "./VenueRestaurantSection";
import ReservationModal from "./ReservationModal";

import VenuePoliciesSection from "./VenuePoliciesSection";

export default function VenuePageClient({
    venue,
    upcomingEvents = [],
    pastEvents = [],
    stats = null,
    similarVenues = []
}) {
    const [isFollowing, setIsFollowing] = useState(false);
    const [showReservation, setShowReservation] = useState(false);

    // Check if user is following (would normally come from API)
    useEffect(() => {
        const checkFollowStatus = async () => {
            // TODO: Check follow status from API
            // const response = await fetch(`/api/venues/${venue.id}/follow-status`);
            // setIsFollowing(response.isFollowing);
        };
        checkFollowStatus();
    }, [venue.id]);

    const handleFollow = async () => {
        try {
            const newStatus = !isFollowing;
            setIsFollowing(newStatus);

            // TODO: Call API to update follow status
            // await fetch(`/api/venues/${venue.id}/follow`, {
            //     method: newStatus ? 'POST' : 'DELETE'
            // });
        } catch (err) {
            console.error("Failed to update follow status:", err);
            setIsFollowing(!isFollowing); // Revert on error
        }
    };

    const handleReserve = () => {
        setShowReservation(true);
    };

    // Get gallery videos for reels section
    const reelVideos = venue.videos || venue.reels || [];

    // Check if venue has restaurant mode
    const hasRestaurant = venue.hasRestaurant || venue.venueType?.toLowerCase().includes('restaurant') ||
        venue.venueType?.toLowerCase().includes('bar') || venue.menuURL;

    return (
        <>
            {/* Video Reels Section */}
            {reelVideos.length > 0 && (
                <VenueReelsSection
                    videos={reelVideos}
                    venueName={venue.name}
                />
            )}

            {/* Restaurant/Menu Section */}
            {hasRestaurant && (
                <VenueRestaurantSection
                    venue={venue}
                    menu={venue.menu}
                    cuisineTags={venue.cuisineTags || venue.tags}
                    priceBand={venue.priceBand || "₹₹"}
                    popularDishes={venue.popularDishes || []}
                />
            )}

            {/* Past Events Section */}
            <VenuePastEvents
                events={pastEvents}
                venueName={venue.name}
            />

            {/* Venue Policies Section */}
            <VenuePoliciesSection venue={venue} />

            {/* Social Proof & Community Section */}
            <VenueSocialProof
                venue={venue}
                followers={stats?.followers || venue.followers || 0}
                regulars={venue.regulars || []}
                similarVenues={similarVenues}
                onFollow={handleFollow}
            />

            {/* Sticky CTA Bar */}
            <VenueCtaBar
                venue={venue}
                isFollowing={isFollowing}
                onFollow={handleFollow}
                onReserve={handleReserve}
                showOnScroll={true}
            />

            {/* Reservation Modal */}
            {showReservation && (
                <ReservationModal
                    venue={venue}
                    onClose={() => setShowReservation(false)}
                />
            )}
        </>
    );
}
