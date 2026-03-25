import { FieldValue } from 'firebase-admin/firestore';

type ScannerSummaryIncrements = {
    totalScans?: number;
    checkedIn?: number;
    duplicateScans?: number;
    invalidScans?: number;
    manualCheckIns?: number;
    doorEntries?: number;
    doorRevenue?: number;
    walkIns?: number;
};

type ScannerLogRecord = {
    eventId: string;
    venueId?: string | null;
    orderId?: string | null;
    ticketId?: string | null;
    guestId?: string | null;
    guestDisplayName: string;
    guestType?: string | null;
    result: string;
    source: string;
    scannedAt?: string;
    deviceId?: string | null;
    deviceName?: string | null;
    operatorUid?: string | null;
    operatorName?: string | null;
    operatorRole?: string | null;
    gate?: string | null;
    ticketTierId?: string | null;
    ticketTierName?: string | null;
};

type ScannerDeviceState = {
    eventId: string;
    venueId?: string | null;
    deviceId: string;
    deviceName?: string | null;
    operatorUid?: string | null;
    operatorName?: string | null;
    operatorRole?: string | null;
    gate?: string | null;
    pairedAt?: string;
    lastScanAt?: string | null;
    lastScanResult?: string | null;
    validScans?: number;
    duplicateScans?: number;
    invalidScans?: number;
};

type ScannerSummaryData = {
    checkedIn: number;
    doorEntries: number;
    doorRevenue: number;
    walkIns: number;
    totalScans: number;
    duplicateScans: number;
    invalidScans: number;
    manualCheckIns: number;
    entryTypeCounts: Record<string, number>;
    totalEntered: number;
};

function buildEntryTypeIncrement(entryType: string | undefined, quantity: number): Record<string, any> {
    const normalized = (entryType || 'general')
        .replace(/[^\w-]+/g, '_')
        .toLowerCase();

    return {
        [`entryTypeCounts.${normalized}`]: FieldValue.increment(quantity),
    };
}

export async function getScannerSummarySnapshot(db: any, eventId: string): Promise<ScannerSummaryData> {
    const summaryDoc = await db.collection('scan_logs').doc(eventId).get();
    const data = summaryDoc.exists ? summaryDoc.data() : {};

    const checkedIn = Number(data?.checkedIn || 0);
    const doorEntries = Number(data?.doorEntries || 0);
    const doorRevenue = Number(data?.doorRevenue || 0);
    const walkIns = Number(data?.walkIns || 0);

    return {
        checkedIn,
        doorEntries,
        doorRevenue,
        walkIns,
        totalScans: Number(data?.totalScans || 0),
        duplicateScans: Number(data?.duplicateScans || 0),
        invalidScans: Number(data?.invalidScans || 0),
        manualCheckIns: Number(data?.manualCheckIns || 0),
        entryTypeCounts: data?.entryTypeCounts || {},
        totalEntered: checkedIn + doorEntries + walkIns,
    };
}

export async function updateScannerSummary(
    db: any,
    eventId: string,
    venueId: string | null | undefined,
    increments: ScannerSummaryIncrements,
    when = new Date().toISOString(),
    extra: Record<string, any> = {},
): Promise<void> {
    const updates: Record<string, any> = {
        eventId,
        venueId: venueId || null,
        lastUpdatedAt: when,
        ...extra,
    };

    for (const [key, value] of Object.entries(increments)) {
        if (!value) continue;
        updates[key] = FieldValue.increment(value);
    }

    await db.collection('scan_logs').doc(eventId).set(updates, { merge: true });
}

export async function recordScannerLiveEvent(
    db: any,
    record: ScannerLogRecord,
    increments: ScannerSummaryIncrements = {},
    options: { checkedInIncrement?: number; entryType?: string; entryTypeQuantity?: number } = {},
): Promise<void> {
    const scannedAt = record.scannedAt || new Date().toISOString();
    const scanId = db.collection('scan_logs').doc(record.eventId).collection('scans').doc().id;

    const liveRecord = {
        scanId,
        eventId: record.eventId,
        venueId: record.venueId || null,
        orderId: record.orderId || null,
        ticketId: record.ticketId || null,
        guestId: record.guestId || null,
        guestDisplayName: record.guestDisplayName,
        guestType: record.guestType || null,
        result: record.result,
        source: record.source,
        scannedAt,
        deviceId: record.deviceId || null,
        deviceName: record.deviceName || null,
        operatorUid: record.operatorUid || null,
        operatorName: record.operatorName || null,
        operatorRole: record.operatorRole || null,
        gate: record.gate || null,
        ticketTierId: record.ticketTierId || null,
        ticketTierName: record.ticketTierName || null,
    };

    const summaryExtra = options.entryType && options.entryTypeQuantity
        ? buildEntryTypeIncrement(options.entryType, options.entryTypeQuantity)
        : {};

    await Promise.all([
        db.collection('scan_logs').doc(record.eventId).collection('scans').doc(scanId).set(liveRecord),
        db.collection('events').doc(record.eventId).collection('scan_logs').doc(scanId).set({
            scannedAt,
            result: record.result,
            deviceId: record.deviceId || null,
            deviceName: record.deviceName || null,
            operatorName: record.operatorName || null,
            gate: record.gate || null,
        }),
        updateScannerSummary(db, record.eventId, record.venueId, increments, scannedAt, summaryExtra),
        db.collection('events').doc(record.eventId).set({
            lastScanAt: scannedAt,
            ...(options.checkedInIncrement
                ? { checkedInCount: FieldValue.increment(options.checkedInIncrement) }
                : {}),
        }, { merge: true }),
    ]);
}

export async function upsertScannerDeviceState(
    db: any,
    state: ScannerDeviceState,
    when = new Date().toISOString(),
): Promise<void> {
    const sessionRef = db.collection('scanner_sessions').doc(state.eventId);
    const deviceRef = sessionRef.collection('devices').doc(state.deviceId);

    const sessionUpdate: Record<string, any> = {
        eventId: state.eventId,
        venueId: state.venueId || null,
        lastActivityAt: when,
    };
    if (state.pairedAt) {
        sessionUpdate.sessionStartedAt = state.pairedAt;
    }

    const deviceUpdate: Record<string, any> = {
        deviceId: state.deviceId,
        deviceName: state.deviceName || 'C1RCLE Scanner',
        operatorUid: state.operatorUid || null,
        operatorName: state.operatorName || 'Scanner',
        operatorRole: state.operatorRole || 'door_staff',
        boundGate: state.gate || null,
        lastHeartbeat: when,
        lastScanAt: state.lastScanAt || null,
        lastScanResult: state.lastScanResult || null,
    };

    if (state.pairedAt) {
        deviceUpdate.pairedAt = state.pairedAt;
    }
    if (state.validScans) {
        deviceUpdate.validScans = FieldValue.increment(state.validScans);
    }
    if (state.duplicateScans) {
        deviceUpdate.duplicateScans = FieldValue.increment(state.duplicateScans);
    }
    if (state.invalidScans) {
        deviceUpdate.invalidScans = FieldValue.increment(state.invalidScans);
    }

    await Promise.all([
        sessionRef.set(sessionUpdate, { merge: true }),
        deviceRef.set(deviceUpdate, { merge: true }),
    ]);
}
