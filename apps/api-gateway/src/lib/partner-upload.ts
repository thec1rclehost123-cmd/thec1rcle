import { randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
// @ts-ignore
import { getAdminStorage } from '@c1rcle/core/admin';

type UploadError = Error & {
  statusCode?: number;
  code?: string;
};

type UploadOptions = {
  partnerId: string;
  partnerType: 'host' | 'venue' | 'promoter';
  maxBytes?: number;
  allowedMimeTypes?: string[];
  folder?: string;
};

function makeUploadError(message: string, statusCode: number, code: string): UploadError {
  const error = new Error(message) as UploadError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function inferExtension(filename: string, mimetype?: string) {
  const explicit = filename.split('.').pop();
  if (explicit && explicit !== filename) return explicit.toLowerCase();
  if (!mimetype) return 'bin';
  if (mimetype === 'image/jpeg') return 'jpg';
  if (mimetype === 'image/png') return 'png';
  if (mimetype === 'image/webp') return 'webp';
  if (mimetype === 'application/pdf') return 'pdf';
  return 'bin';
}

export async function uploadPartnerAsset(
  request: FastifyRequest & { file: () => Promise<any> },
  options: UploadOptions,
) {
  const data = await request.file();
  if (!data) {
    throw makeUploadError('No file uploaded', 400, 'BAD_REQUEST');
  }

  if (
    options.allowedMimeTypes?.length &&
    data.mimetype &&
    !options.allowedMimeTypes.includes(data.mimetype)
  ) {
    throw makeUploadError('Unsupported file type', 400, 'UNSUPPORTED_MEDIA_TYPE');
  }

  const buffer = await data.toBuffer();
  const maxBytes = options.maxBytes ?? 10 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw makeUploadError(
      `File must be ${Math.floor(maxBytes / (1024 * 1024))}MB or smaller`,
      400,
      'FILE_TOO_LARGE',
    );
  }

  const extension = inferExtension(data.filename || 'file', data.mimetype);
  const folder = options.folder || `${options.partnerType}s/${options.partnerId}/uploads`;
  const storagePath = `${folder}/${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
  const bucket = getAdminStorage().bucket();
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: {
      contentType: data.mimetype || 'application/octet-stream',
      metadata: {
        originalName: data.filename || 'file',
        partnerId: options.partnerId,
        partnerType: options.partnerType,
      },
    },
  });

  try {
    await file.makePublic();
  } catch {}

  return {
    success: true,
    url: `https://storage.googleapis.com/${bucket.name}/${storagePath}`,
    filename: data.filename,
    storagePath,
  };
}
