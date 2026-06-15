import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';

export function getFirebaseApp(): FirebaseApp;
export function getFirebaseDb(): Firestore;
export function getFirebaseAuth(): Auth;
export function getFirebaseStorage(): FirebaseStorage;
