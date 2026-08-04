# Weak Crypto — Hardened scrypt Salt Derivation Fix

This document summarizes the problem, solution, and files changed regarding key derivation salt hardening (Task 4.18).

## Problem

- In `apps/api-gateway/src/lib/encryption.ts`, symmetric encryption keys were derived using `scryptSync(secret, 'salt', 32)`.
- Using a fixed, generic 4-character string `'salt'` as derivation salt reduces key entropy and exposes derived keys to dictionary and rainbow table precomputation attacks.

## Solution

1. **Domain-Separated Salt Derivation**:
   - Updated `encryption.ts` to derive `primaryKey` using `process.env.ENCRYPTION_SALT` or strong domain-separated salt `'c1rcle_api_gateway_aes256_key_derivation_salt_v1'`.
2. **Zero-Downtime Legacy Fallback**:
   - Maintained a `legacyKey` derived from `'salt'` and implemented a two-stage decryption fallback inside `decrypt()`: attempts `primaryKey` first; if decryption fails, attempts `legacyKey`.
   - This ensures all previously-encrypted database fields decrypt cleanly without data loss or corruption.

## Files Changed

- [encryption.ts](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/api-gateway/src/lib/encryption.ts)
