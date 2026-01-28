"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Utensils,
    Upload,
    FileText,
    Trash2,
    Plus,
    Loader2,
    ChevronDown,
    X,
    Star,
    Camera,
    DollarSign,
    CheckCircle2
} from "lucide-react";
import { getFirebaseStorage } from "@/lib/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface MenuManagementSectionProps {
    venue: any;
    onUpdate: (updates: any) => Promise<void>;
    partnerId: string;
}

const CUISINE_OPTIONS = [
    "Indian", "Continental", "Italian", "Chinese", "Japanese", "Thai",
    "Mexican", "Mediterranean", "Lebanese", "Korean", "American",
    "Fusion", "Pan-Asian", "European", "Bar Snacks", "Grill"
];

const PRICE_BANDS = [
    { value: "₹", label: "Budget-Friendly", description: "Under ₹500 for two" },
    { value: "₹₹", label: "Moderate", description: "₹500 - ₹1000 for two" },
    { value: "₹₹₹", label: "Premium", description: "₹1000 - ₹2000 for two" },
    { value: "₹₹₹₹", label: "Luxury", description: "₹2000+ for two" },
];

export default function MenuManagementSection({ venue, onUpdate, partnerId }: MenuManagementSectionProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [newDish, setNewDish] = useState({ name: "", price: "", image: "", tag: "" });
    const [showAddDish, setShowAddDish] = useState(false);
    const menuFileRef = useRef<HTMLInputElement>(null);
    const dishImageRef = useRef<HTMLInputElement>(null);

    const handleMenuPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !partnerId) return;

        setIsUploading(true);
        try {
            const storage = getFirebaseStorage();
            const storageRef = ref(storage, `partners/${partnerId}/menu/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            await onUpdate({ menuURL: downloadURL });
        } catch (err) {
            console.error("Menu upload error:", err);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDishImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !partnerId) return;

        setIsUploading(true);
        try {
            const storage = getFirebaseStorage();
            const storageRef = ref(storage, `partners/${partnerId}/dishes/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            setNewDish(prev => ({ ...prev, image: downloadURL }));
        } catch (err) {
            console.error("Dish image upload error:", err);
        } finally {
            setIsUploading(false);
        }
    };

    const handleAddDish = async () => {
        if (!newDish.name || !newDish.price) return;
        const currentDishes = venue?.popularDishes || [];
        await onUpdate({
            popularDishes: [...currentDishes, { ...newDish, id: Date.now() }]
        });
        setNewDish({ name: "", price: "", image: "", tag: "" });
        setShowAddDish(false);
    };

    const handleRemoveDish = async (dishId: number) => {
        const currentDishes = venue?.popularDishes || [];
        await onUpdate({
            popularDishes: currentDishes.filter((d: any) => d.id !== dishId)
        });
    };

    const handleCuisineToggle = (cuisine: string) => {
        const currentCuisines = venue?.cuisineTags || [];
        const newCuisines = currentCuisines.includes(cuisine)
            ? currentCuisines.filter((c: string) => c !== cuisine)
            : [...currentCuisines, cuisine];
        onUpdate({ cuisineTags: newCuisines });
    };

    return (
        <div className="space-y-12">
            {/* Restaurant Mode Toggle */}
            <section className="space-y-6">
                <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-amber-500/10 rounded-xl">
                        <Utensils className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Restaurant & Menu</h3>
                        <p className="text-sm text-[var(--text-tertiary)]">Manage your food & beverage offerings</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={venue?.hasRestaurant || false}
                            onChange={(e) => onUpdate({ hasRestaurant: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[var(--surface-secondary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                        <span className="ml-3 text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
                            {venue?.hasRestaurant ? "Enabled" : "Disabled"}
                        </span>
                    </label>
                </div>
            </section>

            {venue?.hasRestaurant && (
                <>
                    {/* Price Band */}
                    <section className="space-y-4 pt-8 border-t border-[var(--border-subtle)]">
                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Price Range</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {PRICE_BANDS.map((band) => (
                                <button
                                    key={band.value}
                                    onClick={() => onUpdate({ priceBand: band.value })}
                                    className={`p-4 rounded-2xl border transition-all text-left ${venue?.priceBand === band.value
                                        ? "bg-amber-500/10 border-amber-500/30 ring-2 ring-amber-500/20"
                                        : "bg-[var(--surface-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                                        }`}
                                >
                                    <p className="text-2xl font-bold text-amber-500 mb-1">{band.value}</p>
                                    <p className="text-[11px] font-bold text-[var(--text-secondary)]">{band.label}</p>
                                    <p className="text-[10px] text-[var(--text-tertiary)]">{band.description}</p>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Cuisine Tags */}
                    <section className="space-y-4 pt-8 border-t border-[var(--border-subtle)]">
                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Cuisine Types</label>
                        <div className="flex flex-wrap gap-2">
                            {CUISINE_OPTIONS.map((cuisine) => (
                                <button
                                    key={cuisine}
                                    onClick={() => handleCuisineToggle(cuisine)}
                                    className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${venue?.cuisineTags?.includes(cuisine)
                                        ? "bg-amber-500 text-white"
                                        : "bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)]"
                                        }`}
                                >
                                    {cuisine}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Menu PDF Upload */}
                    <section className="space-y-4 pt-8 border-t border-[var(--border-subtle)]">
                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Digital Menu (PDF)</label>
                        <input type="file" ref={menuFileRef} className="hidden" accept=".pdf" onChange={handleMenuPdfUpload} />

                        {venue?.menuURL ? (
                            <div className="flex items-center justify-between p-6 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border-subtle)]">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-red-500/10 rounded-xl">
                                        <FileText className="w-6 h-6 text-red-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[var(--text-primary)]">Menu Uploaded</p>
                                        <a href={venue.menuURL} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-amber-500 uppercase tracking-widest hover:underline">
                                            View PDF
                                        </a>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => menuFileRef.current?.click()}
                                        className="px-4 py-2 bg-[var(--surface-elevated)] rounded-xl text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-primary)] border border-[var(--border-subtle)]"
                                    >
                                        Replace
                                    </button>
                                    <button
                                        onClick={() => onUpdate({ menuURL: null })}
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => menuFileRef.current?.click()}
                                disabled={isUploading}
                                className="w-full py-12 border-2 border-dashed border-[var(--border-subtle)] rounded-2xl flex flex-col items-center justify-center gap-4 hover:bg-[var(--surface-secondary)] transition-all group"
                            >
                                {isUploading ? (
                                    <Loader2 className="w-8 h-8 text-[var(--text-tertiary)] animate-spin" />
                                ) : (
                                    <>
                                        <div className="p-4 bg-[var(--surface-secondary)] rounded-2xl group-hover:scale-110 transition-transform">
                                            <Upload className="w-6 h-6 text-[var(--text-tertiary)]" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-widest">Upload Menu PDF</p>
                                            <p className="text-[10px] text-[var(--text-tertiary)] mt-1">Max 10MB</p>
                                        </div>
                                    </>
                                )}
                            </button>
                        )}
                    </section>

                    {/* Popular Dishes */}
                    <section className="space-y-4 pt-8 border-t border-[var(--border-subtle)]">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Popular Dishes</label>
                            <button
                                onClick={() => setShowAddDish(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-[11px] font-bold hover:bg-amber-400 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                Add Dish
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {venue?.popularDishes?.map((dish: any) => (
                                <div key={dish.id} className="relative group rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-secondary)]">
                                    {dish.image ? (
                                        <div className="aspect-square">
                                            <img src={dish.image} alt={dish.name} className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="aspect-square bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                                            <Utensils className="w-12 h-12 text-amber-500/40" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                    <div className="absolute bottom-4 left-4 right-4">
                                        {dish.tag && (
                                            <span className="inline-block px-2 py-1 bg-amber-500 rounded-md text-[9px] font-black text-white uppercase mb-2">
                                                {dish.tag}
                                            </span>
                                        )}
                                        <p className="text-white font-bold">{dish.name}</p>
                                        <p className="text-amber-400 font-bold">{dish.price}</p>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveDish(dish.id)}
                                        className="absolute top-3 right-3 p-2 bg-black/40 backdrop-blur-md rounded-xl text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}

                            {(!venue?.popularDishes || venue.popularDishes.length === 0) && (
                                <div className="col-span-full py-16 text-center bg-[var(--surface-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-subtle)]">
                                    <Utensils className="w-10 h-10 text-[var(--border-subtle)] mx-auto mb-4" />
                                    <p className="text-[var(--text-tertiary)] text-sm font-medium">No dishes added yet</p>
                                    <p className="text-[var(--text-placeholder)] text-xs mt-1">Showcase your best items</p>
                                </div>
                            )}
                        </div>
                    </section>
                </>
            )}

            {/* Add Dish Modal */}
            <AnimatePresence>
                {showAddDish && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowAddDish(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md bg-[var(--surface-primary)] rounded-3xl border border-[var(--border-subtle)] overflow-hidden shadow-2xl"
                        >
                            <div className="p-8">
                                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Add Popular Dish</h2>
                                <p className="text-sm text-[var(--text-tertiary)] mb-6">Highlight your best menu items</p>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Dish Name</label>
                                        <input
                                            type="text"
                                            value={newDish.name}
                                            onChange={(e) => setNewDish(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="e.g. Signature Nachos"
                                            className="w-full px-4 py-3 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl text-sm"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Price</label>
                                        <input
                                            type="text"
                                            value={newDish.price}
                                            onChange={(e) => setNewDish(prev => ({ ...prev, price: e.target.value }))}
                                            placeholder="e.g. ₹650"
                                            className="w-full px-4 py-3 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl text-sm"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Tag (Optional)</label>
                                        <div className="flex gap-2">
                                            {["Bestseller", "Chef's Pick", "Must Try", "New"].map((tag) => (
                                                <button
                                                    key={tag}
                                                    onClick={() => setNewDish(prev => ({ ...prev, tag: prev.tag === tag ? "" : tag }))}
                                                    className={`px-3 py-2 rounded-lg text-[10px] font-bold ${newDish.tag === tag
                                                        ? "bg-amber-500 text-white"
                                                        : "bg-[var(--surface-secondary)] text-[var(--text-secondary)]"
                                                        }`}
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Image</label>
                                        <input type="file" ref={dishImageRef} className="hidden" accept="image/*" onChange={handleDishImageUpload} />
                                        <button
                                            onClick={() => dishImageRef.current?.click()}
                                            className="w-full py-8 border-2 border-dashed border-[var(--border-subtle)] rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-[var(--surface-secondary)] transition-all"
                                        >
                                            {newDish.image ? (
                                                <img src={newDish.image} alt="" className="w-20 h-20 object-cover rounded-xl" />
                                            ) : (
                                                <>
                                                    <Camera className="w-6 h-6 text-[var(--text-tertiary)]" />
                                                    <span className="text-[10px] font-bold text-[var(--text-tertiary)]">Upload Photo</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={() => setShowAddDish(false)}
                                        className="flex-1 py-3 bg-[var(--surface-secondary)] text-[var(--text-secondary)] rounded-xl text-sm font-bold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAddDish}
                                        disabled={!newDish.name || !newDish.price}
                                        className="flex-1 py-3 bg-amber-500 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                                    >
                                        Add Dish
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
