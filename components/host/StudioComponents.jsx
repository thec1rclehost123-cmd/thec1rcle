"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import {
    ArrowUpRight,
    ArrowDownRight,
    MoreHorizontal,
    Calendar as CalendarIcon
} from "lucide-react";

// --- Design System: "C1RCLE: ETHER" ---
// Aesthetic: "World Class" Polish.
// Key Elements: Inner Borders, Subtle Gradients, Noise Texture, Perfect Typography.

const COLORS = {
    background: "#000000",
    card: "#0A0A0A",
    cardBorder: "rgba(255, 255, 255, 0.08)",
    primary: "#F44A22",
    success: "#C6F432",
    text: {
        main: "#FFFFFF",
        muted: "#888888"
    }
};

export const StudioCard = ({ children, className = "", delay = 0, noPadding = false }) => (
    <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }} // "Apple-like" spring
        className={`relative overflow-hidden rounded-[32px] group ${className}`}
        style={{
            background: "linear-gradient(180deg, #111111 0%, #050505 100%)",
        }}
    >
        {/* 1. Top Highlight (The "Expensive" Detail) */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />

        {/* 2. Subtle Border */}
        <div className="absolute inset-0 rounded-[32px] border border-white/[0.06] pointer-events-none" />

        {/* 3. Inner Glow on Hover */}
        <div className="absolute inset-0 bg-[radial-gradient(800px_circle_at_var(--mouse-x,50%)_var(--mouse-y,50%),rgba(255,255,255,0.03),transparent_40%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        <div className={`relative z-10 ${noPadding ? "" : "p-8"}`}>{children}</div>
    </motion.div>
);

export const MetricCard = ({ title, value, change, trend = "up", icon: Icon, delay }) => (
    <StudioCard delay={delay} className="hover:shadow-[0_0_30px_-10px_rgba(244,74,34,0.15)] transition-shadow duration-500">
        <div className="flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[#888] group-hover:text-white group-hover:border-white/10 transition-colors">
                        <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-[#888] text-sm font-medium tracking-wide">{title}</h3>
                </div>

                {change && (
                    <div className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${trend === "up"
                        ? "bg-[#C6F432]/10 text-[#C6F432] border-[#C6F432]/20"
                        : "bg-white/5 text-white border-white/10"
                        }`}>
                        {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {change}
                    </div>
                )}
            </div>

            <div>
                <div className="text-[40px] leading-none font-heading font-bold text-white tracking-tight mb-2">{value}</div>
                <div className="text-xs text-[#555] font-medium flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#333]" />
                    Compared to last week
                </div>
            </div>
        </div>
    </StudioCard>
);

// --- Charts ---

export const RevenueChart = () => {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    // Smooth Curve Data
    const points = [20, 45, 35, 55, 45, 70, 60, 85, 75, 95, 85, 100];
    const max = 120;
    const width = 100;
    const height = 50;

    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const index = Math.min(
            points.length - 1,
            Math.max(0, Math.round((x / rect.width) * (points.length - 1)))
        );
        setHoveredIndex(index);
    };

    // Generate Smooth Bezier Path
    const generateSmoothPath = (points, width, height) => {
        let path = `M 0 ${height - (points[0] / max) * height}`;
        for (let i = 0; i < points.length - 1; i++) {
            const x0 = (i / (points.length - 1)) * width;
            const y0 = height - (points[i] / max) * height;
            const x1 = ((i + 1) / (points.length - 1)) * width;
            const y1 = height - (points[i + 1] / max) * height;
            const cp1x = x0 + (x1 - x0) / 2;
            const cp1y = y0;
            const cp2x = x0 + (x1 - x0) / 2;
            const cp2y = y1;
            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x1} ${y1}`;
        }
        return path;
    };

    const pathD = generateSmoothPath(points, width, height);

    return (
        <div className="w-full h-48 relative mt-8 select-none">
            {/* Chart Area */}
            <div
                className="absolute inset-0 cursor-crosshair"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredIndex(null)}
            >
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
                    <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#F44A22" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#F44A22" stopOpacity="0" />
                        </linearGradient>
                        {/* Glow Filter */}
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Grid Lines (Subtle) */}
                    {[20, 40, 60, 80].map((x) => (
                        <line
                            key={x}
                            x1={x}
                            y1="0"
                            x2={x}
                            y2={height}
                            stroke="white"
                            strokeOpacity="0.03"
                            strokeWidth="0.2"
                        />
                    ))}

                    {/* Area Fill */}
                    <path
                        d={`${pathD} L ${width} ${height} L 0 ${height} Z`}
                        fill="url(#chartGradient)"
                    />

                    {/* Main Line with Glow */}
                    <path
                        d={pathD}
                        fill="none"
                        stroke="#F44A22"
                        strokeWidth="0.8"
                        filter="url(#glow)"
                        vectorEffect="non-scaling-stroke"
                    />

                    {/* Hover Effect */}
                    {hoveredIndex !== null && (
                        <g>
                            <line
                                x1={(hoveredIndex / (points.length - 1)) * width}
                                y1="0"
                                x2={(hoveredIndex / (points.length - 1)) * width}
                                y2={height}
                                stroke="white"
                                strokeOpacity="0.1"
                                strokeWidth="0.5"
                            />
                            <circle
                                cx={(hoveredIndex / (points.length - 1)) * width}
                                cy={height - (points[hoveredIndex] / max) * height}
                                r="2"
                                fill="#000"
                                stroke="#C6F432"
                                strokeWidth="1"
                            />
                        </g>
                    )}
                </svg>

                {/* Floating Tooltip */}
                {hoveredIndex !== null && (
                    <div
                        className="absolute top-0 bg-[#111]/90 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold px-3 py-1.5 rounded-full transform -translate-x-1/2 -translate-y-full pointer-events-none shadow-xl z-20 flex items-center gap-2"
                        style={{ left: `${(hoveredIndex / (points.length - 1)) * 100}%`, top: `${((height - (points[hoveredIndex] / max) * height) / height) * 100}%` }}
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-[#C6F432]" />
                        <span>₹{points[hoveredIndex]}k</span>
                    </div>
                )}
            </div>

            {/* X Axis */}
            <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-[10px] text-[#444] font-medium uppercase tracking-wider">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                    <span key={d}>{d}</span>
                ))}
            </div>
        </div>
    );
};

export const DemographicsChart = () => {
    const data = [
        { label: "18-21", value: 15, color: "#1A1A1A" },
        { label: "21-25", value: 45, color: "#F44A22" }, // Orange
        { label: "25-30", value: 25, color: "#C6F432" }, // Acid Green
        { label: "30+", value: 15, color: "#1A1A1A" },
    ];

    return (
        <div className="flex items-end gap-4 h-40 mt-4">
            {data.map((item, i) => (
                <div key={item.label} className="flex-1 flex flex-col items-center gap-3 group h-full justify-end">
                    <div className="w-full relative flex-1 flex items-end bg-white/[0.02] rounded-2xl overflow-hidden border border-white/[0.02]">
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${item.value}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1 }}
                            className="w-full relative rounded-t-2xl"
                            style={{ backgroundColor: item.color }}
                        />
                    </div>
                    <span className="text-[10px] font-bold text-[#444] group-hover:text-white transition-colors">{item.label}</span>
                </div>
            ))}
        </div>
    );
};

export const GeoList = () => {
    const locations = [
        { city: "Mumbai", percent: 42 },
        { city: "Bangalore", percent: 28 },
        { city: "Delhi", percent: 15 },
        { city: "Pune", percent: 10 },
        { city: "Goa", percent: 5 },
    ];

    return (
        <div className="space-y-5 mt-4">
            {locations.map((loc, i) => (
                <div key={loc.city} className="flex items-center gap-4 group">
                    <div className="w-24 text-xs font-bold text-[#666] group-hover:text-white transition-colors">{loc.city}</div>
                    <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${loc.percent}%` }}
                            transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                            className="h-full rounded-full bg-white group-hover:bg-[#C6F432] transition-colors"
                        />
                    </div>
                    <div className="w-8 text-right text-xs font-bold text-white">{loc.percent}%</div>
                </div>
            ))}
        </div>
    );
};

export const GenderChart = () => {
    const data = [
        { label: "Female", value: 45, color: "#F44A22" },
        { label: "Male", value: 40, color: "#C6F432" },
        { label: "Other", value: 15, color: "#FFFFFF" },
    ];

    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    let currentOffset = 0;

    return (
        <div className="flex items-center gap-8 h-48 mt-4 px-4">
            <div className="relative w-32 h-32 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                    {data.map((item, i) => {
                        const strokeDasharray = `${(item.value / 100) * circumference} ${circumference}`;
                        const strokeDashoffset = -currentOffset;
                        currentOffset += (item.value / 100) * circumference;

                        return (
                            <motion.circle
                                key={item.label}
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="transparent"
                                stroke={item.color}
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                                initial={{ opacity: 0, pathLength: 0 }}
                                animate={{ opacity: 1, pathLength: 1 }}
                                transition={{ duration: 1, delay: i * 0.2 }}
                                className="drop-shadow-[0_0_4px_rgba(0,0,0,0.5)]"
                            />
                        );
                    })}
                    <text x="50" y="50" textAnchor="middle" dy="0.3em" fill="white" fontSize="14" fontWeight="bold" className="transform rotate-90">
                        100%
                    </text>
                </svg>
            </div>

            <div className="flex flex-col gap-4 flex-1">
                {data.map((item) => (
                    <div key={item.label} className="flex items-center justify-between group">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full transition-transform group-hover:scale-125" style={{ backgroundColor: item.color }} />
                            <span className="text-xs text-[#888] font-medium group-hover:text-white transition-colors">{item.label}</span>
                        </div>
                        <span className="text-xs font-bold text-white">{item.value}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const RealtimeTicker = () => {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#C6F432] rounded-full text-black shadow-[0_0_15px_rgba(198,244,50,0.3)]">
            <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Live</span>
        </div>
    );
};

export const QuickActionCard = ({ icon: Icon, label, onClick, delay = 0 }) => (
    <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.3 }}
        onClick={onClick}
        className="flex flex-col items-center justify-center gap-3 p-6 rounded-[32px] bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/10 transition-all group"
    >
        <div className="p-4 rounded-2xl bg-white/[0.05] group-hover:bg-white group-hover:text-black text-[#666] transition-all duration-300">
            <Icon className="w-6 h-6" />
        </div>
        <span className="text-xs font-bold text-[#666] group-hover:text-white transition-colors">{label}</span>
    </motion.button>
);
