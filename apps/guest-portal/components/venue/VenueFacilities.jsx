import {
    Car,
    Wifi,
    UtensilsCrossed,
    Award,
    Building2,
    Clock,
    Music,
    PartyPopper,
    Mic2,
    Palmtree,
    Wine,
    Sparkles,
    Cigarette,
    Users,
    Camera,
    Tv
} from "lucide-react";

/**
 * VenueFacilities - Icon-based grid of venue amenities/facilities
 */

// Icon mapping for facilities
const FACILITY_ICONS = {
    parking: Car,
    valet: Car,
    wifi: Wifi,
    food: UtensilsCrossed,
    restaurant: UtensilsCrossed,
    kitchen: UtensilsCrossed,
    vip: Award,
    vip_area: Award,
    vip_lounge: Award,
    outdoor: Palmtree,
    outdoor_seating: Palmtree,
    rooftop: Building2,
    terrace: Building2,
    smoking: Cigarette,
    smoking_area: Cigarette,
    live_music: Music,
    livemusic: Music,
    music: Music,
    dj: Mic2,
    dj_booth: Mic2,
    dance_floor: PartyPopper,
    dancefloor: PartyPopper,
    bar: Wine,
    full_bar: Wine,
    cocktails: Wine,
    private_dining: Users,
    private_room: Users,
    photo_booth: Camera,
    projector: Tv,
    stage: Sparkles
};

const FACILITY_LABELS = {
    parking: "Parking",
    valet: "Valet Parking",
    wifi: "Free WiFi",
    food: "Food Service",
    restaurant: "Restaurant",
    kitchen: "Kitchen",
    vip: "VIP Area",
    vip_area: "VIP Area",
    vip_lounge: "VIP Lounge",
    outdoor: "Outdoor Space",
    outdoor_seating: "Outdoor Seating",
    rooftop: "Rooftop",
    terrace: "Terrace",
    smoking: "Smoking Area",
    smoking_area: "Smoking Zone",
    live_music: "Live Music",
    livemusic: "Live Music",
    music: "Music",
    dj: "DJ",
    dj_booth: "DJ Booth",
    dance_floor: "Dance Floor",
    dancefloor: "Dance Floor",
    bar: "Bar",
    full_bar: "Full Bar",
    cocktails: "Cocktails",
    private_dining: "Private Dining",
    private_room: "Private Room",
    photo_booth: "Photo Booth",
    projector: "Projector",
    stage: "Stage"
};

export default function VenueFacilities({ facilities = [], amenities = [] }) {
    // Combine facilities and amenities
    const allFacilities = [...new Set([...facilities, ...amenities])].filter(Boolean);

    if (allFacilities.length === 0) return null;

    return (
        <section className="px-4 sm:px-6 md:px-12 lg:px-24 py-6 sm:py-8 md:py-12">
            <div className="max-w-4xl mx-auto">
                {/* Section Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />
                    <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-black/40 dark:text-white/40">
                        Facilities & Amenities
                    </h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />
                </div>

                {/* Facilities Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {allFacilities.map((facility, idx) => {
                        const facilityKey = facility.toLowerCase().replace(/\s+/g, '_');
                        const IconComponent = FACILITY_ICONS[facilityKey] || Building2;
                        const label = FACILITY_LABELS[facilityKey] || facility.replace(/_/g, ' ');

                        return (
                            <div
                                key={idx}
                                className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 hover:border-[#F44A22]/30 hover:bg-[#F44A22]/5 transition-all duration-300 group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-[#F44A22]/10 transition-colors">
                                    <IconComponent className="h-5 w-5 text-black/40 dark:text-white/40 group-hover:text-[#F44A22] transition-colors" />
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-black/50 dark:text-white/50 text-center leading-tight group-hover:text-black dark:group-hover:text-white transition-colors">
                                    {label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
