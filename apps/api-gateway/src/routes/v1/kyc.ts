import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { buildErrorResponse } from '../../lib/api-contracts';

export default async function kycRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/v1/kyc/upload
     * Handle multipart file upload for KYC documents.
     */
    fastify.post('/upload', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;

        try {
            const data = await request.file();
            if (!data) {
                return reply.status(400).send(buildErrorResponse({
                    code: 'BAD_REQUEST',
                    message: 'No file uploaded',
                    requestId: request.id,
                }));
            }

            const bucket = fastify.storage.bucket();
            const fileName = `kyc/${userId}/${Date.now()}_${randomUUID().substring(0, 8)}_${data.filename}`;
            const file = bucket.file(fileName);

            const stream = file.createWriteStream({
                metadata: {
                    contentType: data.mimetype,
                    metadata: {
                        userId,
                        originalName: data.filename,
                    }
                },
                public: true,
            });

            await new Promise((resolve, reject) => {
                data.file.pipe(stream)
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
            return reply.status(500).send(buildErrorResponse({
                code: 'KYC_UPLOAD_FAILED',
                message: error.message || 'Failed to upload document.',
                requestId: request.id,
            }));
        }
    });
}
