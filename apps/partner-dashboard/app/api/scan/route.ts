import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { createHmac } from "node:crypto";

const ORDERS_COLLECTION = "orders";
const SCANS_COLLECTION = "ticket_scans";
const BOUND_DEVICES_COLLECTION = "bound_devices";
const QR_SECRET = process.env.QR_SECRET_KEY || "c1rcle-qr-secret-2024";

// Scan result types
type ScanResult = 'valid' | 'already_scanned' | 'invalid' | 'wrong_event' | 'not_confirmed' | 'not_found' | 'device_invalid';

/**
 * POST /api/scan
 * Verify and process a ticket QR code scan
 * Enhanced with device validation and staff actor logging
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { qrData, scannedBy, eventId, deviceId, venueId } = body;

        if (!qrData) {
            return NextResponse.json(
                { error: "QR data is required" },
                { status: 400 }
            );
        }

        // Parse QR data
        let payload;
        try {
            if (typeof qrData === "string") {
                if (qrData.startsWith("{")) {
                    payload = JSON.parse(qrData);
                } else if (qrData.startsWith("c1r://")) {
                    // Short format: c1r://orderId/signature
                    const parts = qrData.replace("c1r://", "").split("/");
                    return NextResponse.json({
                        success: false,
                        error: "Short format requires full order lookup",
                        orderId: parts[0]
                    }, { status: 400 });
                }
            } else {
                payload = qrData;
            }
        } catch {
            return NextResponse.json({
                success: false,
                error: "Invalid QR code format",
                result: 'invalid' as ScanResult
            }, { status: 400 });
        }

        // Verify signature
        const dataToSign = `${payload.o}:${payload.e}:${payload.t}:${payload.u}:${payload.q}:${payload.ts}`;
        const expectedSignature = createHmac("sha256", QR_SECRET)
            .update(dataToSign)
            .digest("hex")
            .substring(0, 16);

        if (payload.sig !== expectedSignature) {
            // Log invalid scan attempt
            await logScanAttempt({
                orderId: payload.o,
                eventId: payload.e || eventId,
                result: 'invalid',
                reason: 'Signature mismatch',
                scannedBy,
                deviceId
            });

            return NextResponse.json({
                success: false,
                error: "Invalid QR code - signature mismatch",
                result: 'invalid' as ScanResult
            }, { status: 400 });
        }

        // Verify event matches if specified
        if (eventId && payload.e !== eventId) {
            await logScanAttempt({
                orderId: payload.o,
                eventId: eventId,
                ticketEventId: payload.e,
                result: 'wrong_event',
                reason: 'Ticket is for different event',
                scannedBy,
                deviceId
            });

            return NextResponse.json({
                success: false,
                error: "Ticket is not for this event",
                result: 'wrong_event' as ScanResult
            }, { status: 400 });
        }

        // Development mode fallback
        if (!isFirebaseConfigured()) {
            return NextResponse.json({
                success: true,
                result: 'valid' as ScanResult,
                ticket: {
                    orderId: payload.o,
                    eventId: payload.e,
                    ticketName: payload.n,
                    quantity: payload.q,
                    entryType: payload.et || "general",
                    userId: payload.u
                },
                message: "Ticket verified (development mode)"
            });
        }

        const db = getAdminDb();

        // Validate device if deviceId provided
        if (deviceId && venueId) {
            const deviceValidation = await validateDevice(db, deviceId, venueId);
            if (!deviceValidation.valid) {
                return NextResponse.json({
                    success: false,
                    error: deviceValidation.error,
                    result: 'device_invalid' as ScanResult
                }, { status: 403 });
            }
        }

        // Get the order
        const orderDoc = await db.collection(ORDERS_COLLECTION).doc(payload.o).get();

        if (!orderDoc.exists) {
            await logScanAttempt({
                orderId: payload.o,
                eventId: payload.e,
                result: 'not_found',
                reason: 'Order does not exist',
                scannedBy,
                deviceId
            });

            return NextResponse.json({
                success: false,
                error: "Order not found",
                result: 'not_found' as ScanResult
            }, { status: 404 });
        }

        const order = orderDoc.data();

        // Check order status
        if (order?.status !== "confirmed" && order?.status !== "checked_in") {
            await logScanAttempt({
                orderId: payload.o,
                eventId: payload.e,
                result: 'not_confirmed',
                reason: `Order status is ${order?.status}`,
                scannedBy,
                deviceId
            });

            return NextResponse.json({
                success: false,
                error: `Order status is ${order?.status}, not confirmed`,
                result: 'not_confirmed' as ScanResult
            }, { status: 400 });
        }

        // Check if already scanned (with ticket ID granularity)
        const existingScan = await db.collection(SCANS_COLLECTION)
            .where("orderId", "==", payload.o)
            .where("ticketId", "==", payload.t)
            .where("result", "==", "valid")
            .limit(1)
            .get();

        if (!existingScan.empty) {
            const scanData = existingScan.docs[0].data();

            // Log duplicate attempt
            await logScanAttempt({
                orderId: payload.o,
                eventId: payload.e,
                ticketId: payload.t,
                result: 'already_scanned',
                reason: 'Duplicate scan attempt',
                previousScanId: existingScan.docs[0].id,
                scannedBy,
                deviceId
            });

            return NextResponse.json({
                success: false,
                error: "Ticket already scanned",
                result: 'already_scanned' as ScanResult,
                previousScan: {
                    scannedAt: scanData.scannedAt,
                    scannedBy: {
                        name: scanData.scannedBy?.name,
                        role: scanData.scannedBy?.role
                    }
                }
            }, { status: 400 });
        }

        // Record the successful scan
        const now = new Date().toISOString();
        const scanRecord = {
            orderId: payload.o,
            eventId: payload.e,
            ticketId: payload.t,
            userId: payload.u,
            quantity: payload.q,
            entryType: payload.et || "general",

            // Result
            result: 'valid' as ScanResult,

            // Staff actor
            scannedBy: scannedBy ? {
                uid: scannedBy.uid,
                name: scannedBy.name || 'Unknown',
                role: scannedBy.role || 'staff',
                email: scannedBy.email
            } : { uid: 'unknown' },

            // Device info
            device: deviceId ? {
                id: deviceId,
                bound: true
            } : { id: null, bound: false },

            scannedAt: now,
            createdAt: now
        };

        const scanRef = await db.collection(SCANS_COLLECTION).add(scanRecord);

        // Update order status to checked_in if first successful scan
        if (order?.status === 'confirmed') {
            await db.collection(ORDERS_COLLECTION).doc(payload.o).update({
                status: 'checked_in',
                checkedInAt: now,
                lastScanId: scanRef.id
            });
        }

        // Get ticket details from order
        const ticket = order?.tickets?.find((t: any) => t.ticketId === payload.t);

        return NextResponse.json({
            success: true,
            result: 'valid' as ScanResult,
            scanId: scanRef.id,
            ticket: {
                orderId: payload.o,
                eventId: payload.e,
                eventTitle: order?.eventTitle || order?.eventName,
                ticketName: payload.n || ticket?.name,
                quantity: payload.q,
                entryType: payload.et || "general",
                userName: order?.userName,
                userEmail: order?.userEmail
            },
            message: `✓ Entry approved! Welcome, ${order?.userName || 'Guest'}.`
        });

    } catch (error: any) {
        console.error("[Scan API] POST Error:", error);
        return NextResponse.json(
            { error: error.message || "Scan failed" },
            { status: 500 }
        );
    }
}

/**
 * Validate device is authorized for this venue
 */
async function validateDevice(db: any, deviceId: string, venueId: string) {
    const snapshot = await db.collection(BOUND_DEVICES_COLLECTION)
        .where("deviceId", "==", deviceId)
        .where("venueId", "==", venueId)
        .where("status", "==", "active")
        .limit(1)
        .get();

    if (snapshot.empty) {
        return { valid: false, error: "Device not authorized for this venue" };
    }

    // Update last active time
    const deviceDoc = snapshot.docs[0];
    await deviceDoc.ref.update({ lastActiveAt: new Date().toISOString() });

    return { valid: true, device: { id: deviceDoc.id, ...deviceDoc.data() } };
}

/**
 * Log scan attempt (for both successful and failed scans)
 */
async function logScanAttempt(data: any) {
    if (!isFirebaseConfigured()) return;

    try {
        const db = getAdminDb();
        await db.collection(SCANS_COLLECTION).add({
            ...data,
            scannedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("[Scan API] Failed to log scan attempt:", error);
    }
}

/**
 * GET /api/scan
 * Get scan history for an event
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const eventId = searchParams.get("eventId");
        const limit = parseInt(searchParams.get("limit") || "100");
        const includeInvalid = searchParams.get("includeInvalid") === "true";

        if (!eventId) {
            return NextResponse.json(
                { error: "eventId is required" },
                { status: 400 }
            );
        }

        if (!isFirebaseConfigured()) {
            return NextResponse.json({ scans: [], totalScanned: 0, stats: {} });
        }

        const db = getAdminDb();
        let query = db.collection(SCANS_COLLECTION)
            .where("eventId", "==", eventId)
            .orderBy("scannedAt", "desc")
            .limit(limit);

        // By default only show valid scans
        if (!includeInvalid) {
            query = query.where("result", "==", "valid");
        }

        const snapshot = await query.get();
        const scans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Calculate stats
        const validScans = scans.filter((s: any) => s.result === 'valid');
        const totalScanned = validScans.reduce((sum, scan: any) => sum + (scan.quantity || 1), 0);

        // Group by entry type
        const byEntryType: Record<string, number> = {};
        validScans.forEach((scan: any) => {
            const et = scan.entryType || 'general';
            byEntryType[et] = (byEntryType[et] || 0) + (scan.quantity || 1);
        });

        return NextResponse.json({
            scans,
            totalScanned,
            stats: {
                totalScans: validScans.length,
                totalPeople: totalScanned,
                byEntryType,
                duplicateAttempts: scans.filter((s: any) => s.result === 'already_scanned').length
            }
        });
    } catch (error: any) {
        console.error("[Scan API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch scans" },
            { status: 500 }
        );
    }
}
