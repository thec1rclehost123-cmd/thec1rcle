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
    const source: TokenVerificationSource =
      preferredSource === 'session_cookie' ? 'session_cookie' : 'id_token';

    try {
      const decodedToken =
        source === 'session_cookie'
          ? await this.auth.verifySessionCookie(token, true)
          : await this.auth.verifyIdToken(token, true);
      return {
        status: 'valid',
        user: { ...decodedToken, uid: decodedToken.uid } as DecodedUser,
        source,
        revokedChecked: true,
        disabledChecked: true,
        errorCode: null,
        errorMessage: null,
      };
    } catch (error: any) {
      const errorCode = error?.code ? String(error.code) : null;
      const errorMessage = error?.message ? String(error.message) : null;
      const code = errorCode || '';

      if (code.includes('user-disabled')) {
        return {
          status: 'disabled',
          user: null,
          source,
          revokedChecked: true,
          disabledChecked: true,
          errorCode,
          errorMessage,
        };
      }
      if (code.includes('revoked')) {
        return {
          status: 'revoked',
          user: null,
          source,
          revokedChecked: true,
          disabledChecked: true,
          errorCode,
          errorMessage,
        };
      }
      if (code.includes('expired')) {
        return {
          status: 'expired',
          user: null,
          source,
          revokedChecked: true,
          disabledChecked: true,
          errorCode,
          errorMessage,
        };
      }
      if (
        (source === 'session_cookie' && code.includes('invalid-session-cookie')) ||
        (source === 'id_token' && code.includes('invalid-id-token'))
      ) {
        return {
          status: 'credential_mismatch',
          user: null,
          source,
          revokedChecked: true,
          disabledChecked: true,
          errorCode,
          errorMessage,
        };
      }
      if (code.includes('argument-error')) {
        return {
          status: 'malformed',
          user: null,
          source,
          revokedChecked: true,
          disabledChecked: true,
          errorCode,
          errorMessage,
        };
      }
      return {
        status: errorCode ? 'invalid' : 'error',
        user: null,
        source,
        revokedChecked: true,
        disabledChecked: true,
        errorCode,
        errorMessage,
      };
    }
  }
}
