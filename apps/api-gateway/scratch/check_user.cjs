const admin = require('firebase-admin');
const serviceAccount = require('/Users/aayushdivase/Downloads/c1rcle-staging-firebase-adminsdk-fbsvc-6f09278991.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const email = 'viratkohli6023492605@gmail.com';

admin.auth().getUserByEmail(email)
  .then((userRecord) => {
    console.log('User found:', userRecord.toJSON());
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error fetching user:', error);
    process.exit(1);
  });
