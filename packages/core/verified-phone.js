const E164_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

/**
 * Resolve a phone number only from Firebase-authenticated identity data.
 * Client profile fields are intentionally not accepted as verification proof.
 */
export function getVerifiedFirebasePhone(decodedToken, authRecord = null) {
  const candidates = [
    decodedToken?.phone_number,
    decodedToken?.phoneNumber,
    authRecord?.phoneNumber,
  ];

  for (const candidate of candidates) {
    const phone = typeof candidate === 'string' ? candidate.trim() : '';
    if (E164_PHONE_PATTERN.test(phone)) return phone;
  }

  return null;
}

export function hasVerifiedFirebasePhone(decodedToken, authRecord = null) {
  return Boolean(getVerifiedFirebasePhone(decodedToken, authRecord));
}
