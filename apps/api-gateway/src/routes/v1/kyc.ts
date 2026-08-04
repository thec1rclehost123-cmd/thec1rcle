import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { buildErrorResponse } from '../../lib/api-contracts';
import { validateAadhaar } from '../../utils/aadhaar';

export default async function kycRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/kyc/upload
   * Handle multipart file upload for KYC documents.
   */
  fastify.post(
    '/upload',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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

        const bucket = fastify.storage.bucket();

        // Read the stepId and fieldName sent from the frontend FormData
        // so we can name the file descriptively instead of random IDs.
        const uploadFields = (data as any).fields || {};
        const stepId = String(uploadFields.stepId?.value || '').replace(/[^a-z0-9_-]/g, '');
        const fieldName = String(uploadFields.fieldName?.value || '').replace(/[^a-z0-9_-]/g, '');

        // Build a human-readable label from the field name
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

        // Look up the user's display name for the filename
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

        const ext = (data.filename || '').includes('.') ? data.filename.split('.').pop() : 'jpg';
        const fileName = `kyc/${userId}/${userName}_${docLabel}.${ext}`;
        const file = bucket.file(fileName);

        const stream = file.createWriteStream({
          metadata: {
            contentType: data.mimetype,
            metadata: {
              userId,
              originalName: data.filename,
            },
          },
          public: true,
        });

        await new Promise((resolve, reject) => {
          data.file
            .pipe(stream)
            .on('finish', resolve)
            .on('error', (err: any) => {
              fastify.log.error(`Stream error during KYC upload: ${err.message}`);
              reject(err);
            });
        });

        // Fallback to appspot if firebasestorage.app fails (optional, but good for older projects)
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

        return {
          success: true,
          url: publicUrl,
          fileName,
        };
      } catch (error: any) {
        fastify.log.error(`Error in POST /kyc/upload: ${error.message}`);
        return reply.status(500).send(
          buildErrorResponse({
            code: 'KYC_UPLOAD_FAILED',
            message: error.message || 'Failed to upload document.',
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { aadhaarId } = request.body as { aadhaarId: string };

      if (!aadhaarId) {
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'Aadhaar ID is required',
            requestId: request.id,
          }),
        );
      }

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

      // Mock success response for structural validation
      return {
        success: true,
        message: 'Aadhaar number verified successfully.',
        verifiedAt: new Date().toISOString(),
      };
    },
  );
}
