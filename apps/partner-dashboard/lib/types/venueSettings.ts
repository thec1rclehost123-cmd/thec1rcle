export interface VenueNotificationPreferences {
    revenueUpdates: boolean;
    partnerRequests: boolean;
    securityAudit: boolean;
    productAnnouncements: boolean;
}

export interface VenueSecuritySettings {
    twoFactorEnabled: boolean;
    masterPasswordUpdatedAt: string | null;
}

export interface VenueSettings {
    venueId: string;
    adminEmail: string;
    supportHotline: string;
    operationalTimezone: string;
    primaryLanguage: string;
    bankAccountName: string;
    bankAccountMasked: string;
    settlementCadence: "daily" | "weekly" | "monthly";
    notifications: VenueNotificationPreferences;
    security: VenueSecuritySettings;
    updatedAt: string;
    updatedBy: string | null;
    _version: number;
}

