import { Readable, Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { handleUpload } from './social';

describe('social image upload', () => {
  it('uses the decorated Firebase Storage instance and returns an HTTPS URL', async () => {
    const fileBody = Readable.from(Buffer.from('image-bytes')) as Readable & {
      truncated?: boolean;
    };
    fileBody.truncated = false;

    const destination = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    const storedFile = {
      createWriteStream: vi.fn(() => destination),
      delete: vi.fn(),
    };
    const bucket = {
      name: 'c1rcle-staging.firebasestorage.app',
      file: vi.fn(() => storedFile),
    };
    const request = {
      user: { uid: 'user-1' },
      file: vi.fn(async () => ({ mimetype: 'image/jpeg', file: fileBody })),
    };

    const result = await handleUpload(request, {
      storage: { bucket: vi.fn(() => bucket) },
    });

    expect(bucket.file).toHaveBeenCalledWith(
      expect.stringMatching(/^users\/user-1\/profile-media\/\d+-[\w-]+\.jpg$/),
    );
    expect(storedFile.createWriteStream).toHaveBeenCalledWith(
      expect.objectContaining({
        public: true,
        metadata: expect.objectContaining({ contentType: 'image/jpeg' }),
      }),
    );
    expect(result).toMatchObject({
      success: true,
      url: expect.stringMatching(
        /^https:\/\/storage\.googleapis\.com\/c1rcle-staging\.firebasestorage\.app\/users\/user-1\/profile-media\//,
      ),
    });
  });

  it('rejects unauthenticated uploads before accessing multipart data', async () => {
    await expect(handleUpload({ file: vi.fn() }, {})).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  });
});
