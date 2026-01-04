const admin = require('firebase-admin');

const serviceAccount = {
    projectId: "thec1rcle-india",
    clientEmail: "firebase-adminsdk-fbsvc@thec1rcle-india.iam.gserviceaccount.com",
    privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDBsrVguoxRRCQD\n1gCQNUcOHpR6MUy6w9YbkclINrFQgXX+IILnLqYvUQyI3W1Z2rGXkdI6UJYljZ3C\niO4bF1QcJUhPVBdyjqWGyhzo1eUbtaQUULQAsJa+3lUFrTEOfWL7PWej9LH1Vtgf\nrIgGOPYmGkWh2IU0IqFQ3FyNwAoN1myYYL28xIbdfknYhft2xaY6OX1W8xK0b3pG\naatXX6qWSEhuBJlDwgm8rRBtgAJySPGL5iYTMKSlk145qyoSpD4LRMbVQpf3wloO\nmZEEs4Wtnr14QqgxHxydGIDyGxdaaBBT+nbo0Dlv9AT0ZBQAHZZV2+8jpf+7CLR7\n7fRpbQx1AgMBAAECggEAKIXZbdDhQbAqg7Xt/L10rdbGc9DkD0+gt7hWfpnYmzHW\nbFHDaReok04Wu/xtH+cBj+blLyeEXftkZZotjDPjeBbxq4z5cdE3fn1CspBrI9Kq\nrshafCl1hB1x9qPO10vynQKx78plv6DJSskW1QxuLLcC2dL5PRjAnHDZmRszz0Rv\nFCgP1Nle0ZzvJnUCQHwyrEYiH8oZqfH+5K/yFA9dwKQN0ltwbFogNMB6CEQPlk6I\npWulgafqqLzEu664kRK97KVBOZSh+IhEcNR6ogHkrScfpPb4utUUxbS9SnTJTrpn\nsQ0piqAbRgH6abWwveb5HK8LwT8nXw2I4E/LAnEHyQKBgQDwmsdNysxHNZx139sf\nRhnvGLh6MiJ2CE4AFqx8DetaCRLO0goDw+0EWQX54sNd8CwSbwKUtFb7BzX6p798\n0tjihTNGQBcQ0ncMpzaYHsFgAHx3J4x47f4uOnS/RoeEu1N3wsBdKDj5HwWIoMQE\nnbky7A6I7/qnKiRd4F6flyPcTQKBgQDOF5P+qY2kBR0LW5AHq+O0GOeZlzhey1Pt\nDM2RktDNe3qw37Wdmhx+kJY8hRZHHbDNSE3S7gUZvh30ARA+r2lQSRt4eRc9iiTJ\ny82nB1lC/Cj1Sxza/y/IS3fYjswvNaJLmrEDSjE0QvXrGxAOpSSx6iNHo/dKPbi6\nTCzILJNkyQKBgQClv0pLCch9ya3V+fc+bRFSh6oV69GXlBL/tp7t+rzF0nhVZ5Yk\nj+UIWLdoNFG3tcr2i+iwPiepWIdT/BlKyQlFytLOsznwibwfSFWwp4c5NjyH7QO1\nDuZKPFTOq6yRwGY4mz3fLuVIoJk0TOOb9ndtX/aHWSJH5B0XWoh00i6PBQKBgHHD\nwDVWwVJmZDcNzz782tBi4w381Og3E1gKtjuCsPKNFBgpFacvGEWhaN11leuh7yQS\noqsqKvSf5wb3w1DnIZppENn69iJJbK9camSmgNaiPbXSRdZ6AZVuW3TWts3krHdR\nqB8pyGmSARBMOxvqe4wetGTqlSqNUbi9Lgc93AtJAoGBAOan/F7eDp1QUKj9HmOG\nPBlYbOFShqaoUrAXg4d0WiSdgbz+eJll1WvvjllnRoR8zLjT6q8eEmnaNnnx4YaP\nQ2GmZnqzNElYRJt3Iuz1Z5Ib/ofCANde+/bTYaMCyPAfPGzVAFONVeHIPTc1XMmw\ngPYco4hbqN4t06vbeh6ztxi2\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n')
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const auth = admin.auth();

async function setup() {
    const email = 'promoter@thec1rcle.com';
    const password = 'Promoter123!';

    let uid;

    try {
        console.log('Checking for existing user...');
        const user = await auth.getUserByEmail(email);
        uid = user.uid;
        console.log('User exists, updating password...');
        await auth.updateUser(uid, { password });
    } catch (e) {
        console.log('Creating new user...');
        const user = await auth.createUser({
            email,
            password,
            displayName: 'Demo Promoter'
        });
        uid = user.uid;
    }

    console.log(`Setting up Firestore profile for ${uid}...`);
    // Set User Profile
    await db.collection('users').doc(uid).set({
        email,
        displayName: 'Demo Promoter',
        role: 'promoter',
        promoterId: uid,
        createdAt: new Date().toISOString()
    }, { merge: true });

    console.log('Setup Complete.');
    console.log('-------------------------');
    console.log('Login Email:    ', email);
    console.log('Login Password: ', password);
    console.log('-------------------------');
}

setup().catch(console.error);
