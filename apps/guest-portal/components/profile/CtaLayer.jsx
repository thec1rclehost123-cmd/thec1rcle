"use client";

import { Phone, MessageCircle, Globe, Navigation, Ticket, Heart } from "lucide-react";

export default function CtaLayer({ venue, isFollowing, onFollow }) {
    const primaryCta = venue.primaryCta || (venue.categoryTag === 'Host' ? 'follow' : 'reserve');
    const whatsapp = venue.whatsapp?.replace(/\D/g, '');

    const handleAction = () => {
        switch (primaryCta) {
            case 'whatsapp':
                if (whatsapp) window.open(`https://wa.me/${whatsapp}`, '_blank');
                break;
            case 'call':
                if (venue.phone) window.location.href = `tel:${venue.phone}`;
                break;
            case 'website':
                if (venue.website) window.open(venue.website.startsWith('http') ? venue.website : `https://${venue.website}`, '_blank');
                break;
            case 'directions':
                if (venue.address) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`, '_blank');
                break;
            case 'tickets':
                document.getElementById('events-section')?.scrollIntoView({ behavior: 'smooth' });
                break;
            default:
                onFollow?.();
                break;
        }
    };

    const getCtaLabel = () => {
        switch (primaryCta) {
            case 'whatsapp': return 'Book a Table';
            case 'call': return 'Call Now';
            case 'website': return 'Visit Website';
            case 'directions': return 'Get Directions';
            case 'tickets': return 'Buy Tickets';
            case 'follow': return isFollowing ? 'Following' : 'Follow';
            default: return 'Reserve Spot';
        }
    };

    const getIcon = () => {
        switch (primaryCta) {
            case 'whatsapp': return <MessageCircle className="w-4 h-4" />;
            case 'call': return <Phone className="w-4 h-4" />;
            case 'website': return <Globe className="w-4 h-4" />;
            case 'directions': return <Navigation className="w-4 h-4" />;
            case 'tickets': return <Ticket className="w-4 h-4" />;
            default: return <Heart className="w-4 h-4" />;
        }
    };

    return (
        <div className="flex flex-col gap-3 lg:pb-4 w-full sm:w-auto">
            <button
                onClick={handleAction}
                className="px-10 py-4 bg-white text-black rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] flex items-center justify-center gap-3 group"
            >
                {getIcon()}
                <span>{getCtaLabel()}</span>
            </button>

            {primaryCta !== 'follow' && (
                <button
                    onClick={onFollow}
                    className={`px-10 py-4 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${isFollowing ? 'bg-white/20 border-white/20 text-white' : 'bg-white/10 border-white/10 text-white/70 hover:bg-white/20'
                        }`}
                >
                    <Heart className={`w-3.5 h-3.5 ${isFollowing ? 'fill-white' : ''}`} />
                    <span>{isFollowing ? 'Following' : 'Follow'}</span>
                </button>
            )}

            {/* Social Overrides */}
            {venue.socialLinks?.instagram && (
                <a
                    href={`https://instagram.com/${venue.socialLinks.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-10 py-4 bg-white/5 backdrop-blur-md text-white/50 rounded-full text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2 border border-white/5"
                >
                    Instagram
                </a>
            )}
        </div>
    );
}
