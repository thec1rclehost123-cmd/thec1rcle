import Fastify from 'fastify';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import openApiRoutes from './openapi';
import { guestV1OpenApi } from '../openapi/guest-v1';

describe('guest OpenAPI contract', () => {
    it('emits the canonical guest-v1 OpenAPI document from Fastify', async () => {
        const server = Fastify({ logger: false });
        await server.register(openApiRoutes);

        const response = await server.inject({ method: 'GET', url: '/openapi/guest-v1.json' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual(guestV1OpenApi);
        expect(response.json().paths).toHaveProperty('/checkout/initiate');
        expect(response.json().paths).toHaveProperty('/payments/verify');
        expect(response.json().paths).toHaveProperty('/tickets');
        expect(response.json().paths).toHaveProperty('/public/events');

        await server.close();
    });

    it('keeps the committed guest-v1 JSON artifact fresh', async () => {
        const artifactUrl = new URL('../../openapi/guest-v1.json', import.meta.url);
        const artifact = JSON.parse(await readFile(artifactUrl, 'utf8'));

        expect(artifact).toEqual(guestV1OpenApi);
    });
});
