// Firebase configuration for mobile app
// Uses the same project as the web apps

export const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyBoJB4ohM6yoo1IHzC8gEvv9bUPWq25Y08",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "thec1rcle-india.firebaseapp.com",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "thec1rcle-india",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "thec1rcle-india.firebasestorage.app",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "510566153272",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:510566153272:web:282e5127ac53814f213acd",
};
