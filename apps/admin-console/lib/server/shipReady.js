import { getAdminDb } from "../firebase/admin";
import { RBAC_POLICY } from "./adminStore";

/**
 * THE C1RCLE - Production Gatekeeper
 * - Automated verification of security invariants
 * - Validation of audit integrity
 */
export const ShipGatekeeper = {
    async runPreflight() {
        const db = getAdminDb();
        const results = {
            timestamp: new Date().toISOString(),
            passed: true,
            checks: []
        };

        const addCheck = (name, status, detail) => {
            results.checks.push({ name, status: status ? 'PASSED' : 'FAILED', detail });
            if (!status) results.passed = false;
        };

        // 1. Audit Chain Integrity Check
        try {
            const metaDoc = await db.collection('admin_audit_config').doc('integrity_state').get();
            if (!metaDoc.exists) {
                addCheck("Audit Integrity", false, "Genesis state missing");
            } else {
                const logs = await db.collection('admin_audit_logs').orderBy('sequence', 'desc').limit(2).get();
                if (logs.size >= 2) {
                    const latest = logs.docs[0].data();
                    const previous = logs.docs[1].data();
                    addCheck("Chain Link Verification", latest.previousHash === previous.hash, "Hash continuity check");
                } else {
                    addCheck("Chain Link Verification", true, "Genesis sequence in progress");
                }
            }
        } catch (e) {
            addCheck("Audit Integrity", false, e.message);
        }

        // 2. RBAC Policy Consistency
        const roles = Object.keys(RBAC_POLICY);
        addCheck("RBAC Policy Enumeration", roles.includes('super') && roles.includes('ops'), "Base roles defined");

        // 3. Environment Proof
        addCheck("Environment Anchor", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'thec1rcle-india', "Production project match");

        return results;
    }
}
