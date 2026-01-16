import { getAdminDb } from "../firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * THE C1RCLE - Immutable Audit Logging System
 * Logs every administrative action for accountability and forensic recovery.
 * 
 * @param {Object} context - The admin user context from middleware (req.user)
 * @param {string} action - Action slug (e.g., 'VENUE_APPROVAL')
 * @param {Object} data - Payload containing before/after values or identifiers
 * @param {string} reason - Optional justification for the action
 */
export async function logAdminAction(context, action, data = {}, reason = "") {
    try {
        const db = getAdminDb();
        const { uid, email, admin_role } = context;

        const auditRef = db.collection('admin_audit_logs').doc();

        await auditRef.set({
            createdAt: FieldValue.serverTimestamp(),
            timestamp: new Date().toISOString(),
            admin_uid: uid,
            actorEmail: email, // Changed from admin_email for UI consistency
            admin_role: admin_role || 'admin',
            actionType: action.toUpperCase(), // Changed from action for UI consistency
            action: action.toUpperCase(), // Keep for backward compatibility
            metadata: data,
            targetId: data.targetId || 'unknown',
            reason: reason || 'Routine administrative task.',
            status: 'committed', // Every logged action is committed
            ip: context.ip || 'internal-node',
            userAgent: context.userAgent || 'system'
        });

        console.log(`[AUDIT] ${action} by ${email} (${uid})`);
        return true;
    } catch (error) {
        // We log to console if audit fails, but we don't necessarily want to crash the request 
        // unless it's a critical compliance environment. Usually, audit failure should block the action.
        console.error("[CRITICAL] Audit Logging Failed:", error.message);
        throw new Error("Action blocked: Audit logging failed. Security protocols active.");
    }
}
