"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, Trash2, X, Info, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    updateDoc,
    doc,
    writeBatch,
    addDoc,
    serverTimestamp,
    deleteDoc
} from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase/client";
import { useAuth } from "../providers/AuthProvider";

export default function NotificationDropdown() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Fetch Notifications
    useEffect(() => {
        if (!user) return;
        const db = getFirebaseDb();

        // Query: Get notifications for this user, ordered by newest first
        const q = query(
            collection(db, "notifications"),
            where("recipientId", "==", user.uid),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Handle timestamp safely
                createdAt: doc.data().createdAt?.toDate() || new Date()
            }));
            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.read).length);
        });

        return () => unsubscribe();
    }, [user]);

    // Actions
    const markAsRead = async (id) => {
        const db = getFirebaseDb();
        await updateDoc(doc(db, "notifications", id), { read: true });
    };

    const markAllAsRead = async () => {
        const db = getFirebaseDb();
        const batch = writeBatch(db);
        notifications.forEach(n => {
            if (!n.read) {
                batch.update(doc(db, "notifications", n.id), { read: true });
            }
        });
        await batch.commit();
    };

    const deleteNotification = async (id, e) => {
        e.stopPropagation();
        const db = getFirebaseDb();
        await deleteDoc(doc(db, "notifications", id));
    };

    // Helper to create a test notification (for demo purposes)
    const sendTestNotification = async () => {
        const db = getFirebaseDb();
        await addDoc(collection(db, "notifications"), {
            recipientId: user.uid,
            title: "New Booking Received",
            body: "Rahul Sharma just booked a VIP Table for Neon Nights.",
            type: "success",
            read: false,
            createdAt: serverTimestamp()
        });
    };

    // Render Icon based on type
    const getIcon = (type) => {
        switch (type) {
            case 'success': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
            case 'error': return <X className="w-4 h-4 text-red-400" />;
            default: return <Info className="w-4 h-4 text-[#F44A22]" />;
        }
    };

    // Format time relative
    const formatTime = (date) => {
        const now = new Date();
        const diff = (now - date) / 1000; // seconds
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-3 rounded-xl hover:bg-white/[0.05] text-[#888] hover:text-white transition-colors outline-none"
            >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-[#FF4B55] rounded-full border-2 border-[#050505] animate-pulse" />
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 top-full mt-4 w-[400px] bg-[#0A0A0A] border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden z-50 origin-top-right"
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-white/[0.05] flex items-center justify-between bg-[#111]/50 backdrop-blur-md">
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-white">Notifications</h3>
                                {unreadCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-full bg-[#F44A22] text-white text-[10px] font-bold">
                                        {unreadCount} New
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={sendTestNotification}
                                    className="p-1.5 hover:bg-white/10 rounded-lg text-[#666] hover:text-white transition-colors"
                                    title="Send Test Notification"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="text-[10px] font-bold text-[#666] hover:text-white transition-colors uppercase tracking-wider"
                                    >
                                        Mark all read
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* List */}
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                                    <div className="w-12 h-12 rounded-full bg-[#111] flex items-center justify-center mb-4">
                                        <Bell className="w-6 h-6 text-[#333]" />
                                    </div>
                                    <p className="text-white font-bold text-sm">All caught up!</p>
                                    <p className="text-[#666] text-xs mt-1">No new notifications at the moment.</p>
                                    <button
                                        onClick={sendTestNotification}
                                        className="mt-4 text-xs text-[#F44A22] font-bold hover:underline"
                                    >
                                        Send a test notification
                                    </button>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/[0.05]">
                                    {notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            onClick={() => markAsRead(notif.id)}
                                            className={`p-4 hover:bg-white/[0.02] transition-colors cursor-pointer group relative ${!notif.read ? 'bg-white/[0.02]' : ''}`}
                                        >
                                            <div className="flex gap-4">
                                                <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${notif.type === 'success' ? 'bg-emerald-500/10' :
                                                    notif.type === 'error' ? 'bg-red-500/10' :
                                                        'bg-[#F44A22]/10'
                                                    }`}>
                                                    {getIcon(notif.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-0.5">
                                                        <h4 className={`text-sm font-bold truncate pr-2 ${notif.read ? 'text-[#888]' : 'text-white'}`}>
                                                            {notif.title}
                                                        </h4>
                                                        <span className="text-[10px] text-[#555] whitespace-nowrap flex items-center gap-1">
                                                            {formatTime(notif.createdAt)}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-[#666] leading-relaxed line-clamp-2">
                                                        {notif.body}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Hover Actions */}
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0A0A0A] pl-2 shadow-[-10px_0_20px_#0A0A0A]">
                                                <button
                                                    onClick={(e) => deleteNotification(notif.id, e)}
                                                    className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-[#444] transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* Unread Indicator */}
                                            {!notif.read && (
                                                <div className="absolute left-0 top-4 bottom-4 w-0.5 bg-[#F44A22]" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function PlusIcon({ className }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </svg>
    )
}
