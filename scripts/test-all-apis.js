import axios from 'axios';

const SERVICES = [
    { name: 'API Gateway', url: 'http://127.0.0.1:4000/health', port: 4000 },
    { name: 'Partner Dashboard', url: 'http://127.0.0.1:3001', port: 3001 },
    { name: 'Guest Portal', url: 'http://127.0.0.1:3000', port: 3000 },
    { name: 'Admin Console', url: 'http://127.0.0.1:3002', port: 3002 }
];

async function testService(service) {
    console.log(`📡 Testing ${service.name} (${service.url})...`);
    try {
        const start = Date.now();
        const res = await axios.get(service.url, { timeout: 10000 });
        const duration = Date.now() - start;

        console.log(`✅ ${service.name} is UP (Status: ${res.status}, Time: ${duration}ms)`);
        return true;
    } catch (err) {
        console.error(`❌ ${service.name} is DOWN or UNREACHABLE`);
        if (err.response) {
            console.error(`   - Status: ${err.response.status}`);
            console.error(`   - Data:`, JSON.stringify(err.response.data).substring(0, 100));
        } else {
            console.error(`   - Error: ${err.message}`);
        }
        return false;
    }
}

async function runAllTests() {
    console.log('🚀 Starting API Layer Verification...\n');
    let allUp = true;

    for (const service of SERVICES) {
        const success = await testService(service);
        if (!success) allUp = false;
        console.log('-----------------------------------');
    }

    if (allUp) {
        console.log('\n🌟 ALL API LAYERS ARE WORKING PROPERLY! 🌟');
    } else {
        console.log('\n⚠️ SOME API LAYERS ARE HAVING ISSUES! ⚠️');
        console.log('Please ensure the following services are running:');
        SERVICES.forEach(s => console.log(`   - ${s.name} (Port ${s.port})`));
        console.log('\nYou can start all services using: npm run dev');
    }
}

runAllTests();
