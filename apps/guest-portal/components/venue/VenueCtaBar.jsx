"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Heart,
    Calendar,
    Phone,
    MessageCircle,
    Instagram,
    Globe,
    MapPin,
    Share2,
    Bell,
    ChevronDown
} from "lucide-react";

export default function VenueCtaBar({
    venue,
    onFollow,
    onReserve,
    isFollowing = false,
    showOnScroll = true
}) {
    const [visible, setVisible] = useState(!showOnScroll);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (!showOnScroll) return;

        const handleScroll = () => {
            const heroHeight = window.innerHeight * 0.8;
            setVisible(window.scrollY > heroHeight);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [showOnScroll]);

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: venue.name,
                    text: `Check out ${venue.name} on THE C1RCLE`,
                    url: window.location.href,
                });
            } catch (err) {
                console.log("Share cancelled");
            }
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert("Link copied to clipboard!");
        }
    };

    const openWhatsApp = () => {
        const phone = venue.whatsapp || venue.phone || venue.contact?.phone;
        if (phone) {
            window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
        }
    };

    const openCall = () => {
        const phone = venue.phone || venue.contact?.phone;
        if (phone) {
            window.location.href = `tel:${phone}`;
        }
    };

    const hasReservation = venue.tablesAvailable || venue.hasReservation;
    const hasTickets = venue.hasTickets || venue.primaryCta === 'tickets';
    const instagram = venue.socialLinks?.instagram || venue.contact?.instagram;
    const website = venue.website;

    return (
        <>
            {/* Fixed Bottom CTA Bar - Mobile */}
            <div className={`fixed bottom-0 left-0 right-0 z-40 md:hidden transition-all duration-500 ${visible ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur-2xl border-t border-black/10 dark:border-white/10 p-4 safe-area-bottom">
                    <div className="flex items-center gap-3">
                        {/* Follow Button */}
                        <button
                            onClick={onFollow}
                            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${isFollowing
                                    ? 'bg-[#F44A22]/10 text-[#F44A22] border border-[#F44A22]/20'
                                    : 'bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60 border border-black/10 dark:border-white/10'
                                }`}
                        >
                            <Heart className={`h-4 w-4 ${isFollowing ? 'fill-[#F44A22]' : ''}`} />
                            {isFollowing ? 'Following' : 'Follow'}
                        </button>

                        {/* Primary CTA */}
                        {hasReservation ? (
                            <button
                                onClick={onReserve}
                                className="flex-[2] py-4 bg-[#F44A22] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-[#F44A22]/30"
                            >
                                Reserve Table
                            </button>
                        ) : hasTickets ? (
                            <Link
                                href={`/explore?venue=${venue.id}`}
                                className="flex-[2] py-4 bg-[#F44A22] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest text-center shadow-lg shadow-[#F44A22]/30"
                            >
                                Get Tickets
                            </Link>
                        ) : (
                            <button
                                onClick={openWhatsApp}
                                className="flex-[2] flex items-center justify-center gap-2 py-4 bg-[#25D366] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest"
                            >
                                <MessageCircle className="h-4 w-4" />
                                Contact
                            </button>
                        )}

                        {/* More Actions */}
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="w-14 h-14 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center"
                        >
                            <ChevronDown className={`h-5 w-5 text-black/60 dark:text-white/60 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {/* Expanded Actions */}
                    {expanded && (
                        <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                            <button onClick={openCall} className="flex flex-col items-center gap-2 py-3">
                                <div className="w-12 h-12 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                                    <Phone className="h-5 w-5 text-black/60 dark:text-white/60" />
                                </div>
                                <span className="text-[9px] font-bold uppercase text-black/40 dark:text-white/40">Call</span>
                            </button>
                            <button onClick={openWhatsApp} className="flex flex-col items-center gap-2 py-3">
                                <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                                    <MessageCircle className="h-5 w-5 text-[#25D366]" />
                                </div>
                                <span className="text-[9px] font-bold uppercase text-black/40 dark:text-white/40">WhatsApp</span>
                            </button>
                            {instagram && (
                                <a href={`https://instagram.com/${instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 py-3">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center">
                                        <Instagram className="h-5 w-5 text-pink-500" />
                                    </div>
                                    <span className="text-[9px] font-bold uppercase text-black/40 dark:text-white/40">Instagram</span>
                                </a>
                            )}
                            <button onClick={handleShare} className="flex flex-col items-center gap-2 py-3">
                                <div className="w-12 h-12 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                                    <Share2 className="h-5 w-5 text-black/60 dark:text-white/60" />
                                </div>
                                <span className="text-[9px] font-bold uppercase text-black/40 dark:text-white/40">Share</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Desktop Floating Bar */}
            <div className={`hidden md:block fixed bottom-8 left-1/2 -translate-x-1/2 z-40 transition-all duration-500 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'}`}>
                <div className="flex items-center gap-4 p-3 bg-white/90 dark:bg-[#161616]/90 backdrop-blur-2xl rounded-full border border-black/10 dark:border-white/10 shadow-2xl">
                    {/* Follow */}
                    <button
                        onClick={onFollow}
                        className={`flex items-center gap-2 px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${isFollowing
                                ? 'bg-[#F44A22]/10 text-[#F44A22]'
                                : 'hover:bg-black/5 dark:hover:bg-white/5 text-black/60 dark:text-white/60'
                            }`}
                    >
                        <Heart className={`h-4 w-4 ${isFollowing ? 'fill-[#F44A22]' : ''}`} />
                        {isFollowing ? 'Following' : 'Follow'}
                    </button>

                    <div className="w-px h-8 bg-black/10 dark:bg-white/10" />

                    {/* Reservation/Tickets */}
                    {hasReservation && (
                        <button
                            onClick={onReserve}
                            className="flex items-center gap-2 px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-widest bg-[#F44A22] text-white shadow-lg shadow-[#F44A22]/30 hover:scale-105 transition-transform"
                        >
                            <Calendar className="h-4 w-4" />
                            Reserve
                        </button>
                    )}

                    {hasTickets && (
                        <Link
                            href={`/explore?venue=${venue.id}`}
                            className="flex items-center gap-2 px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-widest bg-[#F44A22] text-white shadow-lg shadow-[#F44A22]/30 hover:scale-105 transition-transform"
                        >
                            Get Tickets
                        </Link>
                    )}

                    <div className="w-px h-8 bg-black/10 dark:bg-white/10" />

                    {/* Quick Actions */}
                    <button onClick={openCall} className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                        <Phone className="h-4 w-4 text-black/60 dark:text-white/60" />
                    </button>

                    <button onClick={openWhatsApp} className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center hover:bg-[#25D366]/20 transition-colors">
                        <MessageCircle className="h-4 w-4 text-[#25D366]" />
                    </button>

                    {instagram && (
                        <a href={`https://instagram.com/${instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center hover:from-purple-500/20 hover:to-pink-500/20 transition-colors">
                            <Instagram className="h-4 w-4 text-pink-500" />
                        </a>
                    )}

                    {website && (
                        <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                            <Globe className="h-4 w-4 text-black/60 dark:text-white/60" />
                        </a>
                    )}

                    <button onClick={handleShare} className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                        <Share2 className="h-4 w-4 text-black/60 dark:text-white/60" />
                    </button>
                </div>
            </div>
        </>
    );
}
