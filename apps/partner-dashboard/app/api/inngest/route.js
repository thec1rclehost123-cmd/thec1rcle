import { serve } from "inngest/next";
import { inngest } from "@c1rcle/core/inngest";
import {
    handleTicketFulfillment,
    sendEventReminders,
    processEventSettlement
} from "@c1rcle/core/workflows/ticketing";
import {
    syncEventToSearch,
    syncVenueToSearch,
    autoSyncOnPublish
} from "@c1rcle/core/workflows/search-sync";

/**
 * PRODUCTION INNGEST SERVE ENDPOINT
 * 
 * All background workflows for C1RCLE platform
 * 
 * Required Environment Variables:
 * - INNGEST_EVENT_KEY: For sending events
 * - INNGEST_SIGNING_KEY: For webhook verification
 */
export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
        // Ticketing & Orders
        handleTicketFulfillment,
        sendEventReminders,
        processEventSettlement,

        // Search & Discovery
        syncEventToSearch,
        syncVenueToSearch,
        autoSyncOnPublish,
    ],
});
