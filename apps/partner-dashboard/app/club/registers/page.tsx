"use client";

import { useState } from "react";
import {
    ClipboardList,
    AlertTriangle,
    Search,
    Plus,
    FileText,
    UserCheck,
    Package,
    Clock,
    CheckCircle2,
    MoreHorizontal
} from "lucide-react";

type LogType = "handover" | "incident" | "lost-found" | "vip";

interface RegisterLog {
    id: string;
    type: LogType;
    title: string;
    description: string;
    author: string;
    priority: "low" | "medium" | "high" | "critical";
    status: "open" | "resolved" | "archived";
    timestamp: Date;
    tags?: string[];
}

const MOCK_LOGS: RegisterLog[] = [
    {
        id: "1",
        type: "handover",
        title: "Ice Machine Maintenance",
        description: "Main bar ice machine is making noise, technician scheduled for tomorrow 2 PM.",
        author: "Rajesh (Bar Manager)",
        priority: "medium",
        status: "open",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    },
    {
        id: "2",
        type: "incident",
        title: "Glass breakage on Dance Floor",
        description: "Guest dropped a tray of shots. Area cleaned immediately. No injuries.",
        author: "Mike (Security)",
        priority: "low",
        status: "resolved",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    },
    {
        id: "3",
        type: "vip",
        title: "Mr. Kapoor Arrival",
        description: "Table VIP-1 reserved. Requested Beluga Vodka specifically.",
        author: "Sarah (Host)",
        priority: "high",
        status: "open",
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    },
    {
        id: "4",
        type: "lost-found",
        title: "Black iPhone 13",
        description: "Found under table DF-4. Screen cracked. Handed to security office.",
        author: "Amit (Waiter)",
        priority: "low",
        status: "open",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    }
];

const TYPE_ICONS = {
    handover: FileText,
    incident: AlertTriangle,
    "lost-found": Package,
    vip: UserCheck,
};

const PRIORITY_STYLES = {
    low: "bg-slate-100 text-slate-600 border-slate-200",
    medium: "bg-blue-50 text-blue-700 border-blue-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    critical: "bg-red-50 text-red-700 border-red-200",
};

export default function OpsRegistersPage() {
    const [activeTab, setActiveTab] = useState<LogType | "all">("all");
    const [logs] = useState<RegisterLog[]>(MOCK_LOGS);

    const filteredLogs = activeTab === "all"
        ? logs
        : logs.filter(log => log.type === activeTab);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Ops Registers
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Digital logbooks for handovers, incidents, and daily operations
                    </p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-sm">
                    <Plus className="h-4 w-4" />
                    New Log Entry
                </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-red-50 rounded-lg">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Open Incidents</p>
                        <p className="text-2xl font-bold text-slate-900">
                            {logs.filter(l => l.type === 'incident' && l.status === 'open').length}
                        </p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                        <UserCheck className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">VIPs Expected</p>
                        <p className="text-2xl font-bold text-slate-900">
                            {logs.filter(l => l.type === 'vip' && l.status === 'open').length}
                        </p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-orange-50 rounded-lg">
                        <Package className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lost Items</p>
                        <p className="text-2xl font-bold text-slate-900">
                            {logs.filter(l => l.type === 'lost-found' && l.status === 'open').length}
                        </p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg">
                        <ClipboardList className="h-6 w-6 text-slate-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Logs</p>
                        <p className="text-2xl font-bold text-slate-900">{logs.length}</p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Tabs & Search */}
                <div className="border-b border-slate-200 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
                            {[
                                { id: "all", label: "All Logs" },
                                { id: "handover", label: "Handovers" },
                                { id: "incident", label: "Incidents" },
                                { id: "vip", label: "VIP Log" },
                                { id: "lost-found", label: "Lost & Found" },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${activeTab === tab.id
                                            ? "bg-slate-900 text-white"
                                            : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search logs..."
                                className="pl-9 pr-4 py-2 w-full sm:w-64 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    </div>
                </div>

                {/* Logs List */}
                <div className="divide-y divide-slate-100">
                    {filteredLogs.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            <ClipboardList className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                            <p className="font-semibold">No logs found</p>
                        </div>
                    ) : (
                        filteredLogs.map((log) => {
                            const Icon = TYPE_ICONS[log.type];
                            return (
                                <div key={log.id} className="p-6 hover:bg-slate-50 transition-colors group">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-lg flex-shrink-0 ${log.type === 'incident' ? 'bg-red-50 text-red-600' :
                                                log.type === 'vip' ? 'bg-blue-50 text-blue-600' :
                                                    log.type === 'lost-found' ? 'bg-orange-50 text-orange-600' :
                                                        'bg-slate-100 text-slate-600'
                                            }`}>
                                            <Icon className="h-6 w-6" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between mb-1">
                                                <div>
                                                    <h3 className="text-base font-bold text-slate-900">{log.title}</h3>
                                                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                                        <span className="flex items-center gap-1 font-medium text-slate-700">
                                                            <UserCheck className="h-3 w-3" />
                                                            {log.author}
                                                        </span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${PRIORITY_STYLES[log.priority]}`}>
                                                        {log.priority}
                                                    </span>
                                                    {log.status === 'resolved' && (
                                                        <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-emerald-200">
                                                            Resolved
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
                                                {log.description}
                                            </p>
                                        </div>

                                        <div className="flex-shrink-0 self-center">
                                            <button className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition-colors opacity-0 group-hover:opacity-100">
                                                <MoreHorizontal className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
