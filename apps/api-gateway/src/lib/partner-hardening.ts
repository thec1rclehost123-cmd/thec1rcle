import { PROMOTER_COMMISSION_TIERS } from './rbac-permissions.js';

type BankAccountOwnerType = 'host' | 'venue' | 'promoter';

const EVENT_RESUBMISSION_PATCH_FIELDS = new Set([
  'title',
  'name',
  'description',
  'shortDescription',
  'category',
  'subcategory',
  'tags',
  'genre',
  'startDate',
  'endDate',
  'doorsOpenAt',
  'coverImage',
  'coverPhoto',
  'poster',
  'image',
  'images',
  'bannerUrl',
  'heroImage',
  'capacity',
  'ageRestriction',
  'dressCode',
  'ticketTiers',
  'ticketTypes',
  'lineup',
  'artists',
  'performers',
  'schedule',
  'faq',
  'policies',
  'terms',
  'isPrivate',
  'visibility',
  'tableInventory',
  'tablePackages',
  'sections',
  'menu',
  'pricing',
  'notes',
  'hostNote',
  'submittedNote',
  'customFields',
  'socialLinks',
  'externalLinks',
  'contactEmail',
  'contactPhone',
  'timezone',
  'slug',
]);

function makeBadRequest(message: string) {
  const err: any = new Error(message);
  err.statusCode = 400;
  err.code = 'BAD_REQUEST';
  return err;
}

export function sanitizeEventResubmissionPatch(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const patch = value as Record<string, any>;
  const sanitized: Record<string, any> = {};

  for (const key of EVENT_RESUBMISSION_PATCH_FIELDS) {
    if (patch[key] !== undefined) sanitized[key] = patch[key];
  }

  return sanitized;
}

export function normalizePromoterCommissionRate(value: unknown): number {
  const tiers = PROMOTER_COMMISSION_TIERS.map((tier) => Number(tier.rate)).filter((rate) => Number.isFinite(rate)).sort((a, b) => a - b);
  const baseRate = tiers[0] ?? 0;
  const maxRate = tiers[tiers.length - 1] ?? baseRate;
  const requested = Number(value);

  if (!Number.isFinite(requested) || requested <= 0) return baseRate;
  if (requested >= maxRate) return maxRate;

  let normalized = baseRate;
  for (const rate of tiers) {
    if (requested >= rate) normalized = rate;
  }

  return normalized;
}

const STRIP_TAGS = /<[^>]*>/g;

function sanitize(val: string): string {
  return String(val || '').replace(STRIP_TAGS, '').trim().slice(0, 200);
}

export function buildPayoutAccountRecord(
  body: Record<string, any>,
  owner: { partnerId: string; ownerType: BankAccountOwnerType }
) {
  const paymentType = body.paymentType === 'debit_card' ? 'debit_card' : 'bank_account';
  const rawNumber = paymentType === 'debit_card'
    ? String(body.cardNumber || '').replace(/[^\d]/g, '').trim()
    : String(body.accountNumber || '').replace(/[^\d]/g, '').trim();

  if (!rawNumber) throw makeBadRequest('Account number or card number required');
  if (rawNumber.length < 9) throw makeBadRequest('Account number must be at least 9 digits');

  const last4 = rawNumber.slice(-4);
  const bankName = sanitize(body.bankName || body.cardBrand || 'Bank Account');
  const accountHolderName = sanitize(body.accountHolderName || body.cardHolderName || '');
  const ifscCode = String(body.ifscCode || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 11);
  const isDefault = body.isDefault !== false;
  const now = new Date().toISOString();

  return {
    paymentType,
    last4,
    bankName,
    isDefault,
    record: {
      partnerId: owner.partnerId,
      ownerId: owner.partnerId,
      ownerType: owner.ownerType,
      paymentType,
      accountHolderName,
      bankName,
      ifscCode: ifscCode || null,
      cardBrand: paymentType === 'debit_card' ? (body.cardBrand || null) : null,
      cardLast4: paymentType === 'debit_card' ? last4 : null,
      last4,
      isDefault,
      verified: false,
      createdAt: now,
      updatedAt: now,
    },
    response(accountId: string) {
      return {
        account: {
          id: accountId,
          bankName,
          last4,
          isDefault,
          paymentType,
        },
      };
    },
  };
}
