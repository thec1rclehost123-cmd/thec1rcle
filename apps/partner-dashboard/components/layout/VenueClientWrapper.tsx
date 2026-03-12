"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AppleSidebar } from "@/components/shared/AppleSidebar";
import { AppleTopBar } from "@/components/shared/AppleTopBar";
import { motion, AnimatePresence } from "framer-motion";
import { ApprovalGuard } from "@/components/guards/ApprovalGuard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { AssistantButton } from "@/components/assistant/AssistantButton";

interface VenueClientWrapperProps {
    children: React.ReactNode;
    menuSections: any[];
}

export function VenueClientWrapper({ children, menuSections }: VenueClientWrapperProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <ApprovalGuard>
            <RoleGuard allowedType="venue">
                <div className="venue-shell dark min-h-screen bg-[var(--v-canvas)]">
                    {/* Desktop Sidebar */}
                    <div className="hidden lg:block fixed left-0 top-0 bottom-0 h-full z-50">
                        <AppleSidebar
                            brandLetter="C"
                            brandLabel="Venue"
                            menuSections={menuSections}
                            basePath="/venue"
                        />
                    </div>

                    {/* Mobile Header */}
                    <header className="lg:hidden h-14 bg-surface-base/90 backdrop-blur-xl border-b border-border-subtle fixed top-0 left-0 right-0 z-50 px-4 flex items-center justify-between">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 rounded-lg hover:bg-surface-secondary transition-colors"
                        >
                            <Menu className="h-5 w-5 text-text-primary" />
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-text-primary flex items-center justify-center text-text-inverse text-[11px] font-bold">C</span>
                            <span className="text-[13px] font-bold text-text-primary tracking-wide">C1RCLE</span>
                        </div>
                        <div className="w-9" />
                    </header>

                    {/* Mobile Sidebar Overlay */}
                    <AnimatePresence>
                        {sidebarOpen && (
                            <div className="fixed inset-0 z-[100] lg:hidden">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                                    onClick={() => setSidebarOpen(false)}
                                />
                                <motion.div
                                    initial={{ x: -280 }}
                                    animate={{ x: 0 }}
                                    exit={{ x: -280 }}
                                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                    className="absolute inset-y-0 left-0 w-[280px] bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] shadow-2xl"
                                >
                                    <div className="absolute top-4 right-4 z-10">
                                        <button
                                            onClick={() => setSidebarOpen(false)}
                                            className="p-2 rounded-lg hover:bg-surface-tertiary text-text-tertiary hover:text-text-primary transition-all"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                    <AppleSidebar
                                        brandLetter="C"
                                        brandLabel="Venue"
                                        menuSections={menuSections}
                                        basePath="/venue"
                                    />
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Main Content */}
                    <div className="lg:pl-[280px] flex flex-col min-h-screen pt-14 lg:pt-0">
                        <div className="hidden lg:block sticky top-0 z-40">
                            <AppleTopBar />
                        </div>

                        <main className="flex-1 p-4 sm:p-6 lg:p-8 xl:p-10">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className="max-w-[1600px] mx-auto"
                            >
                                {children}
                            </motion.div>
                        </main>
                    </div>
                    <AssistantButton />
                </div>
            </RoleGuard>
        </ApprovalGuard>
    );
}
