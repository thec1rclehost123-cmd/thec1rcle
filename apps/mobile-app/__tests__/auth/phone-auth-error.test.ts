import { getPhoneAuthFailure } from '../../lib/auth/phoneAuthError';

describe('phone authentication error recovery', () => {
  it.each([
    ['auth/invalid-verification-code', 'retry_code', true],
    ['auth/session-expired', 'resend_code', true],
    ['auth/too-many-requests', 'wait', true],
    ['auth/credential-already-in-use', 'edit_number', true],
    ['auth/phone-number-already-exists', 'edit_number', true],
    ['auth/invalid-phone-number', 'edit_number', true],
    ['auth/network-request-failed', 'retry_code', false],
    ['auth/phone-link-integrity-check-failed', 'restart', true],
  ] as const)('maps %s to %s recovery', (code, recovery, clearCode) => {
    expect(getPhoneAuthFailure({ code })).toMatchObject({ code, recovery, clearCode });
  });

  it('extracts a Firebase auth code embedded in a native error message', () => {
    expect(
      getPhoneAuthFailure({ message: '[auth/code-expired] The SMS code has expired.' }),
    ).toMatchObject({ code: 'auth/code-expired', recovery: 'resend_code' });
  });

  it('uses a safe retry message for an unknown failure', () => {
    expect(getPhoneAuthFailure(new Error('internal Firebase details'))).toEqual({
      code: null,
      message: 'We could not verify this code. Please try again.',
      recovery: 'retry_code',
      clearCode: false,
    });
  });
});
