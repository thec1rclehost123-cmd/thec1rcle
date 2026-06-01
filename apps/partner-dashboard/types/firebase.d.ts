declare module "firebase/auth" {
    export type User = any;
    export function getAuth(app?: any): any;
    export function onAuthStateChanged(auth: any, nextOrObserver: any): any;
    export function signInWithCustomToken(auth: any, token: string): Promise<any>;
    export function signOut(auth: any): Promise<void>;
    export class EmailAuthProvider { static credential(e:any, p:any): any; }
    export function reauthenticateWithCredential(u:any, c:any): Promise<any>;
    export class GoogleAuthProvider {}
    export function reauthenticateWithPopup(u:any, p:any): Promise<any>;
    export function signInWithEmailAndPassword(a:any, e:any, p:any): Promise<any>;
    export function signInWithPopup(a:any, p:any): Promise<any>;
    export function createUserWithEmailAndPassword(a:any, e:any, p:any): Promise<any>;
    export function updateProfile(u:any, d:any): Promise<void>;
}
declare module "firebase/storage";
declare module "firebase/firestore";
declare module "firebase/functions";
declare module "firebase/app";
