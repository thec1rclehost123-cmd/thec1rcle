import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.development' });
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.FIREBASE_ADMIN_SDK_PATH;

initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
const db = getFirestore();

const mockNames = [
    'Alex Thunder', 'Sarah Viper', 'Marcus Swift', 'Elena Frost', 
    'Julian Blaze', 'Nadia Phoenix', 'Tariq Storm', 'Chloe Matrix',
    'Leo Titan', 'Mia Horizon'
];

async function seed() {
    const d = new Date();
    const monthStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    
    const d2 = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = d2.getUTCDay() || 7;
    d2.setUTCDate(d2.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d2.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d2.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const weekStr = `${d2.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

    console.log('Generating 10 promoters...');

    const cities = ['Pune', 'Mumbai', 'Goa', 'Bengaluru'];

    for (let i = 0; i < 10; i++) {
        const promoterId = `mock_promoter_${i}`;
        const displayName = mockNames[i];
        const avatarUrl = `https://i.pravatar.cc/150?u=${promoterId}`;
        const city = cities[i % cities.length];
        
        // Random score between 5k and 50k
        const xpScore = Math.floor(Math.random() * 45000) + 5000;

        // 1. Create user
        await db.collection('users').doc(promoterId).set({
            id: promoterId,
            displayName,
            avatarUrl,
            role: 'promoter',
            city,
            kycStatus: 'verified',
            createdAt: new Date().toISOString()
        });

        // 1.b Create promoter profile
        await db.collection('promoters').doc(promoterId).set({
            id: promoterId,
            ownerId: promoterId,
            displayName,
            avatarUrl,
            city,
            createdAt: new Date().toISOString()
        });

        // 2. Promoter stats (legacy)
        await db.collection('promoter_stats').doc(promoterId).set({
            totalCommissionEarned: xpScore,
            updatedAt: new Date()
        });

        // 3. City stats (Option 2)
        await db.collection('promoter_city_stats').doc(`${promoterId}_${city.toLowerCase()}`).set({
            promoterId,
            city: city.toLowerCase(),
            totalCommissionEarned: xpScore,
            updatedAt: new Date()
        });

        // 4. Matrix stats (Option 3)
        const buckets = [
            { type: 'all_time', value: 'all', city: 'global' },
            { type: 'all_time', value: 'all', city: city.toLowerCase() },
            { type: 'month', value: monthStr, city: 'global' },
            { type: 'month', value: monthStr, city: city.toLowerCase() },
            { type: 'week', value: weekStr, city: 'global' },
            { type: 'week', value: weekStr, city: city.toLowerCase() },
        ];

        for (const bucket of buckets) {
            const docId = `${promoterId}_${bucket.type}_${bucket.value}_${bucket.city}`;
            await db.collection('leaderboard_stats').doc(docId).set({
                promoterId,
                periodType: bucket.type,
                periodValue: bucket.value,
                city: bucket.city,
                totalCommissionEarned: xpScore,
                updatedAt: new Date()
            });
        }
    }

    console.log('Seeded 10 promoters and their stats successfully!');
}

seed().catch(console.error);
