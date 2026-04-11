import * as dotenv from 'dotenv';
import path from 'path';

// Load api-gateway env
const envPath = path.join(process.cwd(), 'apps/api-gateway/.env.development');
dotenv.config({ path: envPath });

let privateKey = process.env.FIREBASE_PRIVATE_KEY;

console.log("RAW Key starts with:", privateKey?.substring(0, 30));

if (privateKey?.startsWith('"') && privateKey?.endsWith('"')) {
    console.log("Removing outer quotes...");
    privateKey = privateKey.substring(1, privateKey.length - 1);
}

// Handle both double-escaped (\\n from tsx --env-file) and single-escaped (\n)
privateKey = privateKey?.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');

console.log("PARSED Key starts with:", privateKey?.substring(0, 30));
console.log("Contains newline?", privateKey?.includes('\n'));
console.log("Key length:", privateKey?.length);

if (privateKey && privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    console.log("Key format looks PEM-like.");
} else {
    console.log("Key format is NOT PEM-like!");
}
