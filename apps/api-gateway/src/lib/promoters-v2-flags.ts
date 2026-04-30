export const PROMOTERS_V2_FLAGS = {
    ROUTES: 'promoters_v2_routes',
    SHADOW_WRITE: 'promoters_v2_shadow_write',
    PARITY_LOG: 'promoters_v2_parity_log',
    READ_OVERVIEW: 'promoters_v2_read_overview',
    READ_LINKS: 'promoters_v2_read_links',
    READ_ANALYTICS: 'promoters_v2_read_analytics',
    READ_EVENTS: 'promoters_v2_read_events',
    READ_FINANCE: 'promoters_v2_read_finance',
} as const;

export type PromotersV2FlagName =
    typeof PROMOTERS_V2_FLAGS[keyof typeof PROMOTERS_V2_FLAGS];
