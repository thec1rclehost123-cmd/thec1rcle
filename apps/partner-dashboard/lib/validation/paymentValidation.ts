/**
 * Payment validation utilities for the Partner Dashboard.
 *
 * Pure functions — no side effects, no imports. Each returns null on success
 * or a human-readable error string on failure. Safe to use in both client
 * components and API routes.
 */

const UPI_REGEX   = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
const IFSC_REGEX  = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/**
 * Validates a UPI ID (e.g. name@upi, phone@ybl).
 * Returns an error message or null.
 */
export function validateUpiId(upiId: string): string | null {
    const trimmed = upiId.trim();
    if (!trimmed) return "UPI ID is required";
    if (!UPI_REGEX.test(trimmed)) return "Invalid UPI ID format. Expected: name@bankhandle";
    return null;
}

/**
 * Validates an IFSC code (e.g. SBIN0001234).
 * Returns an error message or null.
 */
export function validateIFSC(code: string): string | null {
    const upper = code.trim().toUpperCase();
    if (!upper) return "IFSC code is required";
    if (!IFSC_REGEX.test(upper)) return "Invalid IFSC code. Format: ABCD0123456";
    return null;
}

/**
 * Validates bank transfer fields collectively.
 * Returns the first error message found, or null if all fields are valid.
 */
export function validateBankTransfer(
    accountNumber: string,
    accountName: string,
    ifscCode: string
): string | null {
    const ifscError = validateIFSC(ifscCode);
    if (ifscError) return ifscError;
    if (!accountNumber.trim() || accountNumber.trim().length < 9)
        return "Account number must be at least 9 digits";
    if (!accountName.trim() || accountName.trim().length < 3)
        return "Account holder name is required";
    return null;
}

/**
 * Validates a payout amount against the available balance and minimum threshold.
 * Returns an error message or null.
 */
export function validatePayoutAmount(
    amount: number,
    availableBalance: number,
    minimumPayout = 100
): string | null {
    if (amount < minimumPayout) return `Minimum payout amount is ₹${minimumPayout}`;
    if (amount > availableBalance) return "Amount exceeds available balance";
    return null;
}
