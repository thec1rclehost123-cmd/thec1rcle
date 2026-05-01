import { z } from "zod";

const truthyBoolean = z.union([z.literal("1"), z.literal("true"), z.literal("yes"), z.literal("on")]);
const falsyBoolean = z.union([z.literal("0"), z.literal("false"), z.literal("no"), z.literal("off")]);

export const guestBffBooleanQuerySchema = z.union([truthyBoolean, falsyBoolean]).optional();
export const guestBffIntegerQuerySchema = z.coerce.number().int().nonnegative();

export const guestBffErrorSchema = z.object({
  code: z.string().optional(),
  details: z.any().optional(),
  message: z.string(),
  requestId: z.string().optional(),
  status: z.number().int().optional(),
}).nullable();

export const guestBffMetaSchema = z.object({
  fetchedAt: z.string(),
  requestId: z.string(),
  source: z.literal("bff"),
  upstreamCalls: z.array(z.object({
    method: z.string(),
    path: z.string(),
    status: z.number().int(),
  })).default([]),
}).passthrough();

export function createGuestBffEnvelopeSchema(dataSchema = z.any()) {
  return z.object({
    ok: z.boolean(),
    data: dataSchema.nullable(),
    error: guestBffErrorSchema,
    meta: guestBffMetaSchema,
  });
}

export function parseGuestBffInput(schema, input, label = "request") {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  return {
    ok: false,
    error: {
      code: "BAD_REQUEST",
      details: parsed.error.flatten(),
      message: `Invalid ${label}.`,
      status: 400,
    },
  };
}

export const selectedTicketSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
}).strict();

export const reservationItemSchema = z.object({
  quantity: z.coerce.number().int().positive(),
  tierId: z.string().min(1),
}).strict();

export const homeOverviewQuerySchema = z.object({
  city: z.string().optional(),
}).strict();

export const exploreFeedQuerySchema = z.object({
  city: z.string().optional(),
  curatedCategory: z.string().optional(),
  datePreset: z.string().optional(),
  endDate: z.string().optional(),
  eventType: z.string().optional(),
  includeFeatured: guestBffBooleanQuerySchema,
  lastId: z.string().optional(),
  limit: guestBffIntegerQuerySchema.min(1).max(100).optional(),
  priceType: z.string().optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
  startDate: z.string().optional(),
}).strict();

export const notificationsSummaryQuerySchema = z.object({
  countOnly: guestBffBooleanQuerySchema,
  limit: guestBffIntegerQuerySchema.min(1).max(100).optional(),
  unreadOnly: guestBffBooleanQuerySchema,
}).strict();

export const checkoutSummaryQuerySchema = z.object({
  eventId: z.string().min(1),
  promoCode: z.string().optional(),
  ref: z.string().optional(),
}).catchall(z.string());

export const checkoutSummaryBodySchema = z.object({
  appliedPromoCode: z.string().nullable().optional(),
  cartReservation: z.any().nullable().optional(),
  eventId: z.string().nullable().optional(),
  promoterCode: z.string().nullable().optional(),
  quoteInput: z.any().nullable().optional(),
  selectedTickets: z.array(selectedTicketSchema).optional(),
}).strict();

export const checkoutQuoteBodySchema = z.object({
  eventId: z.string().optional(),
  items: z.array(reservationItemSchema).optional(),
  promoCode: z.string().nullable().optional(),
  promoterCode: z.string().nullable().optional(),
  reservationId: z.string().nullable().optional(),
}).strict();

export const checkoutReserveBodySchema = z.object({
  admissionToken: z.string().max(256).optional(),
  deviceId: z.string().optional(),
  eventId: z.string().min(1),
  items: z.array(reservationItemSchema).min(1),
}).strict();

export const checkoutInitiateBodySchema = z.object({
  promoCode: z.string().nullable().optional(),
  promoterCode: z.string().nullable().optional(),
  reservationId: z.string().min(1),
  userEmail: z.string().email(),
  userName: z.string().min(1),
  userPhone: z.string().nullable().optional(),
}).strict();

export const checkoutVerifyBodySchema = z.object({
  orderId: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
}).strict();

export const checkoutRecoverQuerySchema = z.object({
  orderId: z.string().min(1),
}).strict();

export const eventDetailParamsSchema = z.object({
  eventId: z.string().min(1),
}).strict();

export const profileDetailParamsSchema = z.object({
  userId: z.string().min(1),
}).strict();

export const confirmationParamsSchema = z.object({
  orderId: z.string().min(1),
}).strict();

export const guestBffLooseObjectSchema = z.object({}).passthrough();

const guestBffEventsBucketSchema = z.object({
  attended: z.array(z.any()),
  upcoming: z.array(z.any()),
}).passthrough();

export const homeOverviewDataSchema = z.object({
  city: z.string(),
  content: guestBffLooseObjectSchema,
  errors: z.array(z.string()),
  events: z.array(z.any()),
  featuredEvents: z.array(z.any()),
  interviews: z.array(z.any()),
  selects: z.array(z.any()),
}).passthrough();

export const exploreFeedDataSchema = z.object({
  errors: z.array(z.string()),
  events: z.array(z.any()),
  featuredEvents: z.array(z.any()),
  hasMore: z.boolean(),
  meta: z.object({
    city: z.string(),
    includeFeatured: z.boolean(),
    lastId: z.string().nullable(),
    sort: z.string(),
  }).passthrough(),
  nextCursor: z.any().nullable(),
}).passthrough();

export const notificationsSummaryDataSchema = z.object({
  items: z.array(z.any()),
  pagination: z.object({
    count: z.number().int().nonnegative(),
    countOnly: z.boolean(),
    limit: z.number().int().nonnegative(),
    unreadOnly: z.boolean(),
  }).passthrough(),
  unreadCount: z.number().int().nonnegative(),
  viewer: z.any().nullable(),
}).passthrough();

export const ticketsOverviewDataSchema = z.object({
  actions: z.object({
    canCancel: z.boolean(),
    canReissue: z.boolean(),
    canShare: z.boolean(),
    canTransfer: z.boolean(),
  }).passthrough(),
  profile: z.any().nullable(),
  unreadCount: z.number().int().nonnegative(),
  viewer: z.any().nullable(),
  wallet: guestBffLooseObjectSchema,
}).passthrough();

export const eventDetailDataSchema = z.object({
  commerce: z.any().nullable(),
  event: z.any().nullable(),
  host: z.any().nullable(),
  interestedData: guestBffLooseObjectSchema,
  queue: z.any().nullable(),
  viewer: guestBffLooseObjectSchema,
}).passthrough();

export const checkoutSummaryDataSchema = z.object({
  constraints: z.any().nullable(),
  event: z.any().nullable(),
  meta: guestBffLooseObjectSchema.optional(),
  payment: z.any().nullable(),
  pricing: z.any().nullable(),
  quote: z.any().nullable(),
  reservation: z.any().nullable(),
  success: z.boolean(),
  viewer: z.any().nullable(),
  viewerProfile: z.any().nullable(),
}).passthrough();

export const checkoutQuoteDataSchema = z.object({
  constraints: z.any().nullable(),
  pricing: z.any().nullable(),
  quote: z.any().nullable(),
  reservation: z.any().nullable(),
  success: z.boolean(),
}).passthrough();

export const checkoutRecoverDataSchema = z.object({
  event: z.any().nullable(),
  order: z.any().nullable(),
}).passthrough();

export const profileOverviewDataSchema = z.object({
  badges: z.array(z.string()),
  events: guestBffEventsBucketSchema,
  profile: z.any().nullable(),
  unreadCount: z.number().int().nonnegative(),
  viewer: z.any().nullable(),
}).passthrough();

export const profileDetailDataSchema = z.object({
  badges: z.array(z.string()),
  events: guestBffEventsBucketSchema,
  isOwner: z.boolean(),
  profile: z.any().nullable(),
  unreadCount: z.number().int().nonnegative(),
  viewer: z.any().nullable(),
}).passthrough();

export const profileUpdateDataSchema = guestBffLooseObjectSchema;

export const confirmationDataSchema = z.object({
  event: z.any().nullable(),
  order: z.any().nullable(),
  status: z.enum(["missing", "pending", "ready"]),
}).passthrough();

export const profileUpdateBodySchema = z.object({
  age: z.number().min(1).max(150).optional(),
  avatar: z.string().nullable().optional(),
  attendedEvents: z.array(z.string().min(1)).optional(),
  bio: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  displayName: z.string().max(100).optional(),
  gender: z.string().max(20).optional(),
  handle: z.string().max(30).optional(),
  instagram: z.string().max(100).optional(),
  onboardingComplete: z.boolean().optional(),
  phone: z.string().max(20).optional(),
  phoneNumber: z.string().max(20).optional(),
  photoURL: z.string().nullable().optional(),
  savedEvents: z.array(z.string().min(1)).optional(),
  username: z.string().max(30).optional(),
}).strict().refine((value) => Object.keys(value || {}).length > 0, {
  message: "At least one profile field is required.",
});
