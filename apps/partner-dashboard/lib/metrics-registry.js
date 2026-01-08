/**
 * THE C1RCLE Analytics Metrics Registry
 * Canonical definitions for all business metrics.
 */

export const METRICS = {
    // Category 1: Executive Overview
    TOTAL_ENTRIES: {
        id: "TOTAL_ENTRIES",
        name: "Total Entries",
        definition: "Total number of consumed entitlements across selected range.",
        formula: "count(entitlements where state = 'CONSUMED')",
        category: "overview"
    },
    ENTRY_CONVERSION_RATE: {
        id: "ENTRY_CONVERSION_RATE",
        name: "Entry Conversion Rate",
        definition: "Percentage of issued entitlements that were actually consumed (checked-in).",
        formula: "entries / issued_entitlements",
        category: "overview"
    },
    NO_SHOW_RATE: {
        id: "NO_SHOW_RATE",
        name: "No-show Rate",
        definition: "Percentage of issued entitlements that were not consumed.",
        formula: "(issued - consumed) / issued",
        category: "overview"
    },
    GROSS_REVENUE: {
        id: "GROSS_REVENUE",
        name: "Gross Revenue",
        definition: "Total money captured by the ledger for tickets and bookings.",
        formula: "sum(ledger_entries where state = 'CAPTURED')",
        category: "revenue"
    },
    REFUND_RATE: {
        id: "REFUND_RATE",
        name: "Refund Rate",
        definition: "Percentage of captured revenue that was refunded.",
        formula: "refunded_amount / captured_amount",
        category: "revenue"
    },

    // Category 2: Gate & Ops
    ENTRY_VELOCITY: {
        id: "ENTRY_VELOCITY",
        name: "Entry Velocity",
        definition: "Number of entries per minute or hour.",
        formula: "entries / time_window",
        category: "ops"
    },
    DENIAL_RATE: {
        id: "DENIAL_RATE",
        name: "Denial Rate",
        definition: "Percentage of scans that were denied at the gate.",
        formula: "denied_scans / total_scans",
        category: "ops"
    },

    // Category 3: Audience
    FEMALE_RATIO: {
        id: "FEMALE_RATIO",
        name: "Female Ratio",
        definition: "Percentage of entered guests who identify as female.",
        formula: "female_entries / total_entries",
        category: "audience"
    },
    REPEAT_VISITOR_RATE: {
        id: "REPEAT_VISITOR_RATE",
        name: "Repeat Visitor Rate",
        definition: "Percentage of guests who have visited the venue more than once.",
        formula: "repeat_guests / unique_guests",
        category: "audience"
    },

    // Category 4: Performance & Demand
    DEMAND_PRESSURE: {
        id: "DEMAND_PRESSURE",
        name: "Demand Pressure",
        definition: "Ratio of queue joins to available capacity/inventory.",
        formula: "queue_joins / total_inventory",
        category: "reach"
    },

    // Category 6: Attribution
    HOST_IMPACT: {
        id: "HOST_IMPACT",
        name: "Host Impact %",
        definition: "Percentage of total venue entries attributed to a specific host.",
        formula: "host_attributed_entries / venue_total_entries",
        category: "attribution"
    },
    VERIFIED_PROMOTER_ROI: {
        id: "VERIFIED_PROMOTER_ROI",
        name: "Verified Promoter ROI",
        definition: "Effective cost per verified entry (commission / entries).",
        formula: "commission_paid / verified_entries",
        category: "attribution"
    }
};

export const TIME_BINS = {
    LIVE: "5min",
    OPS: "15min",
    REPORTING: "1hour"
};

export const NIGHT_WINDOW = {
    START: 18, // 6 PM
    END: 6     // 6 AM next day
};
