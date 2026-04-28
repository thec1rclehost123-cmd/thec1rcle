import { scannerFetch } from "./client";
import { getActiveCode } from "./eventCode";

export interface DoorEntryRequest {
    eventCode: string;
    eventId: string;
    guestName: string;
    guestPhone?: string;
    tierId: string;
    tierName: string;
    entryType: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    paymentMethod: "cash" | "upi" | "card";
    gate?: string;
}

export interface DoorEntryResponse {
    success: boolean;
    entryId?: string;
    error?: string;
}

/**
 * Create a door / walk-in entry for a guest who is paying at the door.
 */
export async function createDoorEntry(request: DoorEntryRequest): Promise<DoorEntryResponse> {
    const code = await getActiveCode() || request.eventCode;

    try {
        const data = await scannerFetch(
            "/api/scanner/walk-in",
            {
                method: "POST",
                body: JSON.stringify({
                    eventId: request.eventId,
                    guestName: request.guestName,
                    guestPhone: request.guestPhone,
                    tierId: request.tierId,
                    tierName: request.tierName,
                    entryType: request.entryType,
                    quantity: request.quantity,
                    unitPrice: request.unitPrice,
                    totalAmount: request.totalAmount,
                    paymentMethod: request.paymentMethod,
                    gate: request.gate,
                }),
            },
            code
        );

        return { success: true, entryId: data.entryId };

    } catch (error: any) {
        console.error("[createDoorEntry] Error:", error);

        if (__DEV__) {
            return {
                success: true,
                entryId: `DEV-${Date.now().toString(36).toUpperCase()}`,
            };
        }

        return {
            success: false,
            error: error.data?.error || error.message || "Failed to create entry",
        };
    }
}
