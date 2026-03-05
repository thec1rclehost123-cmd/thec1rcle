export interface Address {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    lat?: number;
    lng?: number;
}
export interface Venue {
    id: string;
    name: string;
    slug: string;
    description?: string;
    address?: Address;
    city?: string;
    cityKey?: string;
    photoURL?: string;
    image?: string;
    facilities?: string[];
    capacity?: number;
    contactEmail?: string;
    contactPhone?: string;
    socials?: {
        instagram?: string;
        website?: string;
        facebook?: string;
    };
}
export interface Event {
    id: string;
    title: string;
    summary?: string;
    description?: string;
    image?: string;
    startDate: string;
    endDate?: string;
    venueId?: string;
    venue?: string;
    host?: string;
    hostId?: string;
    lifecycle: 'draft' | 'published' | 'cancelled' | 'past';
    status: 'upcoming' | 'live' | 'past';
    tags?: string[];
    category?: string;
    eventType?: string;
    heatScore?: number;
    isFree?: boolean;
    startingPrice?: number;
    priceRange?: {
        min: number;
        max: number;
    };
    settings?: {
        showGuestlist?: boolean;
        activity?: boolean;
        surgeProtection?: boolean;
    };
    cancellationReason?: string;
    refundPolicy?: 'full' | 'partial' | 'none';
    partialRefundPercent?: number;
    refundStatus?: 'pending' | 'completed' | 'failed';
}
export interface Profile {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    phoneNumber?: string;
    bio?: string;
    city?: string;
    instagram?: string;
    attendedEvents?: string[];
    likedEvents?: string[];
    createdAt: string;
    updatedAt: string;
}
