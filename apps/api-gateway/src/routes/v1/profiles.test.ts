import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import validatePlugin from '../../plugins/validate';
import profileRoutes from './profiles';

async function buildServer() {
    const server = Fastify({ logger: false });
    let currentProfile = {
        uid: 'user_1',
        email: 'guest@example.com',
        displayName: 'Guest',
        gender: 'man',
        genderLastChangedAt: new Date().toISOString(),
    };
    const createProfile = vi.fn(async (profile: any) => {
        currentProfile = { ...currentProfile, ...profile };
    });
    const updateProfile = vi.fn(async (_userId: string, _type: string, updates: any) => {
        currentProfile = { ...currentProfile, ...updates };
    });

    server.decorate('db', {
        collection(name: string) {
            if (name === 'users') {
                return {
                    doc(id: string) {
                        return {
                            async get() {
                                return {
                                    id,
                                    exists: true,
                                    data: () => currentProfile,
                                };
                            },
                        };
                    },
                };
            }
            return {};
        },
    } as any);
    server.decorate('profileService', {
        createProfile,
        updateProfile,
        getPublicProfile: async () => null,
        getPosts: async () => [],
        getHighlights: async () => [],
    });
    server.decorateRequest('user', null);
    server.addHook('onRequest', async (request: any) => {
        request.user = { uid: 'user_1', email: 'guest@example.com' };
    });

    await server.register(validatePlugin);
    await server.register(profileRoutes);
    return { server, createProfile, updateProfile };
}

describe('profile routes GP-1 contracts', () => {
    it('POST /users/profile creates the authenticated guest profile only for the current user', async () => {
        const { server, createProfile } = await buildServer();

        const response = await server.inject({
            method: 'POST',
            url: '/users/profile',
            payload: {
                uid: 'user_1',
                email: 'guest@example.com',
                displayName: 'Guest',
                onboardingComplete: true,
            },
        });

        expect(response.statusCode).toBe(200);
        expect(createProfile).toHaveBeenCalledWith(expect.objectContaining({
            uid: 'user_1',
            email: 'guest@example.com',
            displayName: 'Guest',
            onboardingComplete: true,
        }));
        expect(response.json()).toMatchObject({
            success: true,
            uid: 'user_1',
            profile: {
                uid: 'user_1',
                email: 'guest@example.com',
                displayName: 'Guest',
            },
        });

        await server.close();
    });

    it('POST /users/profile rejects attempts to create another user profile', async () => {
        const { server, createProfile } = await buildServer();

        const response = await server.inject({
            method: 'POST',
            url: '/users/profile',
            payload: {
                uid: 'other_user',
                email: 'guest@example.com',
            },
        });

        expect(response.statusCode).toBe(403);
        expect(createProfile).not.toHaveBeenCalled();

        await server.close();
    });

    it('PATCH /profiles preserves the guest gender change cooldown', async () => {
        const { server, updateProfile } = await buildServer();

        const response = await server.inject({
            method: 'PATCH',
            url: '/profiles',
            payload: {
                type: 'user',
                updates: { gender: 'woman' },
            },
        });

        expect(response.statusCode).toBe(429);
        expect(response.json().error.code).toBe('PROFILE_UPDATE_COOLDOWN');
        expect(updateProfile).not.toHaveBeenCalled();

        await server.close();
    });

    it('PATCH /profiles accepts direct-field updates and returns the normalized profile', async () => {
        const { server, updateProfile } = await buildServer();

        const response = await server.inject({
            method: 'PATCH',
            url: '/profiles',
            payload: {
                city: 'Pune',
                displayName: 'Night Owl',
            },
        });

        expect(response.statusCode).toBe(200);
        expect(updateProfile).toHaveBeenCalledWith('user_1', 'user', expect.objectContaining({
            city: 'Pune',
            displayName: 'Night Owl',
        }));
        expect(response.json()).toMatchObject({
            success: true,
            profile: expect.objectContaining({
                city: 'Pune',
                displayName: 'Night Owl',
                uid: 'user_1',
            }),
        });

        await server.close();
    });
});
