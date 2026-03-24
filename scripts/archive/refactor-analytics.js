const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/partner-dashboard/components/analytics/UnifiedAnalyticsClient.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const splitMarker = '// ── Section: KPI Grid ─────────────────────────────────────────────────────────';
const splitIndex = content.indexOf(splitMarker);

if (splitIndex === -1) {
    console.error("Split marker not found");
    process.exit(1);
}

const beforeSections = content.substring(0, splitIndex);
const sections = content.substring(splitIndex);

// We need the imports and lazy components from `beforeSections` to put in the new sections file.
// Let's find where the `export default function UnifiedAnalyticsClient` starts.
const clientStartMarker = '// ── Main client ───────────────────────────────────────────────────────────────';
const clientStartIndex = content.indexOf(clientStartMarker);

const importsAndHelpers = content.substring(0, clientStartIndex).replace('"use client";\n', '"use client";\nimport { LegendDot } from "@/components/ui/VenueChart";\n');

// Make the section functions exported
let modifiedSections = sections.replace(/function (KPISection|PerformanceRingsSection|RevenueSection|TicketsGuestlistSection|AudienceSection|FunnelSection|ScannerSection|EventComparisonSection|SourceHeatmapSection|FinanceSection|TableSection|InsightsSection|RadialRing)/g, 'export function $1');

const sectionsFileContent = importsAndHelpers + '\n' + modifiedSections;

const sectionsDirPath = path.join(__dirname, 'apps/partner-dashboard/components/analytics/sections');
if (!fs.existsSync(sectionsDirPath)) fs.mkdirSync(sectionsDirPath, { recursive: true });

fs.writeFileSync(path.join(sectionsDirPath, 'index.tsx'), sectionsFileContent);

// Now update UnifiedAnalyticsClient to import these sections
const remainingClientImports = `
"use client";

import { useState } from "react";
import { Info, RefreshCw } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import StudioShell from "@/components/studio/StudioShell";
import { useQuery } from "@tanstack/react-query";
import { normalizeAnalyticsData } from "@/lib/analytics/zeroState";

import {
    KPISection,
    PerformanceRingsSection,
    RevenueSection,
    TicketsGuestlistSection,
    AudienceSection,
    FunnelSection,
    ScannerSection,
    EventComparisonSection,
    SourceHeatmapSection,
    FinanceSection,
    TableSection,
    InsightsSection
} from "./sections";

type DateRange = { from: Date; to: Date } | undefined;
function subDays(date: Date, days: number): Date {
    return new Date(date.getTime() - days * 86_400_000);
}

const CATEGORY_MAP: Record<string, { title: string; desc: string }> = {
    overview: { title: "Analytics Overview", desc: "Complete performance summary — revenue, attendance, funnel, and operations." },
    timeline: { title: "Timing Intelligence", desc: "Deep dive into booking windows, peak hours, and seasonal trends." },
    reach: { title: "Demand & Reach", desc: "Analyze purchase intent, ticket sales trends, and source performance." },
    engagement: { title: "Turnout & Engagement", desc: "Track fill rates, attendance consistency, and no-show analysis." },
    revenue: { title: "Money Intelligence", desc: "Detailed breakdown of revenue, platform fees, and finance status." },
    audience: { title: "Crowd & Audience", desc: "Demographics, loyalty patterns, and guest quality scores." },
    ops: { title: "Gate & Operations", desc: "Scanner efficiency, entry velocity, and door management metrics." },
    attribution: { title: "Partner Attribution", desc: "Performance tracking for hosts, promoters, and external sources." }
};
`;

const unifiedClientComponent = content.substring(clientStartIndex, splitIndex);

fs.writeFileSync(filePath, remainingClientImports + '\n' + unifiedClientComponent);

console.log("Refactoring complete.");
