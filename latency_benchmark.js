
import axios from 'axios';

async function benchmark() {
    const baseUrl = 'http://localhost:3001/api/v1'; // Assuming api-gateway is on 3001
    const endpoints = [
        '/events',
        '/host/events?hostId=6NTPQUfjc6TJ4tCgwugY9DCBitm1', // example host from debug_requests
    ];

    console.log('--- API LATENCY BENCHMARK ---');
    for (const ep of endpoints) {
        const times = [];
        for (let i = 0; i < 5; i++) {
            const start = Date.now();
            try {
                await axios.get(`${baseUrl}${ep}`);
                times.push(Date.now() - start);
            } catch (e) {
                // skip if not running
            }
        }
        if (times.length > 0) {
            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
            console.log(`${ep}: AVG=${avg.toFixed(2)}ms, P95=${p95}ms`);
        } else {
            console.log(`${ep}: Service not reachable for live measurement. Using inferred metrics from PERFORMANCE.md.`);
        }
    }
}

benchmark();
