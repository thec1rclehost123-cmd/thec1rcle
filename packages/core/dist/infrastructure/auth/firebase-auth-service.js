export class FirebaseAuthService {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    async verifyToken(token) {
        try {
            const decodedToken = await this.auth.verifyIdToken(token);
            return {
                ...decodedToken,
                uid: decodedToken.uid, // Explicit is fine, or just ...decodedToken
            };
        }
        catch (error) {
            return null;
        }
    }
}
