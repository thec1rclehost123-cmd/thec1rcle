import { Auth } from 'firebase-admin/auth';
import {
  IAuthService,
  DecodedUser,
  TokenVerificationResult,
  TokenVerificationSource,
} from '../../domain/auth/interfaces.js';

export class FirebaseAuthService implements IAuthService {
  constructor(private auth: Auth) {}

  async verifyToken(token: string): Promise<DecodedUser | null> {
    const result = await this.verifyTokenDetailed(token);
    return result.user;
  }

  async verifyTokenDetailed(
    token: string,
    preferredSource: TokenVerificationSource | 'auto' = 'auto',
  ): Promise<TokenVerificationResult> {
    const attempts =
      preferredSource === 'session_cookie'
        ? ['session_cookie', 'id_token']
        : preferredSource === 'id_token'
          ? ['id_token', 'session_cookie']
          : ['id_token', 'session_cookie'];
    const failures: Array<{
      source: TokenVerificationSource;
      code: string | null;
      message: string | null;
    }> = [];

    for (const source of attempts as TokenVerificationSource[]) {
      try {
        const decodedToken =
          source === 'session_cookie'
            ? await this.auth.verifySessionCookie(token, true)
            : await this.auth.verifyIdToken(token);
        return {
          status: 'valid',
          user: { ...decodedToken, uid: decodedToken.uid } as DecodedUser,
          source,
          errorCode: null,
          errorMessage: null,
        };
      } catch (error: any) {
        failures.push({
          source,
          code: error?.code || null,
          message: error?.message || null,
        });
      }
    }

    const codes = failures.map((entry) => entry.code).filter(Boolean) as string[];
    const errorCode = codes[0] || null;
    const errorMessage = failures.find((entry) => entry.message)?.message || null;

    if (codes.some((code) => code.includes('expired') || code.includes('revoked'))) {
      return { status: 'expired', user: null, source: null, errorCode, errorMessage };
    }

    if (
      preferredSource === 'session_cookie' &&
      codes.some((code) => code.includes('invalid-session-cookie'))
    ) {
      return {
        status: 'session_cookie_mismatch',
        user: null,
        source: null,
        errorCode,
        errorMessage,
      };
    }

    if (
      codes.some(
        (code) =>
          code.includes('argument-error') ||
          code.includes('invalid-id-token') ||
          code.includes('invalid-session-cookie'),
      )
    ) {
      return { status: 'malformed', user: null, source: null, errorCode, errorMessage };
    }

    if (codes.length > 0) {
      return { status: 'invalid', user: null, source: null, errorCode, errorMessage };
    }

    return { status: 'error', user: null, source: null, errorCode, errorMessage };
  }
}
