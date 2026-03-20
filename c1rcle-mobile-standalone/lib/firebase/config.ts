// Firebase configuration for mobile app
// Uses the same project as the web apps

export const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyBvVJH0kcXgNmmnKUPAENvWhAg1XzHXqDU",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "c1rcle-staging.firebaseapp.com",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "c1rcle-staging",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "c1rcle-staging.firebasestorage.app",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "281421756463",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:281421756463:web:d4101d3707e0a7cd5ceeda",
};
