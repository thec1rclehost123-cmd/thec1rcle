const admin = require('firebase-admin');
const serviceAccount = require('/Users/aayushdivase/Downloads/c1rcle-staging-firebase-adminsdk-fbsvc-6f09278991.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const email = 'viratkohli6023492605@gmail.com';
const newPassword = 'Password123!';

admin.auth().getUserByEmail(email)
  .then((userRecord) => {
    return admin.auth().updateUser(userRecord.uid, {
      password: newPassword
    });
  })
  .then((userRecord) => {
    console.log('Successfully updated user password for:', userRecord.email);
    console.log('New Password set to:', newPassword);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error updating user:', error);
    process.exit(1);
  });
