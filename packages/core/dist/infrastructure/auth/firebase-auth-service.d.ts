import { Auth } from 'firebase-admin/auth';
import { IAuthService, DecodedUser } from '../../domain/auth/interfaces.js';
export declare class FirebaseAuthService implements IAuthService {
    private auth;
    constructor(auth: Auth);
    verifyToken(token: string): Promise<DecodedUser | null>;
}
