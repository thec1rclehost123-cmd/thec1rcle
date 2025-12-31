const fetch = require('node-fetch');

async function testApi() {
    console.log('Fetching events from API...');
    const response = await fetch('http://localhost:3000/api/events?limit=60&sort=heat');
    if (!response.ok) {
        console.error('API Error:', response.status, await response.text());
        return;
    }
    const data = await response.json();
    if (Array.isArray(data)) {
        console.log(`Found ${data.length} events.`);
        if (data.length > 0) {
            console.log('Sample event city:', data[0].city);
            console.log('Sample event status:', data[0].status);
        }
    } else {
        console.log('Received non-array response:', JSON.stringify(data, null, 2));
    }
}

testApi().catch(console.error);
