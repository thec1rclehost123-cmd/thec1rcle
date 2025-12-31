require('dotenv').config({ path: '.env.local' });

async function testHomepage() {
    const { getHomepageContent } = await import('../lib/homepageData.js');
    console.log('Fetching homepage content...');
    try {
        const content = await getHomepageContent();
        console.log('Events in hero:', content.heroCards.length);
        console.log('Events in grid:', content.eventGrid.length);
        if (content.eventGrid.length > 0) {
            console.log('First event title:', content.eventGrid[0].title);
        }
    } catch (err) {
        console.error('Error fetching homepage content:', err);
    }
}

testHomepage().catch(console.error);
