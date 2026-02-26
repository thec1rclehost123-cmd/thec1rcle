/**
 * THE C1RCLE - Daily Smoke Test
 * A lightweight script to verify that critical platform services are reachable.
 */

const https = require('https');

const services = [
    { name: 'Guest Portal', url: process.env.STAGING_GUEST_URL || 'https://staging.thec1rcle.com' },
    { name: 'Admin Console', url: process.env.STAGING_ADMIN_URL || 'https://staging-admin.thec1rcle.com' },
    { name: 'API Gateway', url: process.env.STAGING_API_URL || 'https://api-staging.thec1rcle.com/health' }
];

async function checkUrl(service) {
    return new Promise((resolve) => {
        console.log(`🔍 Checking ${service.name} at ${service.url}...`);

        // Timeout after 10 seconds
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
        console.error('⚠️ One or more services are UNSTABLE.');
        process.exit(1);
    }
}

runAll();
