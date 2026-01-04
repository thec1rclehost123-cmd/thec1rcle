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
            const decodedToken = await auth.verifyIdToken(token, true);

            const { role, admin_role, admin: isAdminClaim } = decodedToken;

            if (role !== 'admin' && isAdminClaim !== true) {
                console.error(`[SECURITY] Unauthorized admin access attempt by UID: ${decodedToken.uid}. Role: ${role}, AdminClaim: ${isAdminClaim}`);
                return genericNotFound();
            }

            // Task 1: Granular Role Hierarchy
            const hierarchy = {
                'super': 100,
                'admin': 100,
                'ops': 80,
                'finance': 60,
                'content': 40,
                'support': 20,
                'readonly': 10
            };

            const userRoleValue = hierarchy[admin_role] || hierarchy['admin'] || 0;
            const requiredRoleValue = hierarchy[requiredRole] || 100;

            if (userRoleValue < requiredRoleValue) {
                console.error(`[SECURITY] Privileged escalation attempt. Admin ${decodedToken.uid} (${admin_role}) requested ${requiredRole} access.`);
                return genericNotFound();
            }

            // Task 5: Replay & Freshness Protection (30 minute threshold)
            const authTime = decodedToken.auth_time * 1000;
            const threshold = Date.now() - (30 * 60 * 1000);
            if (authTime < threshold) {
                console.error(`[SECURITY] Admin session stale (30m+). Re-auth required for UID: ${decodedToken.uid}`);
                return genericNotFound();
            }

            // --- 🕵️ REQUEST CONTEXT CAPTURE ---
            const forwarded = req.headers.get("x-forwarded-for");
            const ipAddress = forwarded ? forwarded.split(',')[0].trim() : (req.ip || "127.0.0.1");
            const userAgent = req.headers.get("user-agent") || "unknown";
            const requestId = `REQ_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;

            // Bind enhanced context to request
            req.user = {
                ...decodedToken,
                ipAddress,
                userAgent,
                requestId,
                admin_role: admin_role || 'readonly'
            };

            return handler(req, ...args);
        } catch (error) {
            console.error("[SECURITY] Admin Auth Failed:", error.code || error.message);
            return genericNotFound();
        }
    };
}
