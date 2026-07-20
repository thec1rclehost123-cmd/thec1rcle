export function hasVerifiedFirebasePhone(user: Record<string, any> | null | undefined): boolean {
  const phoneNumber = typeof user?.phone_number === 'string' ? user.phone_number.trim() : '';
  return /^\+[1-9]\d{7,14}$/.test(phoneNumber);
}
