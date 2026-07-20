export type PhoneAuthRecovery = 'retry_code' | 'resend_code' | 'wait' | 'edit_number' | 'restart';

export type PhoneAuthFailure = {
  code: string | null;
  message: string;
  recovery: PhoneAuthRecovery;
  clearCode: boolean;
};

function extractAuthCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { code?: unknown; message?: unknown };
  if (typeof candidate.code === 'string') return candidate.code;
  if (typeof candidate.message !== 'string') return null;
  return candidate.message.match(/\[(auth\/[^\]]+)\]/)?.[1] ?? null;
}

export function getPhoneAuthFailure(error: unknown): PhoneAuthFailure {
  const code = extractAuthCode(error);

  switch (code) {
    case 'auth/invalid-verification-code':
      return {
        code,
        message: 'That code is incorrect. Check the latest message and try again.',
        recovery: 'retry_code',
        clearCode: true,
      };
    case 'auth/missing-verification-code':
      return {
        code,
        message: 'Enter the six-digit code from the latest message.',
        recovery: 'retry_code',
        clearCode: true,
      };
    case 'auth/code-expired':
    case 'auth/session-expired':
    case 'auth/invalid-verification-id':
    case 'auth/missing-verification-id':
      return {
        code,
        message: 'This code has expired. Request a new code to continue.',
        recovery: 'resend_code',
        clearCode: true,
      };
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
      return {
        code,
        message: 'Too many attempts. Wait a minute before trying again.',
        recovery: 'wait',
        clearCode: true,
      };
    case 'auth/credential-already-in-use':
    case 'auth/phone-number-already-exists':
    case 'auth/account-exists-with-different-credential':
      return {
        code,
        message:
          'This phone number is already connected to another account. Use a different number.',
        recovery: 'edit_number',
        clearCode: true,
      };
    case 'auth/invalid-phone-number':
      return {
        code,
        message: 'That phone number does not look right. Check the country code and number.',
        recovery: 'edit_number',
        clearCode: true,
      };
    case 'auth/network-request-failed':
      return {
        code,
        message: 'We could not connect. Check your connection and try the same code again.',
        recovery: 'retry_code',
        clearCode: false,
      };
    case 'auth/phone-link-integrity-check-failed':
      return {
        code,
        message: 'Your signed-in account changed. Start phone verification again.',
        recovery: 'restart',
        clearCode: true,
      };
    default:
      return {
        code,
        message: 'We could not verify this code. Please try again.',
        recovery: 'retry_code',
        clearCode: false,
      };
  }
}
