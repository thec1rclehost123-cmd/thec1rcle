import { z } from 'zod';

/**
 * ─── V2 API contract runtime schemas ─────────────────────────────────────────
 * Browser-safe zod schemas for the shared wire contract. The frontend imports
 * these from `@c1rcle/types/client`; it never redefines canonical shapes.
 *
 * Use top-level `z.email()`/`z.url()` (zod v4) rather than string regex chains.
 */

export const roleSchema = z.enum(['guest', 'partner', 'admin']);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  displayName: z.string().min(1),
  role: roleSchema,
  avatarUrl: z.url().nullable(),
});
export type User = z.infer<typeof userSchema>;

export const sessionSchema = z.object({
  user: userSchema,
  expiresAt: z.number().int().positive(),
});
export type Session = z.infer<typeof sessionSchema>;

export const pageInfoSchema = z.object({
  page: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
});
export type PageInfo = z.infer<typeof pageInfoSchema>;

export function paginatedSchema<TItem extends z.ZodType>(itemSchema: TItem) {
  return z.object({
    items: z.array(itemSchema),
    pageInfo: pageInfoSchema,
  });
}
export type Paginated<TItem> = {
  items: TItem[];
  pageInfo: PageInfo;
};

/** Successful responses with no body (`204 No Content`). */
export const noContentSchema = z.void();
export type NoContent = z.infer<typeof noContentSchema>;

/**
 * ─── T06 shared validation helpers ───────────────────────────────────────────
 * Small, browser-safe zod building blocks shared by gateway routes and the
 * frontend. Every `/api/v2` route composes these — never hand-parses.
 */

/** V2 opaque resource id: 1–64 chars, alphanumeric + `_`/`-`. */
export const opaqueIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Invalid opaque id format');
export type OpaqueId = z.infer<typeof opaqueIdSchema>;

/** Opaque pagination cursor (base64/opaque server token). */
export const cursorSchema = z.string().min(1).max(256);
export type Cursor = z.infer<typeof cursorSchema>;

/** Cursor pagination query, shared by every V2 list route. */
export const paginationQuerySchema = z.object({
  cursor: cursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** `Idempotency-Key` header (write routes) — bounded, URL-safe. */
export const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid Idempotency-Key format');
export type IdempotencyKey = z.infer<typeof idempotencyKeySchema>;

/** `If-Match` header — a positive integer optimistic-lock version. */
export const versionHeaderSchema = z
  .string()
  .regex(/^[1-9][0-9]*$/, 'If-Match must be a positive integer version');
export type IfMatchVersion = z.infer<typeof versionHeaderSchema>;

/** `X-Organization-Id` header/param — partner-scoped resource routing. */
export const organizationIdSchema = opaqueIdSchema;
export type OrganizationId = z.infer<typeof organizationIdSchema>;

/**
 * Canonical V2 partner Event DTO (read model). Derived from the domain model
 * in `@c1rcle/core/domain` but owned here as the wire contract. Response
 * schemas at route level validate server payloads against this before send.
 */
export const eventStatusSchema = z.enum([
  'draft',
  'review',
  'scheduled',
  'published',
  'sales_paused',
  'started',
  'ended',
  'archived',
  'cancelled',
]);
export type EventStatusDto = z.infer<typeof eventStatusSchema>;

export const eventDtoSchema = z.object({
  id: opaqueIdSchema,
  organizationId: opaqueIdSchema,
  venueId: opaqueIdSchema.nullable(),
  title: z.string().min(1).max(200),
  summary: z.string().max(1000).default(''),
  description: z.string().max(20_000).default(''),
  imageUrl: z.url().nullable(),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime().nullable(),
  status: eventStatusSchema,
  isPublic: z.boolean(),
  tags: z.array(z.string().min(1)).max(50).default([]),
  startingPricePaise: z.number().int().nonnegative().nullable(),
  isFree: z.boolean(),
  cancellationReason: z.string().max(1000).nullable(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type EventDto = z.infer<typeof eventDtoSchema>;

/**
 * ─── Organization + venue DTOs (partner slice) ────────────────────────────────
 * Canonical read models for the organizations/venues manifest routes. Owned
 * here as the wire contract; routes validate responses against these before
 * send. Frontend imports them — it never redefines the shapes.
 */

/** Role a member holds within an organization (org-scoped, not global `Role`). */
export const organizationRoleSchema = z.enum(['owner', 'admin', 'manager', 'member']);
export type OrganizationRoleDto = z.infer<typeof organizationRoleSchema>;

export const organizationStatusSchema = z.enum(['active', 'suspended', 'archived']);
export type OrganizationStatusDto = z.infer<typeof organizationStatusSchema>;

export const organizationDtoSchema = z.object({
  id: opaqueIdSchema,
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Invalid slug format'),
  /** Caller's role within the org (from `organizations.list`). */
  role: organizationRoleSchema,
  status: organizationStatusSchema,
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type OrganizationDto = z.infer<typeof organizationDtoSchema>;

export const venueStatusSchema = z.enum(['active', 'suspended']);
export type VenueStatusDto = z.infer<typeof venueStatusSchema>;

export const venueDtoSchema = z.object({
  id: opaqueIdSchema,
  organizationId: opaqueIdSchema,
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Invalid slug format'),
  status: venueStatusSchema,
  /** Public-facing; contact/business details never appear here. */
  description: z.string().max(2000).default(''),
  capacity: z.number().int().nonnegative().nullable(),
  city: z.string().max(100).nullable(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type VenueDto = z.infer<typeof venueDtoSchema>;

/**
 * Canonical index-surface resolvers. These guarantee the runtime schemas in
 * this file stay in lockstep with the type-only declarations in `index.ts`.
 */
export {
  roleSchema as canonicalRoleSchema,
  userSchema as canonicalUserSchema,
  sessionSchema as canonicalSessionSchema,
  organizationRoleSchema as canonicalOrganizationRoleSchema,
  organizationDtoSchema as canonicalOrganizationDtoSchema,
  venueDtoSchema as canonicalVenueDtoSchema,
};
