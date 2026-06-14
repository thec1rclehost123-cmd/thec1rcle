import { FastifyInstance } from 'fastify';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
import {
    appendSetCookieHeader,
    ensureGuestCsrfCookie,
    issueGuestCsrfCookie,
    serializeGuestCsrfClearCookie,
} from '../../lib/guest-csrf';
import { buildGuestAuthBootstrap, buildGuestProfileCreatePayload } from '../../lib/guest-auth';
import { sendGuestOtp, verifyGuestOtp } from '../../lib/guest-otp';
import { getPermissionsForRole, getDefaultTabVisibility, PROMOTER_COMMISSION_TIERS } from '../../lib/rbac-permissions';
// @ts-ignore
import { getGuestUnreadCount } from '@c1rcle/core/guest-wallet-profile-notification-service';

const SESSION_COOKIE_NAME = '__session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

const AuthCheckSchema = z.object({
    email: z.string().email(),
}).strict();

const OtpSendSchema = z.object({
    type: z.enum(['email', 'phone']),
    recipient: z.string().min(3),
});

const OtpVerifySchema = z.object({
    type: z.enum(['email', 'phone']),
    recipient: z.string().min(3),
    code: z.string().min(4).max(10),
});

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
    entityType: z.string().optional(),
    name: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    contactPerson: z.string().optional(),
    city: z.string().optional(),
    area: z.string().optional(),
    website: z.string().optional(),
    capacity: z.string().optional(),
    plan: z.string().optional(),
    role: z.string().optional(),
    association: z.string().optional(),
    associatedHostId: z.string().optional(),
    instagram: z.string().optional(),
    bio: z.string().optional(),
    upcomingEventsText: z.string().optional(),
    pastEventsText: z.string().optional(),
    businessType: z.string().optional(),
    registrationNumber: z.string().optional(),
    kycStepData: z.any().optional(),
});

const CreateAccountSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    phone: z.string().min(10).optional(),
});

// Normalize to E.164: plain 10-digit numbers are assumed Indian (+91).
function toE164(phone: string): string {
    if (phone.startsWith('+')) return phone;
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

const HostVerificationSchema = z.object({
    documentType: z.string().optional(),
    documentId: z.string().optional(),
    companyName: z.string().optional(),
    taxId: z.string().optional(),
    country: z.string().optional()
}).catchall(z.any()); // Allowed catchall just for host-verification because frontend fields vary, but will use .strict() in standard entities.
async function getGuestOnboardingRequest(fastify: FastifyInstance, userId: string) {
    // 1. Direct lookup via onboardingRequestId stored on the user doc
    try {
        const userDoc = await fastify.db.collection('users').doc(userId).get();
        const userData = userDoc.data() || {};
        const requestId = userData.onboardingRequestId;
        if (requestId) {
            const reqDoc = await fastify.db.collection('onboarding_requests').doc(requestId).get();
            if (reqDoc.exists) {
                const d = reqDoc.data() || {};
                return { id: reqDoc.id, status: d.status, type: d.type, submittedAt: d.submittedAt ?? d.createdAt ?? null, reviewedAt: d.reviewedAt ?? null, rejectionReason: d.rejectionReason ?? null };
            }
        }
    } catch (_e) { /* fall through */ }

    // 2. Fallback query by uid (requires Firestore index on onboarding_requests.uid)
    try {
        const snap = await fastify.db.collection('onboarding_requests').where('uid', '==', userId).limit(1).get();
        if (!snap.empty) {
            const d = snap.docs[0].data();
            return { id: snap.docs[0].id, status: d.status, type: d.type, submittedAt: d.submittedAt ?? d.createdAt ?? null, reviewedAt: d.reviewedAt ?? null, rejectionReason: d.rejectionReason ?? null };
        }
    } catch (_e) { /* fallback failed — missing index */ }

    return null;
}

async function getUnreadNotificationCount(fastify: FastifyInstance, userId: string) {
    try {
        return await getGuestUnreadCount(fastify.db, userId);
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

/**
 * 🛡️ Self-Healing: Ensures a Firestore profile exists for an authenticated user.
 * Prevents "Ghost Users" if registration or OAuth callback fails mid-flow.
 */
async function ensureProfile(fastify: FastifyInstance, user: any) {
    const userId = user.uid;
    const profileRef = fastify.db.collection('users').doc(userId);

    return await fastify.db.runTransaction(async (transaction) => {
        const doc = await transaction.get(profileRef);
        if (doc.exists) {
            return { ...doc.data(), uid: doc.id };
        }

        // Create a skeleton profile
        const profileDoc = buildGuestProfileCreatePayload({
            email: user.email || '',
            displayName: user.displayName || 'Member',
            photoURL: user.photoURL || '',
            avatar: user.photoURL || '',
            onboardingComplete: false,
        }, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            phoneNumber: user.phoneNumber,
        }, new Date().toISOString());

        transaction.set(profileRef, profileDoc);
        return { ...profileDoc, uid: userId };
    });
}

async function buildBootstrapForUid(fastify: FastifyInstance, userLike: Record<string, any>) {
    const userId = userLike?.uid;
    
    // We try to fetch the profile. If it's missing, we self-heal.
    const [profile, onboardingRequestResult, unreadCountResult] = await Promise.allSettled([
        ensureProfile(fastify, userLike),
        getGuestOnboardingRequest(fastify, userId),
        getUnreadNotificationCount(fastify, userId),
    ]);

    if (profile.status !== 'fulfilled') {
        // If critical failure, throw
        throw profile.reason;
    }

    return buildGuestAuthBootstrap({
        user: userLike,
        rawProfile: profile.value,
        onboardingRequest: onboardingRequestResult.status === 'fulfilled' ? onboardingRequestResult.value : null,
        unreadNotificationCount: unreadCountResult.status === 'fulfilled' ? unreadCountResult.value : 0,
        activeMembership: userLike.activeMembership || null,
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
        return buildSuccessResponse({ csrfToken: token });
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
                await fastify.enrichAuthContext(request);
                const bootstrap = await buildBootstrapForUid(fastify, request.user) as any;
                const activeMembership = (request.user as any)?.activeMembership || null;
                return {
                    authenticated: true,
                    ...bootstrap,
                    // Inject activeMembership into user so data.user.activeMembership is
                    // accessible to clients that read it from the user object directly.
                    user: activeMembership
                        ? { ...bootstrap.user, activeMembership }
                        : bootstrap.user,
                    activeMembership,
                    csrfToken,
                };
            } catch (bootstrapError: any) {
                fastify.log.warn({
                    requestId: request.id,
                    userId,
                    error: bootstrapError?.message || String(bootstrapError),
                }, 'GET /auth/me bootstrap degraded to identity-only fallback');

                const activeMembership = (request.user as any)?.activeMembership || null;
                return {
                    authenticated: true,
                    ...buildGuestAuthBootstrap({
                        user: request.user,
                        rawProfile: null,
                        onboardingRequest: null,
                        unreadNotificationCount: 0,
                    }),
                    activeMembership,
                    csrfToken,
                };
            }

        } catch (error: any) {
            fastify.log.error({
                requestId: request.id,
                error: error?.message,
                stack: error?.stack,
            }, 'GET /auth/me unhandled error');
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: process.env.NODE_ENV !== 'production' ? (error?.message || 'Internal Server Error') : 'Internal Server Error',
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
            const userLike = {
                ...toBootstrapIdentity(userRecord),
                ...decoded,
            };
            const dummyRequest = { user: userLike } as any;
            await fastify.enrichAuthContext(dummyRequest);
            const bootstrap = await buildBootstrapForUid(fastify, dummyRequest.user);
            return buildSuccessResponse({ bootstrap });
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
            return buildSuccessResponse({ bootstrap });
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

    /**
     * POST /api/v1/auth/create-account
     * Create a new Firebase user and return a custom token for client-side login.
     */
    fastify.post('/create-account', {
        preHandler: [fastify.validate({ body: CreateAccountSchema })],
    }, async (request: any, reply) => {
        const { email, password, phone } = request.body;

        try {
            // 1. Create the user in Firebase Auth
            const e164Phone = phone ? toE164(phone) : null;
            const userRecord = await fastify.auth.createUser({
                email,
                password,
                ...(e164Phone && { phoneNumber: e164Phone }),
            });

            // 2. Seed a Firestore user doc immediately so partial registrations
            //    have a proper record (role: 'pending', isApproved: false).
            //    Without this, users who abandon onboarding have no Firestore doc
            //    and can neither log in nor re-onboard.
            const cleanPhone = e164Phone;
            await fastify.db.collection('users').doc(userRecord.uid).set({
                uid: userRecord.uid,
                email,
                displayName: email.split('@')[0] || 'Member',
                phone: cleanPhone,
                role: 'pending',
                isApproved: false,
                onboardingComplete: false,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            // 3. Generate a custom token so the client can sign in immediately
            const customToken = await fastify.auth.createCustomToken(userRecord.uid);

            return buildSuccessResponse({ uid: userRecord.uid, customToken });
        } catch (error: any) {
            if (error.code === 'auth/email-already-exists') {
                return reply.status(409).send(buildErrorResponse({
                    code: 'EMAIL_ALREADY_EXISTS',
                    message: 'This email is already registered.',
                    requestId: request.id,
                }));
            }
            if (error.code === 'auth/invalid-phone-number' || error.message === 'INVALID_LENGTH') {
                return reply.status(400).send(buildErrorResponse({
                    code: 'INVALID_PHONE_NUMBER',
                    message: 'Invalid phone number. Please include your country code (e.g. +91 9876543210).',
                    requestId: request.id,
                }));
            }
            fastify.log.error(`Error in POST /auth/create-account: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'CREATE_ACCOUNT_FAILED',
                message: error.message || 'Failed to create account.',
                requestId: request.id,
            }));
        }
    });

    /**
     * POST /api/v1/auth/check-availability
     * Check if an email or phone number is already registered.
     * Returns which fields are taken so the frontend can show field-level errors.
     */
    const CheckAvailabilitySchema = z.object({
        email: z.string().email().optional(),
        phone: z.string().optional(),
    });

    fastify.post('/check-availability', {
        preHandler: [fastify.validate({ body: CheckAvailabilitySchema })],
    }, async (request: any, reply) => {
        const { email, phone } = request.body;
        const taken: string[] = [];

        try {
            if (email) {
                try {
                    await fastify.auth.getUserByEmail(email);
                    taken.push('email');
                } catch (e: any) {
                    if (e.code !== 'auth/user-not-found') throw e;
                }
            }
            if (phone) {
                const cleanPhone = toE164(phone);
                try {
                    await fastify.auth.getUserByPhoneNumber(cleanPhone);
                    taken.push('phone');
                } catch (e: any) {
                    if (e.code !== 'auth/user-not-found') throw e;
                }
            }
        } catch (error: any) {
            fastify.log.error({ error: error.message }, 'Check-availability failed');
            return reply.status(500).send(buildErrorResponse({
                code: 'CHECK_FAILED',
                message: 'Availability check failed',
                requestId: request.id,
            }));
        }

        return {
            success: true,
            available: taken.length === 0,
            taken,
            errors: {
                ...(taken.includes('email') ? { email: 'This email is already registered.' } : {}),
                ...(taken.includes('phone') ? { phone: 'This phone number is already registered.' } : {}),
            },
        };
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
            
            // 🛡️ Reliability: Ensure atomic profile creation to prevent race conditions
            await fastify.db.runTransaction(async (transaction) => {
                const profileRef = fastify.db.collection('users').doc(userRecord.uid);
                const existingProfile = await transaction.get(profileRef);
                
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
                    
                    transaction.set(profileRef, profileDoc);
                }
            });

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

    /**
     * PATCH /api/v1/auth/onboarding-progress
     * Save the user's current onboarding step + entityType so they can resume
     * if they leave mid-form. Called after each step transition.
     */
    const OnboardingProgressSchema = z.object({
        onboardingStep: z.string(),
        entityType: z.string().optional(),
    });

    fastify.patch('/onboarding-progress', {
        preHandler: [fastify.requireAuth, fastify.validate({ body: OnboardingProgressSchema })],
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) {
            return reply.status(401).send(buildErrorResponse({
                code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id,
            }));
        }
        const { onboardingStep, entityType } = request.body;
        const update: Record<string, any> = { onboardingStep, updatedAt: FieldValue.serverTimestamp() };
        if (entityType) update.entityType = entityType;
        await fastify.db.collection('users').doc(userId).set(update, { merge: true });
        return { success: true };
    });

    // 🛡️ Security: Removed /auth/check to prevent account enumeration. 
    // Registration should handle "Email already exists" errors within the secure /auth/register flow.

    /**
     * POST /api/v1/auth/otp/send
     */
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
            fastify.log.warn({ requestId: request.id, recipient, error: error.message }, 'OTP verification failed');
            return reply.status(400).send(buildErrorResponse({
                code: 'OTP_VERIFY_FAILED',
                message: error.message || 'Protocol mismatch.',
                requestId: request.id,
            }));
        }
    });

    fastify.post('/onboard', {
        preHandler: [fastify.requireAuth, fastify.validate({ body: OnboardSchema })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;

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
            const updateData: Record<string, any> = {
                uid: userId,
                email,
                displayName: name,
                role: 'onboarding',
                isApproved: false,
                onboardingComplete: true,
                updatedAt: FieldValue.serverTimestamp(),
            };
            // Persist phone from the onboarding data so the users collection
            // has it for recovery/login flows — it was missing before.
            if (body.phone) {
                updateData.phone = body.phone.startsWith('+') ? body.phone : `+${body.phone}`;
            }
            // Persist business-specific fields from the details form so they're
            // available on the user profile even before admin approval.
            if (body.entityType === 'business') {
                if (body.businessType) updateData.businessType = body.businessType;
                if (body.registrationNumber) updateData.registrationNumber = body.registrationNumber;
            }
            if (body.contactPerson) updateData.contactPerson = body.contactPerson;
            if (body.city) updateData.city = body.city;
            if (body.area) updateData.area = body.area;
            if (body.website) updateData.website = body.website;
            if (body.capacity) updateData.capacity = body.capacity;
            if (body.plan) updateData.plan = body.plan;
            if (body.entityType) updateData.entityType = body.entityType;
            if (body.instagram) updateData.instagram = body.instagram;
            if (body.bio) updateData.bio = body.bio;
            if (body.role) updateData.onboardingRole = body.role;
            await userRef.set(updateData, { merge: true });

            const requestId = `req_${Date.now()}_${userId.substring(0, 5)}`;
            // Store the requestId on the user doc so getGuestOnboardingRequest
            // can do a direct lookup instead of a Firestore query (which needs an index).
            await userRef.set({ onboardingRequestId: requestId }, { merge: true });
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

            return buildSuccessResponse({ requestId });
        } catch (error: any) {
            fastify.log.error(`Error in POST /auth/onboard: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });
    /**
     * GET /api/v1/auth/onboard-status
     */
    fastify.get('/onboard-status', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { requestId } = request.query as any;
        if (!requestId) {
            return reply.status(400).send(buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'requestId is required',
                requestId: request.id,
            }));
        }

        try {
            const doc = await fastify.db.collection('onboarding_requests').doc(requestId).get();
            if (!doc.exists) {
                return reply.status(404).send(buildErrorResponse({
                    code: 'NOT_FOUND',
                    message: 'Onboarding request not found',
                    requestId: request.id,
                }));
            }

            return buildSuccessResponse({ request: doc.data() as Record<string, unknown> });
        } catch (error: any) {
            fastify.log.error(`Error in GET /auth/onboard-status: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });

    /**
     * POST /api/v1/auth/host-verification
     */
    fastify.post('/host-verification', {
        preHandler: [fastify.requireAuth, fastify.validate({ body: HostVerificationSchema })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        const email = request.user?.email;

        const body = request.body;

        try {
            const applicationRef = fastify.db.collection("host_applications").doc();
            await applicationRef.set({
                uid: userId,
                email: email || '',
                ...body,
                status: "pending",
                createdAt: new Date().toISOString(),
            });

            // Note: we might also update the profile hostStatus
            await fastify.profileService.updateProfile(userId, 'user', { hostStatus: 'pending' });

            return buildSuccessResponse({ applicationId: applicationRef.id });
        } catch (error: any) {
            fastify.log.error(`Error in POST /auth/host-verification: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });

    /**
     * GET /api/v1/auth/partner-context
     * Returns the authenticated user's partner permissions and tab visibility
     * computed server-side from their active membership role.
     * Frontend must use these values — never compute permissions locally.
     */
    fastify.get('/partner-context', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        let membership = request.authContext?.activeMembership || request.user?.activeMembership;

        if (!membership) {
            // activeMembership is only pre-loaded when x-workspace-id is sent.
            // Fall back to a direct Firestore lookup so this endpoint works
            // regardless of whether the workspace preHandler ran.
            const uid = request.user?.uid;
            if (uid) {
                try {
                    const primarySnap = await fastify.db
                        .collection('partner_memberships')
                        .where('uid', '==', uid)
                        .where('isActive', '==', true)
                        .limit(1)
                        .get();
                    if (!primarySnap.empty) {
                        membership = primarySnap.docs[0].data();
                    } else {
                        // Some memberships use status:'active' instead of isActive:true
                        const statusSnap = await fastify.db
                            .collection('partner_memberships')
                            .where('uid', '==', uid)
                            .where('status', '==', 'active')
                            .limit(1)
                            .get();
                        if (!statusSnap.empty) {
                            membership = statusSnap.docs[0].data();
                        }
                    }
                } catch (err) {
                    fastify.log.warn({ uid, err }, 'partner-context: membership lookup failed');
                }
            }
        }

        if (!membership) {
            return reply.status(404).send(buildErrorResponse({
                code: 'NO_ACTIVE_PARTNERSHIP',
                message: 'No active partnership found',
                requestId: request.id,
            }));
        }
        const { partnerType, role } = membership;
        const permissions = getPermissionsForRole(partnerType, role);
        const tabVisibility = getDefaultTabVisibility(partnerType, role);
        const context: Record<string, unknown> = {
            partnerType,
            role,
            permissions,
            tabVisibility,
            ...(partnerType === 'promoter' ? { commissionTiers: PROMOTER_COMMISSION_TIERS } : {}),
        };
        return buildSuccessResponse(context);
    });
}
