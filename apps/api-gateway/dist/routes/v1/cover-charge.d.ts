/**
 * Cover Charge Wallet — Fastify API Routes
 *
 * All monetary values in requests/responses are in integer PAISE.
 * All mutations require Firebase Auth token (staff or admin).
 * Offline debits are hard-rejected (no offline queue in v1).
 */
import { FastifyInstance } from 'fastify';
export default function coverChargeRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=cover-charge.d.ts.map