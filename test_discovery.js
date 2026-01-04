
const { discoverPartners } = require('./apps/partner-dashboard/lib/server/promoterConnectionStore');

async function test() {
    try {
        const partners = await discoverPartners({ type: 'all', limit: 30 });
        console.log('Discovered partners:', partners.length);
        partners.forEach(p => console.log(`- ${p.name} (${p.type}) in ${p.city}`));
    } catch (err) {
        console.error('Error:', err);
    }
}

test();
