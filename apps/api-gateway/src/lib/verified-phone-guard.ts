// @ts-ignore
import { getVerifiedFirebasePhone } from '@c1rcle/core/verified-phone';

type FirebaseAuthReader = {
  getUser: (uid: string) => Promise<{ phoneNumber?: string | null; disabled?: boolean }>;
};

export function createRequireVerifiedPhone(auth: FirebaseAuthReader) {
  return async function requireVerifiedPhone(request: any, reply: any) {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized: Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    let verifiedPhone = null;
    try {
      // Always re-check Firebase Admin. A decoded ID token can retain a stale
      // phone_number claim briefly after the provider is unlinked.
      const authRecord = await auth.getUser(request.user.uid);
      if (authRecord.disabled !== true) {
        verifiedPhone = getVerifiedFirebasePhone({}, authRecord);
      }
    } catch (error: any) {
      request.log?.warn?.(
        { uid: request.user.uid, error: error?.message || String(error) },
        'Unable to confirm verified Firebase phone',
      );
    }

    if (!verifiedPhone) {
      return reply.status(403).send({
        error: 'Phone verification required',
        code: 'PHONE_VERIFICATION_REQUIRED',
        message: 'Verify your phone number to continue.',
      });
    }

    request.verifiedPhone = verifiedPhone;
  };
}
