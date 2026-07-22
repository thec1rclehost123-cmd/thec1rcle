import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
import { validateAadhaar } from '../../utils/aadhaar';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const AadhaarVerifySchema = z.object({
  aadhaarId: z.string().min(12).max(12).regex(/^\d{12}$/),
});

export default async function kycRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/kyc/upload
   * Handle multipart file upload for KYC documents.
   */
  fastify.post(
    '/upload',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;

      try {
        const data = await request.file();
        if (!data) {
          return reply.status(400).send(
            buildErrorResponse({
              code: 'BAD_REQUEST',
              message: 'No file uploaded',
              requestId: request.id,
            }),
          );
        }

        // Validate file type
        if (!ALLOWED_MIME_TYPES.has(data.mimetype)) {
          return reply.status(400).send(
            buildErrorResponse({
              code: 'INVALID_FILE_TYPE',
              message: 'Only JPEG, PNG, WebP images and PDF documents are allowed.',
              requestId: request.id,
            }),
          );
        }

        const bucket = fastify.storage.bucket();
        const uploadFields = (data as any).fields || {};
        const fieldName = String(uploadFields.fieldName?.value || '').replace(/[^a-z0-9_-]/g, '');

        const FIELD_LABELS: Record<string, string> = {
          doc_front: 'id_front',
          doc_back: 'id_back',
          selfie: 'selfie',
          cheque_doc: 'cheque',
          sig_doc_front: 'signatory_id_front',
          sig_doc_back: 'signatory_id_back',
          sig_selfie: 'signatory_selfie',
          reg_doc: 'registration_certificate',
        };
        const docLabel = FIELD_LABELS[fieldName] || fieldName || 'document';

        let userName = userId.substring(0, 8);
        try {
          const userSnap = await fastify.db.collection('users').doc(userId).get();
          const userData = userSnap.data();
          if (userData?.displayName) {
            userName = String(userData.displayName)
              .replace(/[^a-zA-Z0-9_-]/g, '_')
              .slice(0, 30);
          } else if (userData?.email) {
            userName = userData.email
              .split('@')[0]
              .replace(/[^a-zA-Z0-9_-]/g, '_')
              .slice(0, 30);
          }
        } catch {
          /* fallback to userId prefix */
        }

        const ext = (data.filename || '').includes('.') ? String(data.filename.split('.').pop()).replace(/[^a-zA-Z0-9]/g, '') : 'jpg';
        const fileName = `kyc/${userId}/${userName}_${docLabel}_${randomUUID().slice(0, 8)}.${ext}`;
        const file = bucket.file(fileName);

        // Track total size during streaming to enforce size limit
        let totalBytes = 0;

        const stream = file.createWriteStream({
          metadata: {
            contentType: data.mimetype,
            metadata: {
              userId,
              originalName: data.filename,
            },
          },
          resumable: false,
        });

        await new Promise((resolve, reject) => {
          data.file
            .on('data', (chunk: Buffer) => {
              totalBytes += chunk.length;
              if (totalBytes > MAX_FILE_SIZE_BYTES) {
                stream.destroy(new Error('File exceeds maximum allowed size of 10 MB'));
                data.file.destroy();
              }
            })
            .pipe(stream)
            .on('finish', resolve)
            .on('error', (err: any) => {
              fastify.log.error(`Stream error during KYC upload: ${err.message}`);
              reject(err);
            });
        });

        // Generate signed URL valid for 1 hour instead of making the file public
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000,
        });

        return {
          success: true,
          url: signedUrl,
          fileName,
        };
      } catch (error: any) {
        if (error.message?.includes('exceeds maximum allowed size')) {
          return reply.status(400).send(
            buildErrorResponse({
              code: 'FILE_TOO_LARGE',
              message: 'File exceeds maximum allowed size of 10 MB.',
              requestId: request.id,
            }),
          );
        }
        fastify.log.error(`Error in POST /kyc/upload: ${error.message}`);
        return reply.status(500).send(
          buildErrorResponse({
            code: 'KYC_UPLOAD_FAILED',
            message: 'Failed to upload document.',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * POST /api/v1/kyc/verify-aadhaar
   * Verifies an Aadhaar number using structural validation.
   */
  fastify.post(
    '/verify-aadhaar',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: AadhaarVerifySchema })],
    },
    async (request: any, reply) => {
      const { aadhaarId } = request.body as { aadhaarId: string };
      const isValid = validateAadhaar(aadhaarId);

      if (!isValid) {
        return reply.status(400).send(
          buildErrorResponse({
            code: 'INVALID_AADHAAR',
            message: 'Invalid Aadhaar number. Please check the digits and try again.',
            requestId: request.id,
          }),
        );
      }

      return buildSuccessResponse({
        aadhaarId: aadhaarId.replace(/^(\d{4})\d{4}(\d{4})$/, '$1XXXX$2'),
        verified: true,
        verifiedAt: new Date().toISOString(),
      });
    },
  );
}
