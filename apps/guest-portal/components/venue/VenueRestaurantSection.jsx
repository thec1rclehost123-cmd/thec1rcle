"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Utensils, Star, ChevronRight, Flame, Leaf, Award, Wine, Coffee, X } from "lucide-react";

export default function VenueRestaurantSection({
    venue,
    menu = null,
    cuisineTags = [],
    priceBand = "₹₹",
    popularDishes = []
}) {
    const [showMenuPreview, setShowMenuPreview] = useState(false);

    // Check if venue has restaurant mode
    const hasRestaurant = venue?.hasRestaurant || venue?.menuURL || menu || popularDishes.length > 0;

    if (!hasRestaurant) return null;

    // Default cuisine tags if not provided
    const displayTags = cuisineTags.length > 0 ? cuisineTags : ["Contemporary", "Bar Bites", "Fusion"];

    // Default popular dishes
    const displayDishes = popularDishes.length > 0 ? popularDishes : [
        { name: "Signature Nachos", image: "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400", price: "₹650", tag: "Bestseller" },
        { name: "Truffle Fries", image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400", price: "₹450", tag: "Chef's Pick" },
        { name: "Cocktail Platter", image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400", price: "₹1,200", tag: "Must Try" },
    ];

    return (
        <>
            <section className="py-32 bg-white dark:bg-[#0A0A0A] relative overflow-hidden">
                {/* Background Elements */}
                <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-gradient-to-br from-amber-500/5 via-transparent to-transparent rounded-full blur-[100px]" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-[#F44A22]/5 via-transparent to-transparent rounded-full blur-[80px]" />

                <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24 relative z-10">
                    {/* Section Header */}
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-20">
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                                    <Utensils className="h-6 w-6 text-white" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-amber-600 dark:text-amber-400">Culinary Experience</span>
                            </div>
                            <h2 className="text-5xl md:text-8xl font-heading font-black uppercase tracking-tighter leading-none text-black dark:text-white">
                                Taste<br />
                                <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-500">Excellence.</span>
                            </h2>
                        </div>

                        {/* Price Band & Tags */}
                        <div className="flex flex-col items-start lg:items-end gap-4">
                            <div className="flex items-center gap-2 px-5 py-2.5 bg-black/5 dark:bg-white/5 rounded-full border border-black/10 dark:border-white/10">
                                <span className="text-xl font-black text-amber-600">{priceBand}</span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Price Range</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {displayTags.map((tag, idx) => (
                                    <span key={idx} className="px-4 py-2 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest text-black/60 dark:text-white/60">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Popular Dishes */}
                        <div className="lg:col-span-8 space-y-8">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Popular Picks</h3>
                                <div className="flex items-center gap-2 text-amber-600">
                                    <Flame className="h-4 w-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Trending</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {displayDishes.map((dish, idx) => (
                                    <div key={idx} className="group relative rounded-[2rem] overflow-hidden border border-black/5 dark:border-white/5 shadow-lg hover:shadow-xl transition-all">
                                        <div className="aspect-square relative">
                                            <Image
                                                src={dish.image}
                                                fill
                                                className="object-cover transition-transform duration-700 group-hover:scale-110"
                                                alt={dish.name}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                                            {/* Tag */}
                                            {dish.tag && (
                                                <div className="absolute top-4 left-4">
                                                    <span className="px-3 py-1.5 bg-amber-500 rounded-full text-[9px] font-black uppercase tracking-widest text-white">
                                                        {dish.tag}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Info */}
                                            <div className="absolute bottom-6 left-6 right-6">
                                                <h4 className="text-lg font-black text-white uppercase tracking-tight mb-2">{dish.name}</h4>
                                                <p className="text-xl font-black text-amber-400">{dish.price}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Menu CTA Card */}
                        <div className="lg:col-span-4">
                            <div className="sticky top-32 p-10 rounded-[3rem] bg-gradient-to-br from-black to-black/90 dark:from-white/5 dark:to-white/[0.02] border border-white/10 space-y-8 overflow-hidden relative">
                                {/* Decorative */}
                                <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/20 rounded-full blur-[60px] -translate-y-12 translate-x-12" />

                                <div className="relative z-10 space-y-8">
                                    <div className="flex items-center gap-3">
                                        <Wine className="h-6 w-6 text-amber-400" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Full Menu</span>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-3xl font-heading font-black text-white uppercase tracking-tighter leading-none">
                                            Browse Our<br />
                                            <span className="text-amber-400">Selection</span>
                                        </h3>
                                        <p className="text-sm text-white/40 font-medium">
                                            Explore our curated menu of cocktails, appetizers, and signature dishes
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        {venue?.menuURL ? (
                                            <Link
                                                href={`/venue/${venue.slug || venue.id}/menu`}
                                                className="flex items-center justify-between w-full py-5 px-8 bg-amber-500 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-black hover:bg-amber-400 transition-colors group"
                                            >
                                                <span>View Digital Menu</span>
                                                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                            </Link>
                                        ) : (
                                            <button
                                                onClick={() => setShowMenuPreview(true)}
                                                className="flex items-center justify-between w-full py-5 px-8 bg-amber-500 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-black hover:bg-amber-400 transition-colors group"
                                            >
                                                <span>View Digital Menu</span>
                                                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        )}

                                        <Link
                                            href={`/venue/${venue?.slug || venue?.id}#reservation`}
                                            className="flex items-center justify-center w-full py-4 bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-white/20 transition-colors"
                                        >
                                            Reserve a Table
                                        </Link>
                                    </div>

                                    {/* Features */}
                                    <div className="flex flex-wrap gap-3 pt-4 border-t border-white/10">
                                        <div className="flex items-center gap-2 text-white/40">
                                            <Leaf className="h-3 w-3" />
                                            <span className="text-[9px] font-bold uppercase">Vegan Options</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-white/40">
                                            <Coffee className="h-3 w-3" />
                                            <span className="text-[9px] font-bold uppercase">Bar Service</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Menu Preview Modal */}
            {showMenuPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4" onClick={() => setShowMenuPreview(false)}>
                    <div className="relative max-w-2xl w-full max-h-[90vh] bg-white dark:bg-[#161616] rounded-[2rem] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setShowMenuPreview(false)}
                            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center z-10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <div className="p-12 text-center">
                            <Award className="h-16 w-16 text-amber-500 mx-auto mb-6" />
                            <h3 className="text-3xl font-black uppercase tracking-tight mb-4">Menu Coming Soon</h3>
                            <p className="text-black/50 dark:text-white/50 font-medium">
                                Our digital menu is being curated. Contact the venue for current offerings.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
