"use client";

import { useState } from "react";
import {
    Plus,
    Trash2,
    Search,
    Save,
    ChevronRight,
    Utensils,
    Coffee,
    Wine,
    Pizza,
    Edit2,
    CheckCircle2,
    AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function VenueMenuManagement() {
    const [sections, setSections] = useState([
        { id: "regular", label: "Regular Menu", icon: Pizza, count: 12 },
        { id: "vintage", label: "Vintage Menu", icon: Wine, count: 5 },
        { id: "drinks", label: "Drinks", icon: Wine, count: 24 },
        { id: "desserts", label: "Desserts", icon: Coffee, count: 8 },
    ]);

    const [activeSection, setActiveSection] = useState("regular");
    const [isSaving, setIsSaving] = useState(false);

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="px-3 py-1 bg-emerald-500/10 rounded-full text-[10px] font-bold text-emerald-600 uppercase tracking-widest border border-emerald-500/20">
                            Live on Storefront
                        </div>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                        <Utensils className="w-10 h-10" />
                        Digital Menu Manager
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setIsSaving(true);
                            setTimeout(() => setIsSaving(false), 1500);
                        }}
                        className="btn btn-primary min-w-[140px]"
                    >
                        {isSaving ? "Publishing..." : "Publish Changes"}
                        {!isSaving && <Save className="w-4 h-4 ml-2" />}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar Categories */}
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 px-2">Menu Sections</h3>
                        <div className="space-y-2">
                            {sections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${activeSection === section.id
                                            ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                                            : "text-slate-500 hover:bg-slate-50"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <section.icon className={`w-4 h-4 ${activeSection === section.id ? "text-emerald-400" : "text-slate-400"}`} />
                                        <span className="text-sm font-bold">{section.label}</span>
                                    </div>
                                    <span className={`text-[10px] font-bold ${activeSection === section.id ? "text-white/40" : "text-slate-300"}`}>
                                        {section.count}
                                    </span>
                                </button>
                            ))}
                            <button className="w-full flex items-center gap-3 p-4 rounded-xl text-emerald-600 border border-dashed border-emerald-200 hover:bg-emerald-50 transition-all mt-4">
                                <Plus className="w-4 h-4" />
                                <span className="text-sm font-bold uppercase tracking-widest text-[10px]">New Section</span>
                            </button>
                        </div>
                    </div>

                    {/* Pro Tip Card */}
                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-6 text-white overflow-hidden relative shadow-xl shadow-indigo-100">
                        <div className="relative z-10 space-y-4">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-sm">Pro Tip: Photography</h4>
                            <p className="text-xs text-white/70 leading-relaxed">
                                Venues with high-quality real photos of dishes see 40% higher conversion rates on reservations.
                            </p>
                            <button className="text-[10px] font-black uppercase tracking-widest underline">Learn More</button>
                        </div>
                        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
                    </div>
                </div>

                {/* Main Menu List */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 capitalize tracking-tight">{activeSection} Items</h2>
                                <p className="text-slate-400 text-xs font-medium mt-1 uppercase tracking-widest">Manage prices and availability</p>
                            </div>
                            <button className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100">
                                <Plus className="w-4 h-4" />
                                Add Item
                            </button>
                        </div>

                        <div className="divide-y divide-slate-50">
                            {[
                                { name: "Mutton Kheema Pizza", price: "650", isVeg: false, available: true },
                                { name: "Pesto Bocconcini", price: "600", isVeg: true, available: true },
                                { name: "Bbq Chicken Pizza", price: "550", isVeg: false, available: false },
                                { name: "Paneer Tikka Pizza", price: "529", isVeg: true, available: true },
                            ].map((item, idx) => (
                                <div key={idx} className="p-6 flex items-center justify-between group hover:bg-slate-50/50 transition-all">
                                    <div className="flex items-center gap-6">
                                        {/* Veg Indicator */}
                                        <div className={`w-4 h-4 border flex items-center justify-center ${item.isVeg ? "border-emerald-500" : "border-red-500"}`}>
                                            <div className={`w-2 h-2 rounded-full ${item.isVeg ? "bg-emerald-500" : "bg-red-500"}`} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-3">
                                                {item.name}
                                                {!item.available && (
                                                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] text-slate-400 uppercase tracking-tighter">Out of Stock</span>
                                                )}
                                            </h4>
                                            <p className="text-xs text-slate-400 mt-1">₹{item.price}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <button className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <div className="h-4 w-px bg-slate-100 mx-2" />
                                        <div className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${item.available ? "bg-emerald-500" : "bg-slate-200"}`}>
                                            <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-all ${item.available ? "left-5.5" : "left-0.5"}`} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Analytics Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Most Popular</p>
                            <p className="text-lg font-bold text-slate-900 tracking-tight">Mutton Kheema</p>
                        </div>
                        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Veg Mix</p>
                            <p className="text-lg font-bold text-slate-900 tracking-tight">42% Items</p>
                        </div>
                        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm group cursor-pointer hover:border-emerald-200 transition-all">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Storefront Sync</p>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <p className="text-lg font-bold text-slate-900 tracking-tight">Active</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
