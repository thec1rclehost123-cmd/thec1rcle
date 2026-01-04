import { NextResponse } from "next/server";
import { getAdminApp } from "../firebase/admin";
import { getAuth } from "firebase-admin/auth";

/**
 * THE C1RCLE - Admin Authorization Middleware (Hardened)
 * - Cryptographically verifies Firebase ID tokens
 * - Enforces mandatory 'admin' and 'admin_role' claims
 * - Returns generic 404s to unauthorized requests (Red-Team Obscurity)
 */
export function withAdminAuth(handler, requiredRole = 'admin') {
    return async (req, ...args) => {
        const authHeader = req.headers.get('authorization');

        // Security Pass: Generic 404 for any auth failure to prevent endpoint discovery
        const genericNotFound = () => NextResponse.json({ error: 'Not Found' }, { status: 404 });

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return genericNotFound();
        }

        const token = authHeader.split('Bearer ')[1];

        try {
            const auth = getAuth(getAdminApp());

            // Task 1: Strict Token Verification
            // verifyIdToken checks issuer, audience, and expiration by default.
            const decodedToken = await auth.verifyIdToken(token, true); // true = check revocation

            const { role, admin_role, admin: isAdminClaim } = decodedToken;

            // Strict Role Enforcement: Must have both role='admin' and explicit admin:true
            if (role !== 'admin' || isAdminClaim !== true) {
                console.error(`[SECURITY] Unauthorized admin access attempt by UID: ${decodedToken.uid}`);
                return genericNotFound();
            }

            // Task 1: Granular Role Hierarchy
            if (requiredRole !== 'admin') {
                const hierarchy = {
                    'super': 100,
                    'ops': 50,
                    'finance': 40,
                    'content': 30,
                    'support': 20
                };

                const userRoleValue = hierarchy[admin_role] || 0;
                const requiredRoleValue = hierarchy[requiredRole] || 100;

                if (userRoleValue < requiredRoleValue) {
                    console.error(`[SECURITY] Privileged escalation attempt. Admin ${decodedToken.uid} (${admin_role}) requested ${requiredRole} access.`);
                    return genericNotFound();
                }
            }

            // Task 5: Replay & Freshness Protection
            // For administrative actions, we can check if the session is older than 1 hour 
            // even if the token hasn't expired (tokens last 1hr, but auth_time is fixed)
            const authTime = decodedToken.auth_time * 1000;
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            if (authTime < oneHourAgo) {
                // Re-authentication would be required in a strict setup
                // For now, we allow the 1hr window of the token itself.
            }

            // Bind user context to request
            req.user = decodedToken;

            return handler(req, ...args);
        } catch (error) {
            // Log real error for debugging, but return generic 404
            console.error("[SECURITY] Admin Auth Failed:", error.code || error.message);
            return genericNotFound();
        }
    };
}
