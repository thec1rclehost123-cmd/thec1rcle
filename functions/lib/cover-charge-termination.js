"use strict";
/**
 * Cover Wallet Termination Cloud Function
 *
 * Runs on two triggers:
 *   1. Scheduled: Every 15 minutes (catches the 5 AM window precisely)
 *   2. Event lifecycle change: When event.lifecycle transitions to 'completed'
 *
 * Idempotent: safe to run multiple times — expired wallets are already in EXPIRED state.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onEventCompleted = exports.sweepExpiredCoverWallets = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const cover_charge_engine_js_1 = require("../../packages/core/cover-charge-engine.js");
if (!admin.apps.length) {
    admin.initializeApp();
}
const logger = functions.logger;
// ---------------------------------------------------------------------------
// 1. Scheduled sweep — runs every 15 minutes
// ---------------------------------------------------------------------------
exports.sweepExpiredCoverWallets = functions.scheduler.onSchedule({
    schedule: 'every 15 minutes',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
}, async () => {
    var _a, _b;
    const db = admin.firestore();
    // Find all active wallets whose terminationTime has passed
    const now = new Date().toISOString();
    const expiredWalletsSnap = await db.collection('cover_wallets')
        .where('state', '==', 'ACTIVE')
        .where('rules.terminationTime', '<=', now)
        .get();
    if (expiredWalletsSnap.empty) {
        logger.info('[CoverWallet] No expired wallets to process');
        return;
    }
    // Group by eventId for batched reconciliation
    const eventIds = new Set();
    for (const doc of expiredWalletsSnap.docs) {
        eventIds.add(doc.data().eventId);
    }
    for (const eventId of eventIds) {
        try {
            const { terminated, errors } = await (0, cover_charge_engine_js_1.terminateExpiredWallets)(eventId);
            logger.info(`[CoverWallet] Event ${eventId}: terminated=${terminated}`);
            if (errors.length > 0) {
                logger.error(`[CoverWallet] Event ${eventId} errors: ${errors.join(', ')}`);
            }
            // Check if the event is completed — if so, generate reconciliation
            const eventDoc = await db.collection('events').doc(eventId).get();
            if (eventDoc.exists && ((_a = eventDoc.data()) === null || _a === void 0 ? void 0 : _a.lifecycle) === 'completed') {
                const venueId = ((_b = eventDoc.data()) === null || _b === void 0 ? void 0 : _b.venueId) || '';
                await (0, cover_charge_engine_js_1.generateReconciliation)(eventId, venueId);
                logger.info(`[CoverWallet] Reconciliation generated for event ${eventId}`);
            }
        }
        catch (err) {
            logger.error(`[CoverWallet] Failed to process event ${eventId}: ${err.message}`);
        }
    }
});
// ---------------------------------------------------------------------------
// 2. Event lifecycle trigger — when event transitions to 'completed'
// ---------------------------------------------------------------------------
exports.onEventCompleted = functions.firestore.onDocumentUpdated({
    document: 'events/{eventId}',
    region: 'asia-south1',
}, async (event) => {
    var _a, _b;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    if (before.lifecycle === after.lifecycle)
        return;
    if (after.lifecycle !== 'completed')
        return;
    const eventId = event.params.eventId;
    const venueId = after.venueId || '';
    logger.info(`[CoverWallet] Event ${eventId} completed — running termination sweep`);
    try {
        const { terminated, errors } = await (0, cover_charge_engine_js_1.terminateExpiredWallets)(eventId);
        logger.info(`[CoverWallet] Terminated ${terminated} wallets for event ${eventId}`);
        if (errors.length > 0) {
            logger.error(`[CoverWallet] Errors: ${errors.join(', ')}`);
        }
        await (0, cover_charge_engine_js_1.generateReconciliation)(eventId, venueId);
        logger.info(`[CoverWallet] Reconciliation generated for event ${eventId}`);
    }
    catch (err) {
        logger.error(`[CoverWallet] Failed to terminate/reconcile event ${eventId}: ${err.message}`);
    }
});
//# sourceMappingURL=cover-charge-termination.js.map