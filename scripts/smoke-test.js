/**
 * THE C1RCLE - Daily Health Check (Resilient Smoke Test)
 * A script to verify platform readiness with DNS intelligence.
 */

import https from 'https';
import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

const services = [
    { name: 'Guest Portal', url: process.env.STAGING_GUEST_URL || 'https://staging.thec1rcle.com' },
    { name: 'Admin Console', url: process.env.STAGING_ADMIN_URL || 'https://staging-admin.thec1rcle.com' },
    { name: 'API Gateway', url: process.env.STAGING_API_URL || 'https://api-staging.thec1rcle.com/health' }
];

async function checkUrl(service) {
    try {
        const urlObj = new URL(service.url);

        // 1. Check if hostname is resolvable
        try {
            await lookup(urlObj.hostname);
        } catch (dnsErr) {
            console.warn(`⚠️ Warning: Hostname ${urlObj.hostname} for ${service.name} is NOT resolvable in DNS yet.`);
            console.log(`💡 Tip: If you just deployed, DNS might still be propagating or the domain isn't registered.`);
            // We report failure but keep going
            return false;
        }

        return new Promise((resolve) => {
            console.log(`🔍 Checking ${service.name} at ${service.url}...`);

            const timeout = setTimeout(() => {
                console.error(`❌ ${service.name} timed out.`);
                resolve(false);
            }, 10000);

            https.get(service.url, (res) => {
                clearTimeout(timeout);
                const isOk = res.statusCode >= 200 && res.statusCode < 400;
                if (isOk) {
                    console.log(`✅ ${service.name} is UP (Status: ${res.statusCode})`);
                } else {
                    console.error(`❌ ${service.name} is DOWN (Status: ${res.statusCode})`);
                }
                resolve(isOk);
            }).on('error', (err) => {
                clearTimeout(timeout);
                console.error(`❌ ${service.name} Error: ${err.message}`);
                resolve(false);
            });
        });
    } catch (e) {
        console.error(`❌ Invalid URL for ${service.name}: ${service.url}`);
        return false;
    }
}

async function runAll() {
    console.log('--- 🚀 Starting Daily Health Check ---');
    let allPassed = true;

    for (const service of services) {
        const result = await checkUrl(service);
        if (!result) allPassed = false;
    }

    console.log('---------------------------------------');
    if (allPassed) {
        console.log('🎉 All critical services are HEALTHY.');
        process.exit(0);
    } else {
        console.error('⚠️ One or more services are UNSTABLE or DNS is not configured.');
        // We still exit with 1 because and error is an error, but the logs are clearer now.
        process.exit(1);
    }
}

runAll();
