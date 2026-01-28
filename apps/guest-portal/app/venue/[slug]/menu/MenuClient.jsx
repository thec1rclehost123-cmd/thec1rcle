"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Search, Filter } from "lucide-react";

export default function VenueMenuPage({ venue, slug }) {
    const [isVegOnly, setIsVegOnly] = useState(false);
    const [activeCategory, setActiveCategory] = useState("regular");

    const menuCategories = [
        { id: "regular", label: "Regular" },
        { id: "vintage", label: "Vintage Menu" },
        { id: "drinks", label: "Drinks" },
        { id: "beverage", label: "Beverage" },
        { id: "desserts", label: "Desserts" },
    ];

    const menuItems = {
        "Neapolitan Pizza": [
            { name: "Mutton Kheema, Nihari Onion", price: "₹650", isVeg: false },
            { name: "Garlic Cheese Toast Pizza", price: "₹550", isVeg: true },
            { name: "Pesto Bocconcini Pizza", price: "₹600", isVeg: true },
            { name: "Rosso Basil Olive Oil Pizza", price: "₹529", isVeg: true },
            { name: "Bbq Chicken Red Onion Pizza", price: "₹550", isVeg: false },
            { name: "Chicken Pepperoni Pizza", price: "₹599", isVeg: false },
        ],
        "Small Plates": [
            { name: "Caesar Salad Croutons", price: "₹319", isVeg: true },
            { name: "Katsu Chicken Strips", price: "₹450", isVeg: false },
            { name: "Peri Peri Fries", price: "₹250", isVeg: true },
        ]
    };

    return (
        <main className="min-h-screen bg-white text-black font-sans">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 p-4 flex justify-between items-center px-6 md:px-12">
                <div className="flex items-center gap-4">
                    <Link href={`/venue/${slug}`} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ChevronLeft className="h-6 w-6" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">{venue.name}</h1>
                        <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live Menu
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Functional Veg Toggle */}
                    <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => setIsVegOnly(!isVegOnly)}
                    >
                        <div className={`w-10 h-5 rounded-full transition-colors relative border ${isVegOnly ? "bg-emerald-500 border-emerald-600" : "bg-gray-100 border-gray-200"}`}>
                            <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-all ${isVegOnly ? "left-5.5" : "left-0.5"}`} />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isVegOnly ? "text-emerald-600" : "text-gray-400 group-hover:text-black"}`}>
                            Veg Only
                        </span>
                    </div>
                    <Search className="h-5 w-5 text-gray-400 cursor-pointer hover:text-black" />
                </div>
            </header>

            <div className="flex">
                {/* Sidebar Categories */}
                <aside className="hidden md:flex w-24 border-r border-gray-100 min-h-[calc(100vh-73px)] sticky top-[73px] bg-gray-50/50 flex-col items-center py-8 gap-10">
                    <div className="text-[9px] font-black uppercase vertical-text tracking-[0.5em] text-gray-300">Sections</div>
                    {["Pizza", "Salads", "Grill", "Sushi"].map((cat) => (
                        <div key={cat} className="flex flex-col items-center gap-2 group cursor-pointer">
                            <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm group-hover:shadow-md transition-all flex items-center justify-center p-2">
                                <span className="text-xs">🍕</span>
                            </div>
                            <span className="text-[8px] font-black uppercase text-gray-400 group-hover:text-black">{cat}</span>
                        </div>
                    ))}
                </aside>

                {/* Content */}
                <div className="flex-1 p-6 md:p-12 space-y-12">
                    {/* Horizontal Switcher */}
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                        {menuCategories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`flex-shrink-0 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${activeCategory === cat.id
                                    ? "bg-black text-white border-black"
                                    : "bg-white text-gray-400 border-gray-100"
                                    }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Filtered Menu List */}
                    {Object.entries(menuItems).map(([category, items]) => {
                        const filteredItems = items.filter(item => isVegOnly ? item.isVeg : true);
                        if (filteredItems.length === 0) return null;

                        return (
                            <section key={category} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <h2 className="text-2xl font-black tracking-tight flex items-center gap-4">
                                    {category}
                                    <span className="h-px flex-1 bg-gray-100" />
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                    {filteredItems.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-start group">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-3">
                                                    {/* Veg/Non-Veg Marker */}
                                                    <div className={`w-3.5 h-3.5 border flex items-center justify-center ${item.isVeg ? "border-emerald-500" : "border-red-500"}`}>
                                                        <div className={`w-2 h-2 rounded-full ${item.isVeg ? "bg-emerald-500" : "bg-red-500"}`} />
                                                    </div>
                                                    <h3 className="text-[15px] font-bold text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{item.name}</h3>
                                                </div>
                                                <p className="text-[11px] text-gray-400 font-medium max-w-xs uppercase tracking-wide">Signature style • Chef's Special</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[13px] font-black text-gray-900">{item.price}</p>
                                                <button className="text-[9px] font-black uppercase text-indigo-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Add +</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>

            <style jsx>{`
                .vertical-text { writing-mode: vertical-rl; transform: rotate(180deg); }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </main>
    );
}
