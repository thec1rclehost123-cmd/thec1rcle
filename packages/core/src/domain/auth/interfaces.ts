export interface DecodedUser {
  uid: string;
  email?: string;
  displayName?: string;
  role?: string;
  [key: string]: any;
}

export type TokenVerificationStatus =
  | 'valid'
  | 'expired'
  | 'malformed'
  | 'session_cookie_mismatch'
  | 'invalid'
  | 'error'
  | 'revoked'
  | 'disabled'
  | 'credential_mismatch';

export type TokenVerificationSource = 'id_token' | 'session_cookie';

export interface TokenVerificationResult {
  status: TokenVerificationStatus;
  user: DecodedUser | null;
  source: TokenVerificationSource | null;
  revokedChecked: boolean;
  disabledChecked: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface IAuthService {
  verifyToken(token: string): Promise<DecodedUser | null>;
  verifyTokenDetailed?(
    token: string,
    preferredSource?: TokenVerificationSource | 'auto',
  ): Promise<TokenVerificationResult>;
}
