import { describe, expect, it } from 'vitest';

import {
  HOST_VERIFICATION_UPLOAD_RULES,
  sanitizeUploadFilename,
  validateClientUpload,
} from './clientUploadValidation';

describe('clientUploadValidation', () => {
  it('accepts supported host verification files', () => {
    const error = validateClientUpload(
      {
        name: 'identity-card.png',
        size: 1024,
        type: 'image/png',
      },
      HOST_VERIFICATION_UPLOAD_RULES.idDocument,
    );

    expect(error).toBeNull();
  });

  it('rejects oversized files', () => {
    const error = validateClientUpload(
      {
        name: 'identity-card.png',
        size: HOST_VERIFICATION_UPLOAD_RULES.idDocument.maxBytes + 1,
        type: 'image/png',
      },
      HOST_VERIFICATION_UPLOAD_RULES.idDocument,
    );

    expect(error).toContain('Government ID must be smaller than');
  });

  it('sanitizes upload file names for storage paths', () => {
    expect(sanitizeUploadFilename('My ID @ 2026!.png')).toBe('My-ID--2026.png');
  });
});
