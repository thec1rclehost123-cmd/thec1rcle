"use client";

import type { ReactNode } from "react";
import { IN_LOCALE, IST_TIMEZONE } from "@c1rcle/core/time";

type DateLocaleMethod = (
    this: Date,
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions,
) => string;

const PATCH_KEY = "__c1rcle_partner_dashboard_time_patch__";

function hasTimeOptions(options?: Intl.DateTimeFormatOptions) {
    return Boolean(
        options &&
        (options.hour || options.minute || options.second || options.timeStyle),
    );
}

function normalizeOptions(
    method: "toLocaleString" | "toLocaleDateString" | "toLocaleTimeString",
    options?: Intl.DateTimeFormatOptions,
) {
    const normalized: Intl.DateTimeFormatOptions = {
        ...(options || {}),
        timeZone: options?.timeZone || IST_TIMEZONE,
    };

    if (method === "toLocaleTimeString" || hasTimeOptions(options) || (method === "toLocaleString" && !options)) {
        normalized.hour12 = true;
    }

    return normalized;
}

function applyPartnerDashboardDatePatch() {
    const globalState = globalThis as typeof globalThis & Record<string, unknown>;
    if (globalState[PATCH_KEY]) return;

    globalState[PATCH_KEY] = true;

    const originalToLocaleString = Date.prototype.toLocaleString as DateLocaleMethod;
    const originalToLocaleDateString = Date.prototype.toLocaleDateString as DateLocaleMethod;
    const originalToLocaleTimeString = Date.prototype.toLocaleTimeString as DateLocaleMethod;

    Date.prototype.toLocaleString = (function patchedToLocaleString(
        this: Date,
        locales?: string | string[],
        options?: Intl.DateTimeFormatOptions,
    ) {
        return originalToLocaleString.call(
            this,
            locales || IN_LOCALE,
            normalizeOptions("toLocaleString", options),
        );
    }) as typeof Date.prototype.toLocaleString;

    Date.prototype.toLocaleDateString = (function patchedToLocaleDateString(
        this: Date,
        locales?: string | string[],
        options?: Intl.DateTimeFormatOptions,
    ) {
        return originalToLocaleDateString.call(
            this,
            locales || IN_LOCALE,
            normalizeOptions("toLocaleDateString", options),
        );
    }) as typeof Date.prototype.toLocaleDateString;

    Date.prototype.toLocaleTimeString = (function patchedToLocaleTimeString(
        this: Date,
        locales?: string | string[],
        options?: Intl.DateTimeFormatOptions,
    ) {
        return originalToLocaleTimeString.call(
            this,
            locales || IN_LOCALE,
            normalizeOptions("toLocaleTimeString", options),
        );
    }) as typeof Date.prototype.toLocaleTimeString;
}

applyPartnerDashboardDatePatch();

export function PartnerDashboardTimezoneProvider({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
