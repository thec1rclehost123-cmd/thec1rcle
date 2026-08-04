import { Auth } from 'firebase-admin/auth';
import { createHash } from 'node:crypto';
import {
  IAuthService,
  DecodedUser,
  TokenVerificationResult,
  TokenVerificationSource,
} from '../../domain/auth/interfaces.js';

export class FirebaseAuthService implements IAuthService {
  private readonly positiveVerificationCache = new Map<
    string,
    { result: TokenVerificationResult; expiresAt: number }
  >();

  constructor(
    private auth: Auth,
    // The Guest checkout journey legitimately spans more than 15 seconds.
    // Keep this bounded so revocations still propagate quickly while avoiding
    // a second network revocation check in the middle of one checkout.
    private readonly positiveCacheTtlMs = 30_000,
  ) {}

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
    const cacheKey = `${source}:${createHash('sha256').update(token).digest('hex')}`;
    const cached = this.positiveVerificationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
    if (cached) this.positiveVerificationCache.delete(cacheKey);

    try {
      const decodedToken =
        source === 'session_cookie'
          ? await this.auth.verifySessionCookie(token, true)
          : await this.auth.verifyIdToken(token, true);
      const result: TokenVerificationResult = {
        status: 'valid',
        user: { ...decodedToken, uid: decodedToken.uid } as DecodedUser,
        source,
        revokedChecked: true,
        disabledChecked: true,
        errorCode: null,
        errorMessage: null,
      };
      if (this.positiveCacheTtlMs > 0) {
        if (this.positiveVerificationCache.size >= 5_000) {
          const oldestKey = this.positiveVerificationCache.keys().next().value;
          if (oldestKey) this.positiveVerificationCache.delete(oldestKey);
        }
        this.positiveVerificationCache.set(cacheKey, {
          result,
          expiresAt: Date.now() + this.positiveCacheTtlMs,
        });
      }
      return result;
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
