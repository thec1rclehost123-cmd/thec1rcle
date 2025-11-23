"use client";

import { Settings, User, Bell, Shield, LogOut, ChevronRight } from "lucide-react";
import { StudioCard } from "../../../components/host/StudioComponents";
import { useAuth } from "../../../components/providers/AuthProvider";

export default function SettingsPage() {
    const { profile, logout } = useAuth();

    return (
        <div className="max-w-[1800px] mx-auto space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-heading font-bold text-white mb-1">Settings</h1>
                    <p className="text-[#888] text-sm font-medium">Manage your account and preferences.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Card */}
                <div className="lg:col-span-1">
                    <StudioCard className="h-full flex flex-col items-center text-center p-8">
                        <div className="relative w-32 h-32 rounded-full bg-[#111] border-4 border-[#1A1A1A] flex items-center justify-center mb-6 group cursor-pointer">
                            {profile?.photoURL ? (
                                <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <div className="w-full h-full rounded-full bg-gradient-to-br from-[#1A1A1A] to-[#050505] flex items-center justify-center text-4xl font-heading font-bold text-white group-hover:scale-105 transition-transform">
                                    {profile?.displayName?.[0] || "H"}
                                </div>
                            )}
                            <div className="absolute bottom-1 right-1 p-2 bg-[#5D5FEF] rounded-full border-4 border-[#0A0A0A] text-white">
                                <Settings className="w-4 h-4" />
                            </div>
                        </div>

                        <h2 className="text-2xl font-heading font-bold text-white mb-1">{profile?.displayName}</h2>
                        <p className="text-[#666] text-sm font-medium mb-6">{profile?.email}</p>

                        <div className="w-full space-y-3">
                            <button className="w-full py-3 bg-white text-black rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#e5e5e5] transition-colors">
                                Edit Profile
                            </button>
                            <button
                                onClick={logout}
                                className="w-full py-3 bg-[#161616] text-[#FF4B55] border border-[#FF4B55]/20 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#FF4B55]/10 transition-colors flex items-center justify-center gap-2"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                Sign Out
                            </button>
                        </div>
                    </StudioCard>
                </div>

                {/* Settings Options */}
                <div className="lg:col-span-2">
                    <StudioCard className="h-full" noPadding>
                        <div className="p-6 border-b border-white/[0.05] bg-[#0A0A0A]">
                            <h3 className="text-lg font-bold text-white">General</h3>
                            <p className="text-xs text-[#666] mt-1">App configuration</p>
                        </div>

                        <div className="p-4 space-y-2">
                            {[
                                { icon: User, label: "Account Information", desc: "Update your personal details" },
                                { icon: Bell, label: "Notifications", desc: "Manage push and email alerts" },
                                { icon: Shield, label: "Security & Privacy", desc: "Password and 2FA settings" },
                                { icon: Settings, label: "App Preferences", desc: "Theme and language settings" }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 hover:bg-white/[0.02] rounded-xl transition-colors group cursor-pointer border border-transparent hover:border-white/[0.02]">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-[#111] border border-white/[0.05] flex items-center justify-center text-[#888] group-hover:text-white group-hover:border-white/10 transition-all">
                                            <item.icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-white group-hover:text-[#F44A22] transition-colors">{item.label}</h4>
                                            <p className="text-xs text-[#666]">{item.desc}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-white transition-colors" />
                                </div>
                            ))}
                        </div>
                    </StudioCard>
                </div>
            </div>
        </div>
    );
}
