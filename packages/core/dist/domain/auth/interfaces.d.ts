export interface DecodedUser {
    uid: string;
    email?: string;
    displayName?: string;
    role?: string;
    [key: string]: any;
}
export interface IAuthService {
    verifyToken(token: string): Promise<DecodedUser | null>;
}
