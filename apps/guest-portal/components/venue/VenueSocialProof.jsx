"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Users, Heart, Star, Sparkles, ChevronRight, Crown, Zap } from "lucide-react";

export default function VenueSocialProof({
    venue,
    followers = 0,
    regulars = [],
    similarVenues = [],
    onFollow
}) {
    const [isFollowing, setIsFollowing] = useState(false);
    const [followerCount, setFollowerCount] = useState(followers);

    const handleFollow = async () => {
        setIsFollowing(!isFollowing);
        setFollowerCount(prev => isFollowing ? prev - 1 : prev + 1);
        if (onFollow) onFollow(!isFollowing);
    };

    // Generate placeholder avatars if no regulars
    const displayRegulars = regulars.length > 0 ? regulars : [
        { id: 1, name: "Alex", avatar: "https://i.pravatar.cc/100?u=1" },
        { id: 2, name: "Sam", avatar: "https://i.pravatar.cc/100?u=2" },
        { id: 3, name: "Jordan", avatar: "https://i.pravatar.cc/100?u=3" },
        { id: 4, name: "Taylor", avatar: "https://i.pravatar.cc/100?u=4" },
        { id: 5, name: "Casey", avatar: "https://i.pravatar.cc/100?u=5" },
    ];

    return (
        <section className="py-32 bg-white dark:bg-[#0A0A0A] relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-[#F44A22]/5 via-transparent to-transparent rounded-full blur-[100px]" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-[#FF6B4A]/5 via-transparent to-transparent rounded-full blur-[80px]" />

            <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24 relative z-10">
                {/* Section Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22] mb-4 block">Community</span>
                        <h2 className="text-5xl md:text-8xl font-heading font-black uppercase tracking-tighter leading-none text-black dark:text-white">
                            The<br />
                            <span className="italic">Inner Circle.</span>
                        </h2>
                    </div>
                    <p className="text-sm text-black/40 dark:text-white/40 max-w-sm font-medium">
                        Join the community of nightlife enthusiasts who call this place home
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Follow Card - Main CTA */}
                    <div className="lg:col-span-5 relative">
                        <div className="sticky top-32 p-12 rounded-[3rem] bg-gradient-to-br from-[#F44A22] to-[#CC3311] overflow-hidden shadow-2xl shadow-[#F44A22]/20">
                            {/* Decorative */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -translate-y-32 translate-x-32" />
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-[60px] translate-y-24 -translate-x-24" />

                            <div className="relative z-10 space-y-10">
                                {/* Stats */}
                                <div className="flex items-center gap-6">
                                    <div className="flex -space-x-4">
                                        {displayRegulars.slice(0, 4).map((user, idx) => (
                                            <div key={user.id} className="w-14 h-14 rounded-full border-4 border-[#F44A22] overflow-hidden">
                                                <Image src={user.avatar} width={56} height={56} alt="" className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                        <div className="w-14 h-14 rounded-full border-4 border-[#F44A22] bg-black flex items-center justify-center">
                                            <span className="text-xs font-black text-white">+{Math.max(followerCount - 4, 99)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-5xl md:text-6xl font-heading font-black text-white uppercase tracking-tighter leading-none">
                                        {followerCount.toLocaleString()}
                                    </h3>
                                    <p className="text-sm font-black uppercase tracking-[0.3em] text-white/60">Active Followers</p>
                                </div>

                                <button
                                    onClick={handleFollow}
                                    className={`w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] transition-all duration-500 ${isFollowing
                                            ? "bg-white/20 text-white border-2 border-white/30"
                                            : "bg-white text-black hover:scale-[0.98] shadow-xl"
                                        }`}
                                >
                                    {isFollowing ? "Following ✓" : "Join the Circle"}
                                </button>

                                <p className="text-xs text-white/50 text-center font-medium">
                                    Get exclusive drops, early access & special invites
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Community Sections */}
                    <div className="lg:col-span-7 space-y-8">
                        {/* Regulars */}
                        <div className="p-10 rounded-[2.5rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <Crown className="h-5 w-5 text-[#F44A22]" />
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Regulars</h3>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#F44A22]">Loyal Members</span>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                {displayRegulars.map((user, idx) => (
                                    <div key={user.id} className="flex flex-col items-center gap-3 group cursor-pointer">
                                        <div className="relative">
                                            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-black/10 dark:border-white/10 group-hover:border-[#F44A22] transition-colors">
                                                <Image src={user.avatar} width={64} height={64} alt="" className="w-full h-full object-cover" />
                                            </div>
                                            {idx < 3 && (
                                                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#F44A22] flex items-center justify-center">
                                                    <Star className="h-3 w-3 text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-wider">{user.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Benefits */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-8 rounded-[2rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                                <Zap className="h-8 w-8 text-[#F44A22]" />
                                <h4 className="text-lg font-black uppercase tracking-tight text-black dark:text-white">Early Access</h4>
                                <p className="text-sm text-black/40 dark:text-white/40 font-medium">Be first to know about events & exclusive drops</p>
                            </div>
                            <div className="p-8 rounded-[2rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                                <Sparkles className="h-8 w-8 text-[#F44A22]" />
                                <h4 className="text-lg font-black uppercase tracking-tight text-black dark:text-white">VIP Treatment</h4>
                                <p className="text-sm text-black/40 dark:text-white/40 font-medium">Priority reservations & special perks</p>
                            </div>
                        </div>

                        {/* Similar Venues */}
                        {similarVenues.length > 0 && (
                            <div className="p-10 rounded-[2.5rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Similar Vibes</h3>
                                    <Link href="/hosts" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#F44A22] hover:underline">
                                        Explore All <ChevronRight className="h-3 w-3" />
                                    </Link>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {similarVenues.slice(0, 3).map((v) => (
                                        <Link key={v.id} href={`/venue/${v.slug || v.id}`} className="group relative aspect-square rounded-2xl overflow-hidden">
                                            <Image src={v.coverURL || v.image || "/events/neon-nights.jpg"} fill className="object-cover group-hover:scale-110 transition-transform duration-700" alt={v.name} />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                            <div className="absolute bottom-4 left-4 right-4">
                                                <p className="text-sm font-black text-white uppercase tracking-tight">{v.name}</p>
                                                <p className="text-[10px] text-white/60 font-bold">{v.area || v.city}</p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
