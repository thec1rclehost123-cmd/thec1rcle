/**
 * cleanJargon Utility
 * Replaces technical or robotic system terminology with clear, 
 * and user-friendly language.
 */

const JARGON_MAP: Record<string, string> = {
    // Technical -> Friendly
    "migration": "Update",
    "migrated": "Updated",
    "audit_trail": "Activity",
    "lifecycle": "Status",
    "metadata": "Details",
    "denied": "Denied",
    "rejected": "Rejected",
    "submitted": "Submitted",
    "pitch": "Request",
    "staff": "Team",
    "members": "Members",
    "logs": "Activity",
    "analytics": "Analytics",
    "create": "Create",
    "management": "Management",
    "operating_calendar": "Calendar",
    "daily_dashboard": "Dashboard",
    "event_calendar": "Events",
    "my_events": "My Events",
    "security": "Security",
    "registers": "History",
    "tables": "Records",
    "vip": "Special",
    "hosts": "Hosts",
    "promoters": "Promoters",
    "ops": "Operations",
    "reliability": "Rating",
    "audience": "Audience",
    "strategy": "Plan",
    "reliability_score": "Score",
    "confirmed": "Confirmed",
    "reach": "Reach",
    "engagement": "Engagement",
    "revenue": "Revenue",
    "attribution": "Tracking",
    "payouts": "Payouts",
    "links": "Links",
    "guests": "Guests",
    "overview": "Overview",
    "account": "Account",
    "personal": "Personal",
    "profile": "Profile",
    "network": "Network",
    "analytics_studio": "Analytics",
    "sales_tools": "Tools",
    "earnings": "Earnings"
};

export function cleanJargon(text: string): string {
    if (!text) return text;

    // Normalize text (lowercase for mapping, but preserve original if no match)
    const normalized = text.toLowerCase().replace(/_/g, ' ');

    // Check for direct match
    if (JARGON_MAP[normalized]) {
        return JARGON_MAP[normalized];
    }

    // Check for underscores/snake_case and convert to Title Case as default
    return text
        .split(/[_-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}
