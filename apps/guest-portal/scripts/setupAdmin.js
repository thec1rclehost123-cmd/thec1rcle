const admin = require("firebase-admin");
const path = require("path");

/**
 * THE C1RCLE - Admin Role Utility
 * Use this to assign granular admin roles to UIDs.
 */

const serviceAccountPath = process.env.FIREBASE_ADMIN_SDK_PATH || path.resolve(__dirname, "../../Downloads/thec1rcle-india-firebase-adminsdk-fbsvc-7a42d7c601.json");

const serviceAccount = require(serviceAccountPath);
console.log(`Using Service Account for Project: ${serviceAccount.project_id}`);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

async function setAdminRole(identifier, adminRole = 'super') {
    const validRoles = ['super', 'ops', 'content', 'finance', 'support'];

    if (!validRoles.includes(adminRole)) {
        console.error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
        return;
    }

    let uid = identifier;

    // If identifier looks like an email, find the UID
    if (identifier.includes('@')) {
        try {
            const user = await admin.auth().getUserByEmail(identifier);
            uid = user.uid;
            console.log(`Found UID for email ${identifier}: ${uid}`);
        } catch (e) {
            console.error(`Error: User with email ${identifier} not found.`);
            return;
        }
    }

    try {
        await admin.auth().setCustomUserClaims(uid, {
            role: 'admin',
            admin_role: adminRole
        });
        console.log(`Success: User ${uid} is now assigned '${adminRole}' admin role.`);
    } catch (e) {
        console.error(`Error setting claims: ${e.message}`);
    }
}

const args = process.argv.slice(2);
if (args.length < 1) {
    console.log("Usage: node setupAdmin.js <uid> [admin_role]");
    process.exit(1);
}

setAdminRole(args[0], args[1]);
