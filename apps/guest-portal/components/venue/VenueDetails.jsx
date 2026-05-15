import Image from "next/image";
import Link from "next/link";
import {
    MapPin,
    Clock,
    DollarSign,
    Music,
    Shirt,
    ShieldCheck,
    Users,
    Phone,
    Instagram,
    Globe,
    Mail
} from "lucide-react";

/**
 * VenueDetails - Complete venue information section
 * Includes: Address, City, Map, Timings, Cost, Music, Dress Code, Entry Rules, Age Limit, Contact
 */
export default function VenueDetails({ venue }) {
    if (!venue) return null;

    // Extract venue details with fallbacks
    const address = venue.address || venue.contact?.address;
    const city = venue.city || venue.area;
    const phone = venue.phone || venue.contact?.phone;
    const email = venue.email || venue.contact?.email;
    const instagram = venue.socialLinks?.instagram || venue.contact?.instagram;
    const website = venue.website;
    const timings = venue.timings || venue.openingHours;
    const costForTwo = venue.costForTwo || venue.averageCost || venue.priceBand;
    const genres = venue.genres || venue.musicGenres || [];
    const dressCode = venue.dressCode;
    const entryRules = venue.entryRules || venue.rules || [];
    const ageLimit = venue.ageLimit || venue.minimumAge || "21+";

    // Generate map embed URL
    const mapQuery = encodeURIComponent(address || `${venue.name} ${city || ''}`);
    const coordinates = venue.coordinates || venue.location;
    const mapEmbedUrl = coordinates?.lat && coordinates?.lng
        ? `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${coordinates.lat},${coordinates.lng}&zoom=15`
        : `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${mapQuery}&zoom=15`;

    // Format timings for display
    const formatTimings = () => {
        if (!timings) return null;

        if (typeof timings === 'string') {
            return <p className="text-sm font-medium text-black/70 dark:text-white/70">{timings}</p>;
        }

        if (typeof timings === 'object') {
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

            // Helper to format timing value (might be string or object)
            const formatTimeValue = (time) => {
                if (!time) return null;
                if (typeof time === 'string') return time;
                if (typeof time === 'object') {
                    if (time.closed) return 'Closed';
                    if (time.open && time.close) return `${time.open} - ${time.close}`;
                    return JSON.stringify(time); // Fallback
                }
                return String(time);
            };

            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-2">
                    {days.map(day => {
                        const timeValue = timings[day] || timings[day.charAt(0).toUpperCase() + day.slice(1)];
                        const displayTime = formatTimeValue(timeValue);
                        if (!displayTime) return null;
                        return (
                            <div key={day} className="flex justify-between">
                                <span className="text-xs font-bold uppercase text-black/40 dark:text-white/40 capitalize">{day.slice(0, 3)}</span>
                                <span className="text-xs font-bold text-black/70 dark:text-white/70">{displayTime}</span>
                            </div>
                        );
                    })}
                </div>
            );
        }

        return null;
    };

    return (
        <section className="px-4 sm:px-6 md:px-12 lg:px-24 py-8 sm:py-12 md:py-16 bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="max-w-5xl mx-auto">
                {/* Section Header */}
                <div className="mb-12">
                    <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22] block mb-3">
                        Complete Details
                    </span>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-heading font-black uppercase tracking-tighter text-black dark:text-white">
                        Know Before You Go
                    </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Map & Location */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Map Embed */}
                        {(address || coordinates) && (
                            <div className="rounded-3xl overflow-hidden border border-black/10 dark:border-white/10 h-[200px] sm:h-[250px] md:h-[300px]">
                                <iframe
                                    src={mapEmbedUrl}
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0 }}
                                    allowFullScreen
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                />
                            </div>
                        )}

                        {/* Address */}
                        {address && (
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start gap-4 p-5 rounded-2xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 hover:border-[#F44A22]/30 transition-colors group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-[#F44A22]/10 flex items-center justify-center flex-shrink-0">
                                    <MapPin className="h-5 w-5 text-[#F44A22]" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40 dark:text-white/40 mb-1">Address</p>
                                    <p className="text-sm font-medium text-black/80 dark:text-white/80 group-hover:text-[#F44A22] transition-colors">
                                        {address}
                                    </p>
                                    {city && <p className="text-xs text-black/40 dark:text-white/40 mt-1">{city}</p>}
                                </div>
                            </a>
                        )}

                        {/* Timings */}
                        {timings && (
                            <div className="p-5 rounded-2xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-[#F44A22]/10 flex items-center justify-center">
                                        <Clock className="h-5 w-5 text-[#F44A22]" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40 dark:text-white/40">Opening Hours</p>
                                </div>
                                {formatTimings()}
                            </div>
                        )}
                    </div>

                    {/* Right Column - Details Cards */}
                    <div className="space-y-4">
                        {/* Cost for Two */}
                        {costForTwo && (
                            <div className="p-5 rounded-2xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5">
                                <div className="flex items-center gap-3 mb-2">
                                    <DollarSign className="h-4 w-4 text-[#F44A22]" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-black/40 dark:text-white/40">Avg. Cost for Two</span>
                                </div>
                                <p className="text-2xl font-black text-black dark:text-white">
                                    {typeof costForTwo === 'number' ? `₹${costForTwo.toLocaleString()}` : costForTwo}
                                </p>
                            </div>
                        )}

                        {/* Music Genres */}
                        {genres.length > 0 && (
                            <div className="p-5 rounded-2xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5">
                                <div className="flex items-center gap-3 mb-3">
                                    <Music className="h-4 w-4 text-[#F44A22]" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-black/40 dark:text-white/40">Music</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {genres.map((genre, idx) => (
                                        <span key={idx} className="px-3 py-1 bg-black/5 dark:bg-white/5 rounded-full text-[10px] font-bold text-black/60 dark:text-white/60">
                                            {genre}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Dress Code */}
                        {dressCode && (
                            <div className="p-5 rounded-2xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5">
                                <div className="flex items-center gap-3 mb-2">
                                    <Shirt className="h-4 w-4 text-[#F44A22]" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-black/40 dark:text-white/40">Dress Code</span>
                                </div>
                                <p className="text-sm font-bold text-black/80 dark:text-white/80">{dressCode}</p>
                            </div>
                        )}

                        {/* Age Limit */}
                        <div className="p-5 rounded-2xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5">
                            <div className="flex items-center gap-3 mb-2">
                                <Users className="h-4 w-4 text-[#F44A22]" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-black/40 dark:text-white/40">Age Limit</span>
                            </div>
                            <p className="text-2xl font-black text-black dark:text-white">{ageLimit}</p>
                        </div>

                        {/* Entry Rules */}
                        {entryRules.length > 0 && (
                            <div className="p-5 rounded-2xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5">
                                <div className="flex items-center gap-3 mb-3">
                                    <ShieldCheck className="h-4 w-4 text-[#F44A22]" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-black/40 dark:text-white/40">Entry Rules</span>
                                </div>
                                <ul className="space-y-2">
                                    {(Array.isArray(entryRules) ? entryRules : [entryRules]).map((rule, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-xs text-black/60 dark:text-white/60">
                                            <span className="text-[#F44A22] mt-0.5">•</span>
                                            {rule}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Contact */}
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#F44A22] to-[#CC3311] text-white">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-4">Contact</p>
                            <div className="space-y-3">
                                {phone && (
                                    <a href={`tel:${phone}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                        <Phone className="h-4 w-4" />
                                        <span className="text-sm font-bold">{phone}</span>
                                    </a>
                                )}
                                {email && (
                                    <a href={`mailto:${email}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                        <Mail className="h-4 w-4" />
                                        <span className="text-sm font-bold truncate">{email}</span>
                                    </a>
                                )}
                                {instagram && (
                                    <a
                                        href={`https://instagram.com/${instagram.replace('@', '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                                    >
                                        <Instagram className="h-4 w-4" />
                                        <span className="text-sm font-bold">@{instagram.replace('@', '')}</span>
                                    </a>
                                )}
                                {website && (
                                    <a
                                        href={website.startsWith('http') ? website : `https://${website}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                                    >
                                        <Globe className="h-4 w-4" />
                                        <span className="text-sm font-bold">Website</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
