import { FastifyInstance } from 'fastify';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { buildErrorResponse } from '../../lib/api-contracts';
import {
    appendSetCookieHeader,
    ensureGuestCsrfCookie,
    issueGuestCsrfCookie,
    serializeGuestCsrfClearCookie,
} from '../../lib/guest-csrf';
import { buildGuestAuthBootstrap, buildGuestProfileCreatePayload } from '../../lib/guest-auth';

const SESSION_COOKIE_NAME = '__session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

const AuthCheckSchema = z.object({
    email: z.string().email(),
}).strict();

const OtpSendSchema = z.object({
    type: z.enum(['email', 'phone']),
    recipient: z.string().min(3),
}).strict();

const OtpVerifySchema = z.object({
    type: z.enum(['email', 'phone']),
    recipient: z.string().min(3),
    code: z.string().min(4).max(10),
}).strict();

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    rememberMe: z.boolean().optional(),
}).strict();

const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    displayName: z.string().optional(),
    age: z.number().optional(),
    gender: z.string().optional(),
    phone: z.string().optional(),
    city: z.string().optional(),
    instagram: z.string().optional(),
    onboardingComplete: z.boolean().optional(),
}).strict();

const PasswordResetSchema = z.object({
    email: z.string().email(),
    continueUrl: z.string().url().optional(),
}).strict();

const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(6),
}).strict();

const GoogleStartQuerySchema = z.object({
    next: z.string().optional(),
}).strict();

const GoogleCallbackQuerySchema = z.object({
    code: z.string().optional(),
    state: z.string().optional(),
    error: z.string().optional(),
}).strict();

const OnboardSchema = z.object({
    type: z.string(),
    email: z.string().email(),
    name: z.string(),
    company: z.string().optional(),
    website: z.string().optional(),
    phone: z.string().optional(),
    instagram: z.string().optional(),
    contactPerson: z.string().optional(),
    city: z.string().optional(),
    area: z.string().optional(),
    capacity: z.string().optional(),
    plan: z.string().optional(),
    role: z.string().optional(),
    association: z.string().optional(),
    associatedHostId: z.string().optional(),
    bio: z.string().optional()
});

async function getGuestOnboardingRequest(fastify: FastifyInstance, userId: string) {
    const reqSnapshot = await fastify.db.collection('onboarding_requests')
        .where('uid', '==', userId)
        .limit(1)
        .get();

    if (reqSnapshot.empty) return null;

    const doc = reqSnapshot.docs[0];
    const raw = doc.data();
    return {
        id: doc.id,
        status: raw.status,
        type: raw.type,
        submittedAt: raw.submittedAt ?? raw.createdAt ?? null,
        reviewedAt: raw.reviewedAt ?? null,
        rejectionReason: raw.rejectionReason ?? null,
    };
}

async function getUnreadNotificationCount(fastify: FastifyInstance, userId: string) {
    try {
        const snapshot = await fastify.db.collection('notifications')
            .where('userId', '==', userId)
            .where('isRead', '==', false)
            .count()
            .get();
        return snapshot.data().count || 0;
    } catch (error) {
        fastify.log.warn({ userId, error }, 'Unable to load guest unread notification count');
        return 0;
    }
}

function isProduction() {
    return process.env.NODE_ENV === 'production';
}

function serializeCookie(name: string, value: string, maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
    const parts = [
        `${name}=${encodeURIComponent(value)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${maxAgeSeconds}`,
    ];

    if (isProduction()) {
        parts.push('Secure');
    }

    return parts.join('; ');
}

function clearCookie(reply: any) {
    appendSetCookieHeader(reply, `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction() ? '; Secure' : ''}`);
    appendSetCookieHeader(reply, serializeGuestCsrfClearCookie());
}

function setSessionCookie(reply: any, sessionCookie: string, rememberMe = true) {
    appendSetCookieHeader(
        reply,
        serializeCookie(SESSION_COOKIE_NAME, sessionCookie, rememberMe ? SESSION_MAX_AGE_SECONDS : 60 * 60 * 24)
    );
}

function getFirebaseWebApiKey() {
    return process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
}

function getPortalBaseUrl() {
    return (
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.FRONTEND_URLS?.split(',').map((entry) => entry.trim()).find(Boolean) ||
        'http://localhost:3000'
    );
}

function getGoogleRedirectUri() {
    return `${getPortalBaseUrl().replace(/\/+$/, '')}/api/v1/auth/google/callback`;
}

function getPasswordResetContinueUrl(explicit?: string, email?: string) {
    if (explicit) return explicit;

    const url = new URL('/login', getPortalBaseUrl());
    url.searchParams.set('reset', '1');
    if (email) url.searchParams.set('email', email);
    return url.toString();
}

function encodeState(payload: Record<string, any>) {
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeState(value?: string) {
    if (!value) return {};
    try {
        return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    } catch {
        return {};
    }
}

function toBootstrapIdentity(userRecord: any) {
    return {
        uid: userRecord.uid,
        email: userRecord.email || null,
        displayName: userRecord.displayName || null,
        photoURL: userRecord.photoURL || null,
        phoneNumber: userRecord.phoneNumber || null,
        providerId: userRecord.providerData?.[0]?.providerId || null,
        emailVerified: userRecord.emailVerified === true,
    };
}

async function callIdentityToolkit(fastify: FastifyInstance, action: string, payload: Record<string, any>) {
    const apiKey = getFirebaseWebApiKey();
    if (!apiKey) {
        const error = new Error('Firebase Web API key is not configured on the gateway.');
        // @ts-ignore
        error.statusCode = 500;
        throw error;
    }

    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data?.error?.message || 'Authentication request failed');
        // @ts-ignore
        error.statusCode = response.status;
        // @ts-ignore
        error.code = data?.error?.message || 'AUTH_REQUEST_FAILED';
        throw error;
    }

    return data;
}

function mapAuthErrorMessage(error: any) {
    const code = error?.code || error?.message || '';
    switch (code) {
        case 'EMAIL_NOT_FOUND':
        case 'INVALID_PASSWORD':
        case 'INVALID_LOGIN_CREDENTIALS':
            return 'Incorrect email or password.';
        case 'EMAIL_EXISTS':
            return 'An account with this email already exists.';
        case 'TOO_MANY_ATTEMPTS_TRY_LATER':
            return 'Too many attempts. Please try again later.';
        case 'USER_DISABLED':
            return 'This account has been disabled.';
        default:
            return error?.message || 'Authentication failed.';
    }
}

async function buildBootstrapForUid(fastify: FastifyInstance, userLike: Record<string, any>) {
    const userId = userLike?.uid;
    const [userDocResult, onboardingRequestResult, unreadCountResult] = await Promise.allSettled([
        fastify.db.collection('users').doc(userId).get(),
        getGuestOnboardingRequest(fastify, userId),
        getUnreadNotificationCount(fastify, userId),
    ]);

    if (userDocResult.status !== 'fulfilled') {
        throw userDocResult.reason;
    }

    return buildGuestAuthBootstrap({
        user: userLike,
        rawProfile: userDocResult.value.exists ? { uid: userDocResult.value.id, ...userDocResult.value.data() } : null,
        onboardingRequest: onboardingRequestResult.status === 'fulfilled' ? onboardingRequestResult.value : null,
        unreadNotificationCount: unreadCountResult.status === 'fulfilled' ? unreadCountResult.value : 0,
    });
}

async function createSessionFromIdToken(fastify: FastifyInstance, reply: any, idToken: string, rememberMe = true) {
    const expiresIn = SESSION_MAX_AGE_SECONDS * 1000;
    const auth = (fastify as any).auth;
    const decodedIdToken = await auth.verifyIdToken(idToken);
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
    setSessionCookie(reply, sessionCookie, rememberMe);
    issueGuestCsrfCookie(reply, rememberMe ? SESSION_MAX_AGE_SECONDS : 60 * 60 * 24);
    return decodedIdToken;
}

export default async function authRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/auth/csrf
     * Bootstrap CSRF token for unauthenticated clients
     */
    fastify.get('/csrf', async (request, reply) => {
        const token = ensureGuestCsrfCookie(request, reply);
        return { success: true, csrfToken: token };
    });

    fastify.get('/me', async (request: any, reply) => {
        try {
            reply.header('Cache-Control', 'private, no-store');
            const csrfToken = ensureGuestCsrfCookie(request, reply);
            const userId = request.user?.uid;
            
            if (!userId) {
                if (request.authVerification?.status === 'error') {
                    return reply.status(503).send(buildErrorResponse({
                        code: 'AUTH_TEMPORARILY_UNAVAILABLE',
                        message: 'Authentication is temporarily unavailable.',
                        requestId: request.id,
                    }));
                }
                return { 
                    authenticated: false, 
                    user: null, 
                    profile: null,
                    csrfToken 
                };
            }

            try {
                return {
                    authenticated: true,
                    ...(await buildBootstrapForUid(fastify, request.user)),
                    csrfToken,
                };
            } catch (bootstrapError: any) {
                fastify.log.warn({
                    requestId: request.id,
                    userId,
                    error: bootstrapError?.message || String(bootstrapError),
                }, 'GET /auth/me bootstrap degraded to identity-only fallback');

                return {
                    authenticated: true,
                    ...buildGuestAuthBootstrap({
                        user: request.user,
                        rawProfile: null,
                        onboardingRequest: null,
                        unreadNotificationCount: 0,
                    }),
                    csrfToken,
                };
            }
        } catch (error: any) {
            fastify.log.error(`Error in GET /auth/me: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });

    fastify.post('/login', {
        preHandler: [fastify.validate({ body: LoginSchema })],
    }, async (request: any, reply) => {
        try {
            const { email, password, rememberMe = true } = request.body;
            const signIn = await callIdentityToolkit(fastify, 'signInWithPassword', {
                email: String(email).trim().toLowerCase(),
                password,
                returnSecureToken: true,
            });

            const decoded = await createSessionFromIdToken(fastify, reply, signIn.idToken, rememberMe);
            const userRecord = await fastify.auth.getUser(decoded.uid);
            const bootstrap = await buildBootstrapForUid(fastify, toBootstrapIdentity(userRecord));
            return { success: true, bootstrap };
        } catch (error: any) {
            const message = mapAuthErrorMessage(error);
            return reply.status(error?.statusCode || 401).send(buildErrorResponse({
                code: error?.code || 'AUTH_LOGIN_FAILED',
                message,
                requestId: request.id,
            }));
        }
    });

    fastify.post('/register', {
        preHandler: [fastify.validate({ body: RegisterSchema })],
    }, async (request: any, reply) => {
        try {
            const body = request.body;
            const email = String(body.email).trim().toLowerCase();
            const displayName = body.displayName || 'Member';
            const userRecord = await fastify.auth.createUser({
                email,
                password: body.password,
                displayName,
            });

            const profileDoc = buildGuestProfileCreatePayload({
                email,
                displayName,
                age: body.age,
                gender: body.gender,
                phone: body.phone,
                city: body.city,
                instagram: body.instagram,
                onboardingComplete: body.onboardingComplete === true,
            }, {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                photoURL: userRecord.photoURL,
                phoneNumber: userRecord.phoneNumber,
            }, new Date().toISOString());

            await fastify.profileService.createProfile(profileDoc);

            const signIn = await callIdentityToolkit(fastify, 'signInWithPassword', {
                email,
                password: body.password,
                returnSecureToken: true,
            });

            await createSessionFromIdToken(fastify, reply, signIn.idToken, true);
            const bootstrap = await buildBootstrapForUid(fastify, toBootstrapIdentity(userRecord));
            return { success: true, bootstrap };
        } catch (error: any) {
            const message = mapAuthErrorMessage(error);
            return reply.status(error?.statusCode || 400).send(buildErrorResponse({
                code: error?.code || 'AUTH_REGISTER_FAILED',
                message,
                requestId: request.id,
            }));
        }
    });

    fastify.post('/logout', async (request: any, reply) => {
        clearCookie(reply);
        return { success: true };
    });

    fastify.post('/password-reset', {
        preHandler: [fastify.validate({ body: PasswordResetSchema })],
    }, async (request: any, reply) => {
        try {
            const email = String(request.body.email).trim().toLowerCase();
            await callIdentityToolkit(fastify, 'sendOobCode', {
                requestType: 'PASSWORD_RESET',
                email,
                continueUrl: getPasswordResetContinueUrl(request.body.continueUrl, email),
            });
            return { success: true };
        } catch (error: any) {
            return reply.status(error?.statusCode || 400).send(buildErrorResponse({
                code: error?.code || 'PASSWORD_RESET_FAILED',
                message: 'Something went wrong. If that account exists, we sent a link.',
                requestId: request.id,
            }));
        }
    });

    fastify.post('/change-password', {
        preHandler: [fastify.validate({ body: ChangePasswordSchema })],
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));

        try {
            const userRecord = await fastify.auth.getUser(userId);
            if (!userRecord.email) {
                return reply.status(400).send(buildErrorResponse({
                    code: 'PASSWORD_CHANGE_UNSUPPORTED',
                    message: 'This account cannot change its password here.',
                    requestId: request.id,
                }));
            }

            await callIdentityToolkit(fastify, 'signInWithPassword', {
                email: userRecord.email,
                password: request.body.currentPassword,
                returnSecureToken: true,
            });

            await fastify.auth.updateUser(userId, { password: request.body.newPassword });
            return { success: true };
        } catch (error: any) {
            return reply.status(error?.statusCode || 400).send(buildErrorResponse({
                code: error?.code || 'PASSWORD_CHANGE_FAILED',
                message: mapAuthErrorMessage(error),
                requestId: request.id,
            }));
        }
    });

    fastify.get('/google/start', {
        preHandler: [fastify.validate({ querystring: GoogleStartQuerySchema })],
    }, async (request: any, reply) => {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) {
            const target = new URL('/login', getPortalBaseUrl());
            target.searchParams.set('error', 'google_sign_in_unavailable');
            return reply.redirect(target.toString());
        }

        const state = encodeState({ next: request.query.next || '/auth/callback' });
        const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authorizeUrl.searchParams.set('client_id', clientId);
        authorizeUrl.searchParams.set('redirect_uri', getGoogleRedirectUri());
        authorizeUrl.searchParams.set('response_type', 'code');
        authorizeUrl.searchParams.set('scope', 'openid email profile');
        authorizeUrl.searchParams.set('access_type', 'offline');
        authorizeUrl.searchParams.set('prompt', 'select_account');
        authorizeUrl.searchParams.set('state', state);

        return reply.redirect(authorizeUrl.toString());
    });

    fastify.get('/google/callback', {
        preHandler: [fastify.validate({ querystring: GoogleCallbackQuerySchema })],
    }, async (request: any, reply) => {
        const nextPath = decodeState(request.query.state).next || '/auth/callback';

        if (request.query.error) {
            return reply.redirect(`${getPortalBaseUrl()}${nextPath}?error=${encodeURIComponent(request.query.error)}`);
        }

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret || !request.query.code) {
            return reply.redirect(`${getPortalBaseUrl()}${nextPath}?error=${encodeURIComponent('google_sign_in_unavailable')}`);
        }

        try {
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code: request.query.code,
                    client_id: clientId,
                    client_secret: clientSecret,
                    redirect_uri: getGoogleRedirectUri(),
                    grant_type: 'authorization_code',
                }),
            });
            const tokenData = await tokenResponse.json();
            if (!tokenResponse.ok || !tokenData.id_token) {
                throw new Error(tokenData?.error || 'GOOGLE_TOKEN_EXCHANGE_FAILED');
            }

            const signIn = await callIdentityToolkit(fastify, 'signInWithIdp', {
                postBody: `id_token=${encodeURIComponent(tokenData.id_token)}&providerId=google.com`,
                requestUri: getPortalBaseUrl(),
                returnIdpCredential: true,
                returnSecureToken: true,
            });

            await createSessionFromIdToken(fastify, reply, signIn.idToken, true);

            const userRecord = await fastify.auth.getUser(signIn.localId);
            const existingProfile = await fastify.db.collection('users').doc(userRecord.uid).get();
            if (!existingProfile.exists) {
                const profileDoc = buildGuestProfileCreatePayload({
                    email: userRecord.email,
                    displayName: userRecord.displayName || 'Member',
                    photoURL: userRecord.photoURL || '',
                    avatar: userRecord.photoURL || '',
                    onboardingComplete: false,
                }, {
                    uid: userRecord.uid,
                    email: userRecord.email,
                    displayName: userRecord.displayName,
                    photoURL: userRecord.photoURL,
                    phoneNumber: userRecord.phoneNumber,
                }, new Date().toISOString());
                await fastify.profileService.createProfile(profileDoc);
            }

            return reply.redirect(`${getPortalBaseUrl()}${nextPath}`);
        } catch (error: any) {
            fastify.log.error({ error: error.message }, 'Google sign-in failed');
            const isAccountConflict =
                error?.message?.includes('EMAIL_EXISTS') ||
                error?.message?.includes('FEDERATED_USER_ID_ALREADY_LINKED') ||
                error?.message?.includes('ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL');
            const errorCode = isAccountConflict ? 'account_exists_with_different_credential' : 'google_sign_in_failed';
            return reply.redirect(`${getPortalBaseUrl()}${nextPath}?error=${encodeURIComponent(errorCode)}`);
        }
    });

    fastify.post('/session', async (request: any, reply) => {
        const { idToken, rememberMe = true } = request.body || {};
        if (!idToken) {
            clearCookie(reply);
            return { success: true, message: 'Session cleared' };
        }

        try {
            await createSessionFromIdToken(fastify, reply, idToken, rememberMe);
            return { success: true, message: 'Session synchronized' };
        } catch (error: any) {
            return reply.status(401).send(buildErrorResponse({
                code: 'AUTH_SESSION_FAILED',
                message: 'Failed to synchronize session',
                requestId: request.id,
            }));
        }
    });

    fastify.delete('/session', async (request: any, reply) => {
        clearCookie(reply);
        return { success: true, message: 'Session cleared' };
    });

    fastify.post('/check', {
        preHandler: [fastify.validate({ body: AuthCheckSchema })],
    }, async (request: any, reply) => {
        const { email } = request.body;

        try {
            await fastify.auth.getUserByEmail(email);
            return { exists: true };
        } catch (error: any) {
            if (error?.code === 'auth/user-not-found') return { exists: false };
            fastify.log.error(`Error in POST /auth/check: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'AUTH_CHECK_FAILED',
                message: 'Check protocol failed',
                requestId: request.id,
            }));
        }
    });

    fastify.post('/otp/send', {
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
        preHandler: [fastify.validate({ body: OtpSendSchema })],
    }, async (request: any, reply) => {
        const { sendGuestOtp } = await import('../../lib/guest-otp');
        const { type, recipient } = request.body;

        try {
            return await sendGuestOtp(fastify.db, type, recipient);
        } catch (error: any) {
            fastify.log.warn({ requestId: request.id, type, error: error.message }, 'OTP send failed');
            return reply.status(400).send(buildErrorResponse({
                code: 'OTP_SEND_FAILED',
                message: error.message || 'An unexpected error occurred during OTP dispatch.',
                requestId: request.id,
            }));
        }
    });

    fastify.post('/otp/verify', {
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
        preHandler: [fastify.validate({ body: OtpVerifySchema })],
    }, async (request: any, reply) => {
        const { verifyGuestOtp } = await import('../../lib/guest-otp');
        const { type, recipient, code } = request.body;

        try {
            return await verifyGuestOtp(fastify.db, type, recipient, code);
        } catch (error: any) {
            return reply.status(400).send(buildErrorResponse({
                code: 'OTP_VERIFY_FAILED',
                message: error.message || 'Protocol mismatch.',
                requestId: request.id,
            }));
        }
    });

    fastify.post('/onboard', {
        preHandler: [fastify.validate({ body: OnboardSchema })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));

        const body = request.body;
        const { type, email, name } = body;

        if (!type || !email || !name) {
            return reply.status(400).send(buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'Missing required fields',
                requestId: request.id,
            }));
        }

        try {
            const userRef = fastify.db.collection('users').doc(userId);
            await userRef.set({
                uid: userId,
                email,
                displayName: name,
                role: 'onboarding',
                isApproved: false,
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });

            const requestId = `req_${Date.now()}_${userId.substring(0, 5)}`;
            await fastify.db.collection('onboarding_requests').doc(requestId).set({
                id: requestId,
                uid: userId,
                type,
                status: "pending",
                data: {
                    ...body,
                },
                submittedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });

            return { success: true, requestId };
        } catch (error: any) {
            fastify.log.error(`Error in POST /auth/onboard: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });
}
