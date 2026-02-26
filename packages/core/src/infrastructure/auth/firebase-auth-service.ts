import { Auth } from 'firebase-admin/auth';
import { IAuthService, DecodedUser } from '../../domain/auth/interfaces.js';

export class FirebaseAuthService implements IAuthService {
    constructor(private auth: Auth) { }

    async verifyToken(token: string): Promise<DecodedUser | null> {
        try {
            const decodedToken = await this.auth.verifyIdToken(token);
            return {
                ...decodedToken,
                uid: decodedToken.uid, // Explicit is fine, or just ...decodedToken
            } as DecodedUser;
        } catch (error) {
            return null;
        }
    }
}
