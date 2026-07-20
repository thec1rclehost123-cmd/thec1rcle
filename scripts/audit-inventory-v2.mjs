/**
 * Inventory V2 report-only audit.
 *
 * This script reads events and their ticket_shards, then produces a stable
 * machine-readable report. It deliberately exposes no apply/backfill mode and
 * never writes to Firestore, Redis, or a payment provider.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { getAdminDb, isFirebaseConfigured } from '@c1rcle/core/admin';
import {
  InventoryIntegrityError,
  auditFiniteInventory,
  readFiniteTierInventory,
  sumActiveHoldbacks,
} from '@c1rcle/core/inventory-integrity';

const SCHEMA_VERSION = 'inventory-v2-audit/2';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOLD_AUTHORITIES = new Set(['parent', 'shards']);
const PUBLIC_TICKET_EVENT_LIFECYCLES = new Set(['scheduled', 'live']);
const HIDDEN_TICKET_STATUSES = new Set([
  'hidden',
  'disabled',
  'inactive',
  'deleted',
  'archived',
]);

for (const envPath of [
  resolve(REPO_ROOT, '.env'),
  resolve(REPO_ROOT, 'apps/api-gateway/.env.local'),
  resolve(REPO_ROOT, 'apps/api-gateway/.env.development'),
  resolve(REPO_ROOT, 'apps/api-gateway/.env.production'),
]) {
  if (existsSync(envPath)) loadEnv({ path: envPath, override: false, quiet: true });
}

function plainValue(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plainValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, plainValue(item)]),
    );
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(plainValue(value));
}

function checksum(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function asDocument(record, kind) {
  if (!record || typeof record !== 'object') {
    throw new Error(`${kind} record must be an object`);
  }
  const id = String(record.id || '').trim();
  if (!id) throw new Error(`${kind} record id is required`);
  const data = typeof record.data === 'function' ? record.data() : record.data;
  if (!data || typeof data !== 'object') {
    throw new Error(`${kind} ${id} data must be an object`);
  }
  return { id, data: plainValue(data) };
}

function valueEntries(candidates) {
  return Object.entries(candidates)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([field, value]) => ({ field, value }));
}

function mirrorInspection(candidates) {
  const values = valueEntries(candidates);
  const normalized = values.map(({ value }) => Number(value));
  const invalid = normalized.some((value) => !Number.isSafeInteger(value) || value < 0);
  return {
    values,
    consistent: !invalid && new Set(normalized).size <= 1,
    invalid,
  };
}

function isUnlimitedTier(tier) {
  return String(tier?.inventory?.type || tier?.type || '').toLowerCase() === 'unlimited';
}

function tierIdOf(tier) {
  return String(tier?.id || tier?.tierId || '').trim();
}

function finding(code, severity, details = {}) {
  return { code, severity, ...plainValue(details) };
}

function normalizedText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function parseDateField(value, field) {
  if (value === undefined || value === null || value === '') return { field, present: false };
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return { field, present: true, valid: false, value };
  return { field, present: true, valid: true, value, timestamp, iso: new Date(timestamp).toISOString() };
}

function eventSaleContext(event, now) {
  const lifecycle = normalizedText(event.lifecycle);
  const status = normalizedText(event.status);
  const directVisibility = normalizedText(event.visibility);
  const settingsVisibility = normalizedText(event.settings?.visibility);
  const resolvedLifecycle = lifecycle || status;
  const resolvedVisibility = directVisibility || settingsVisibility || 'public';
  const privateValue = event.isPrivate;
  const deletedValue = event.isDeleted;
  const fields = {
    lifecycle: event.lifecycle ?? null,
    status: event.status ?? null,
    visibility: event.visibility ?? null,
    settingsVisibility: event.settings?.visibility ?? null,
    isPrivate: privateValue ?? null,
    isDeleted: deletedValue ?? null,
    publishedAt: event.publishedAt ?? null,
    startDate: event.startDate ?? null,
    startAt: event.startAt ?? null,
    date: event.date ?? null,
    endDate: event.endDate ?? null,
    endAt: event.endAt ?? null,
  };
  const policyFindings = [];
  if (
    (privateValue !== undefined && privateValue !== null && typeof privateValue !== 'boolean') ||
    (deletedValue !== undefined && deletedValue !== null && typeof deletedValue !== 'boolean')
  ) {
    policyFindings.push(
      finding('INVALID_EVENT_PRIVACY_OR_DELETION_FLAG', 'error', {
        isPrivate: privateValue ?? null,
        isDeleted: deletedValue ?? null,
      }),
    );
  }
  if (privateValue || deletedValue) {
    return {
      classification: 'non_saleable',
      reason: privateValue ? 'event_private' : 'event_deleted',
      resolvedLifecycle: resolvedLifecycle || null,
      resolvedVisibility,
      fields,
      policyFindings,
    };
  }
  if (directVisibility && settingsVisibility && directVisibility !== settingsVisibility) {
    policyFindings.push(
      finding('CONFLICTING_EVENT_VISIBILITY_FIELDS', 'error', {
        runtimeSelected: directVisibility,
        ignored: settingsVisibility,
      }),
    );
  }
  if (resolvedVisibility !== 'public') {
    return {
      classification: 'non_saleable',
      reason: 'event_not_public',
      resolvedLifecycle: resolvedLifecycle || null,
      resolvedVisibility,
      fields,
      policyFindings,
    };
  }
  if (lifecycle && status && lifecycle !== status) {
    policyFindings.push(
      finding('CONFLICTING_EVENT_LIFECYCLE_FIELDS', 'error', {
        runtimeSelected: lifecycle,
        ignored: status,
      }),
    );
  }

  if (resolvedLifecycle) {
    if (!PUBLIC_TICKET_EVENT_LIFECYCLES.has(resolvedLifecycle)) {
      return {
        classification: 'non_saleable',
        reason: 'event_lifecycle_not_public',
        resolvedLifecycle,
        resolvedVisibility,
        fields,
        policyFindings,
      };
    }
  } else {
    return {
      classification: 'non_saleable',
      reason: 'event_lifecycle_missing',
      resolvedLifecycle: null,
      resolvedVisibility,
      fields,
      policyFindings,
    };
  }

  const cutoffCandidates = [
    ['endDate', event.endDate],
    ['endAt', event.endAt],
    ['startDate', event.startDate],
    ['startAt', event.startAt],
    ['date', event.date],
  ];
  const selectedCutoff = cutoffCandidates.find(([, value]) => value !== undefined && value !== null && value !== '');
  if (selectedCutoff) {
    const parsed = parseDateField(selectedCutoff[1], selectedCutoff[0]);
    if (!parsed.valid) {
      return {
        classification: 'non_saleable',
        reason: 'event_cutoff_invalid',
        resolvedLifecycle: resolvedLifecycle || null,
        resolvedVisibility,
        cutoff: parsed,
        fields,
        policyFindings,
      };
    }
    if (parsed.valid && parsed.timestamp <= now.getTime()) {
      return {
        classification: 'non_saleable',
        reason: 'event_elapsed',
        resolvedLifecycle: resolvedLifecycle || null,
        resolvedVisibility,
        cutoff: parsed,
        fields,
        policyFindings,
      };
    }
    return {
      classification: 'saleable',
      reason: 'event_exposed_by_public_inventory',
      resolvedLifecycle: resolvedLifecycle || null,
      resolvedVisibility,
      cutoff: parsed,
      fields,
      policyFindings,
    };
  }

  return {
    classification: 'saleable',
    reason: 'event_exposed_by_public_inventory',
    resolvedLifecycle: resolvedLifecycle || null,
    resolvedVisibility,
    cutoff: null,
    fields,
    policyFindings,
  };
}

function runtimeBaseRemaining(tier, now) {
  if (normalizedText(tier.inventory?.type || tier.type) === 'unlimited') {
    return { classification: 'available', remaining: null, isUnlimited: true };
  }
  const inventory = tier.inventory || {};
  const totalRaw =
    inventory.totalQuantity ?? tier.totalQuantity ?? tier.quantity ?? tier.capacity ?? 0;
  const soldRaw =
    inventory.soldQuantity ?? tier.soldQuantity ?? tier.sold ?? tier.soldCount ?? 0;
  const total = Number(totalRaw);
  const sold = Number(soldRaw);
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(sold) || sold < 0) {
    return {
      classification: 'ambiguous',
      reason: 'invalid_public_inventory_capacity_or_sold',
      totalRaw,
      soldRaw,
    };
  }

  let holdbacks = 0;
  if (inventory.holdbacks !== undefined) {
    if (!Array.isArray(inventory.holdbacks)) {
      return { classification: 'ambiguous', reason: 'invalid_public_inventory_holdbacks' };
    }
    for (const [index, holdback] of inventory.holdbacks.entries()) {
      if (!holdback || typeof holdback !== 'object') {
        return {
          classification: 'ambiguous',
          reason: 'invalid_public_inventory_holdback',
          holdbackIndex: index,
        };
      }
      if (holdback.expiresAt) {
        const expiry = parseDateField(holdback.expiresAt, `inventory.holdbacks[${index}].expiresAt`);
        if (!expiry.valid) {
          return {
            classification: 'ambiguous',
            reason: 'invalid_public_inventory_holdback_expiry',
            holdbackIndex: index,
          };
        }
        if (expiry.timestamp < now.getTime()) continue;
      }
      const quantity = Number(holdback.quantity || 0);
      if (!Number.isSafeInteger(quantity) || quantity < 0) {
        return {
          classification: 'ambiguous',
          reason: 'invalid_public_inventory_holdback_quantity',
          holdbackIndex: index,
        };
      }
      holdbacks += quantity;
    }
  }

  const hasLegacyRemaining = tier.remaining !== undefined;
  const legacyRemaining = hasLegacyRemaining ? Number(tier.remaining) : null;
  if (
    hasLegacyRemaining &&
    (!Number.isSafeInteger(legacyRemaining) || legacyRemaining < 0)
  ) {
    return {
      classification: 'ambiguous',
      reason: 'invalid_public_inventory_legacy_remaining',
      remainingRaw: tier.remaining,
    };
  }
  const remaining =
    legacyRemaining !== null &&
    inventory.soldQuantity === undefined &&
    tier.sold === undefined
      ? legacyRemaining
      : Math.max(0, total - sold - holdbacks);
  return {
    classification: remaining > 0 ? 'available' : 'sold_out',
    remaining,
    isUnlimited: false,
    total,
    sold,
    activeInventoryHoldbacks: holdbacks,
    basis:
      legacyRemaining !== null &&
      inventory.soldQuantity === undefined &&
      tier.sold === undefined
        ? 'tier.remaining'
        : 'capacity_minus_sold_minus_inventory_holdbacks',
  };
}

function tierVisibilityContext(tier) {
  const status = normalizedText(tier.status);
  const lifecycle = normalizedText(tier.lifecycle);
  const directFlags = {
    isHidden: tier.isHidden,
    hidden: tier.hidden,
    isDeleted: tier.isDeleted,
  };
  if (Object.values(directFlags).some((value) => value === true)) {
    return { classification: 'non_saleable', reason: 'tier_hidden_or_deleted', status, lifecycle };
  }
  if (
    Object.values(directFlags).some(
      (value) => value !== undefined && value !== null && typeof value !== 'boolean',
    )
  ) {
    return { classification: 'ambiguous', reason: 'invalid_tier_visibility_flag', status, lifecycle };
  }
  if (status && lifecycle && status !== lifecycle) {
    return { classification: 'ambiguous', reason: 'conflicting_tier_status_fields', status, lifecycle };
  }
  if (HIDDEN_TICKET_STATUSES.has(status || lifecycle)) {
    return { classification: 'non_saleable', reason: 'tier_status_hidden', status, lifecycle };
  }

  const visibility = tier.visibility;
  const visibilityRestricted =
    (typeof visibility === 'string' && normalizedText(visibility) !== 'public') ||
    (visibility &&
      typeof visibility === 'object' &&
      (visibility.isHidden === true ||
        visibility.requiresCode === true ||
        visibility.inviteOnly === true ||
        visibility.internalOnly === true));
  if (visibilityRestricted) {
    return {
      classification: 'ambiguous',
      reason: 'tier_visibility_contract_not_enforced_by_public_inventory',
      status,
      lifecycle,
    };
  }
  return { classification: 'saleable', reason: 'tier_visible', status, lifecycle };
}

function tierSaleWindowContext(tier, now) {
  const starts = [
    parseDateField(tier.salesStart, 'salesStart'),
    parseDateField(tier.saleWindow?.startsAt, 'saleWindow.startsAt'),
  ].filter(({ present }) => present);
  const ends = [
    parseDateField(tier.salesEnd, 'salesEnd'),
    parseDateField(tier.saleWindow?.endsAt, 'saleWindow.endsAt'),
  ].filter(({ present }) => present);
  const startAliases = [
    parseDateField(tier.startSale, 'startSale'),
    parseDateField(tier.saleStartDate, 'saleStartDate'),
  ].filter(({ present }) => present);
  const endAliases = [
    parseDateField(tier.endSale, 'endSale'),
    parseDateField(tier.saleEndDate, 'saleEndDate'),
  ].filter(({ present }) => present);
  if ([...starts, ...ends, ...startAliases, ...endAliases].some(({ valid }) => !valid)) {
    return {
      classification: 'ambiguous',
      reason: 'invalid_tier_sale_window',
      starts,
      ends,
      startAliases,
      endAliases,
    };
  }
  if (
    new Set(starts.map(({ timestamp }) => timestamp)).size > 1 ||
    new Set(ends.map(({ timestamp }) => timestamp)).size > 1
  ) {
    return {
      classification: 'ambiguous',
      reason: 'conflicting_tier_sale_window_fields',
      starts,
      ends,
      startAliases,
      endAliases,
    };
  }
  const start = starts[0] || null;
  const end = ends[0] || null;
  if (
    startAliases.some(({ timestamp }) => !start || timestamp !== start.timestamp) ||
    endAliases.some(({ timestamp }) => !end || timestamp !== end.timestamp)
  ) {
    return {
      classification: 'ambiguous',
      reason: 'sale_window_alias_not_enforced_by_public_inventory',
      start,
      end,
      startAliases,
      endAliases,
    };
  }
  if (start && end && start.timestamp > end.timestamp) {
    return { classification: 'ambiguous', reason: 'tier_sale_window_inverted', start, end };
  }
  if (start && now.getTime() < start.timestamp) {
    return { classification: 'non_saleable', reason: 'tier_sale_not_started', start, end };
  }
  if (end && now.getTime() > end.timestamp) {
    return { classification: 'non_saleable', reason: 'tier_sale_ended', start, end };
  }
  return { classification: 'saleable', reason: 'tier_sale_window_active', start, end };
}

function eventTierCandidates(event) {
  const catalog = Array.isArray(event.ticketCatalog?.tiers)
    ? event.ticketCatalog.tiers.map((tier) => ({ tier, source: 'ticketCatalog.tiers' }))
    : [];
  const legacy = Array.isArray(event.tickets)
    ? event.tickets.map((tier) => ({ tier, source: 'tickets' }))
    : [];
  const candidates = [...catalog, ...legacy];
  const runtimeSource = catalog.length > 0 ? 'ticketCatalog.tiers' : 'tickets';
  const byId = new Map();
  const invalid = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const tierId = tierIdOf(candidate.tier);
    if (!tierId) {
      invalid.push({
        key: `__missing_${candidate.source}_${index}`,
        tier: candidate.tier,
        sourcePaths: [candidate.source],
        sourceAmbiguous: true,
        sourceReason: 'missing_tier_id',
        runtimeSelected: candidate.source === runtimeSource,
        runtimeSource,
      });
      continue;
    }
    const entries = byId.get(tierId) || [];
    entries.push(candidate);
    byId.set(tierId, entries);
  }

  const merged = [];
  for (const [tierId, entries] of [...byId.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const uniquePayloads = new Set(entries.map(({ tier }) => stableStringify(tier)));
    const sources = [...new Set(entries.map(({ source }) => source))].sort();
    const duplicateWithinSource = sources.some(
      (source) => entries.filter((entry) => entry.source === source).length > 1,
    );
    const sourceAmbiguous =
      duplicateWithinSource || (entries.length > 1 && uniquePayloads.size > 1);
    merged.push({
      key: tierId,
      tier: entries[0].tier,
      sourcePaths: sources,
      sourceAmbiguous,
      sourceReason: sourceAmbiguous
        ? duplicateWithinSource
          ? 'duplicate_tier_id_within_source'
          : 'conflicting_duplicate_tier_id'
        : null,
      runtimeSelected: entries.some(({ source }) => source === runtimeSource),
      runtimeSource,
    });
  }
  return [...merged, ...invalid].sort((left, right) => left.key.localeCompare(right.key));
}

export function classifyTierSaleability({ event, tier, candidate, shards, now }) {
  const timestamp = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(timestamp.getTime())) throw new Error('now must be a valid date');
  const persisted = {
    event: eventSaleContext(event, timestamp),
    tier: {
      status: tier.status ?? null,
      lifecycle: tier.lifecycle ?? null,
      visibility: tier.visibility ?? null,
      isHidden: tier.isHidden ?? null,
      hidden: tier.hidden ?? null,
      isDeleted: tier.isDeleted ?? null,
      salesStart: tier.salesStart ?? null,
      salesEnd: tier.salesEnd ?? null,
      saleWindow: tier.saleWindow ?? null,
      startSale: tier.startSale ?? null,
      saleStartDate: tier.saleStartDate ?? null,
      endSale: tier.endSale ?? null,
      saleEndDate: tier.saleEndDate ?? null,
    },
  };

  if (candidate.sourceAmbiguous) {
    return {
      classification: 'ambiguous',
      reason: 'ambiguous_tier_source',
      runtimeSource: candidate.runtimeSource,
      persisted,
    };
  }
  if (!candidate.runtimeSelected) {
    return {
      classification: 'non_saleable',
      reason: 'tier_source_not_selected_by_public_inventory',
      runtimeSource: candidate.runtimeSource,
      persisted,
    };
  }
  if (persisted.event.classification !== 'saleable') {
    return {
      classification: persisted.event.classification,
      reason: persisted.event.reason,
      runtimeSource: candidate.runtimeSource,
      persisted,
    };
  }
  const visibility = tierVisibilityContext(tier);
  persisted.tier.visibilityContext = visibility;
  if (visibility.classification !== 'saleable') {
    return {
      classification: visibility.classification,
      reason: visibility.reason,
      runtimeSource: candidate.runtimeSource,
      persisted,
    };
  }

  const saleWindow = tierSaleWindowContext(tier, timestamp);
  persisted.tier.saleWindowContext = saleWindow;
  if (saleWindow.classification !== 'saleable') {
    return {
      classification: saleWindow.classification,
      reason: saleWindow.reason,
      runtimeSource: candidate.runtimeSource,
      persisted,
    };
  }

  const inventory = runtimeBaseRemaining(tier, timestamp);
  persisted.tier.publicInventoryBeforeRedis = inventory;
  if (inventory.classification === 'ambiguous') {
    return {
      classification: 'ambiguous',
      reason: inventory.reason,
      runtimeSource: candidate.runtimeSource,
      persisted,
    };
  }
  if (shards.findings.length > 0) {
    return {
      classification: 'ambiguous',
      reason: 'invalid_or_unsupported_shard_state',
      runtimeSource: candidate.runtimeSource,
      persisted,
    };
  }

  let publicRemaining = inventory.remaining;
  let inventoryBasis = inventory.basis || 'unlimited';
  if (!inventory.isUnlimited && shards.soldSum > 0) {
    publicRemaining = Math.max(
      0,
      inventory.total - inventory.sold - shards.soldSum - inventory.activeInventoryHoldbacks,
    );
    inventoryBasis = 'public_engine_parent_sold_plus_shard_sold';
  }
  if (!inventory.isUnlimited && publicRemaining <= 0) {
    return {
      classification: 'non_saleable',
      reason: 'tier_sold_out_before_redis_reservations',
      runtimeSource: candidate.runtimeSource,
      publicRemainingBeforeRedis: publicRemaining,
      inventoryBasis,
      persisted,
    };
  }
  return {
    classification: 'saleable',
    reason: 'public_inventory_available_before_redis_reservations',
    runtimeSource: candidate.runtimeSource,
    publicRemainingBeforeRedis: publicRemaining,
    inventoryBasis,
    redisReservationsRead: false,
    persisted,
  };
}

function explicitAuthorityMarkers(tier) {
  return valueEntries({
    'tier.soldAuthority': tier?.soldAuthority,
    'inventory.soldAuthority': tier?.inventory?.soldAuthority,
  }).map(({ field, value }) => ({
    field,
    value: String(typeof value === 'string' ? value : value?.kind || '')
      .trim()
      .toLowerCase(),
  }));
}

function holdbackInspection(tier, now) {
  const sources = valueEntries({
    'inventory.holdbacks': tier?.inventory?.holdbacks,
    'tier.holdbacks': tier?.holdbacks,
  });
  const sourcePayloads = new Set(sources.map(({ value }) => stableStringify(value)));
  const activeBySource = [];
  for (const { field, value } of sources) {
    activeBySource.push({ field, activeQuantity: sumActiveHoldbacks(value, now) });
  }
  return {
    sources: sources.map(({ field, value }) => ({
      field,
      count: Array.isArray(value) ? value.length : null,
    })),
    activeBySource,
    consistent: sourcePayloads.size <= 1,
  };
}

export function classifySoldAuthority(tier, shards) {
  const markers = explicitAuthorityMarkers(tier);
  const invalidMarkers = markers.filter(({ value }) => !SOLD_AUTHORITIES.has(value));
  const kinds = [...new Set(markers.map(({ value }) => value))];
  const shardCount = shards.length;

  if (invalidMarkers.length > 0 || kinds.length > 1) {
    return {
      kind: 'ambiguous',
      basis: invalidMarkers.length ? 'invalid_explicit_marker' : 'conflicting_explicit_markers',
      explicit: markers.length > 0,
      markers,
    };
  }

  if (kinds.length === 1) {
    const kind = kinds[0];
    if (kind === 'parent' && shardCount > 0) {
      return {
        kind: 'ambiguous',
        basis: 'explicit_parent_conflicts_with_shards',
        explicit: true,
        markers,
      };
    }
    if (kind === 'shards' && shardCount === 0) {
      return {
        kind: 'ambiguous',
        basis: 'explicit_shards_without_shard_documents',
        explicit: true,
        markers,
      };
    }
    return { kind, basis: 'explicit_marker', explicit: true, markers };
  }

  return shardCount > 0
    ? { kind: 'shards', basis: 'shard_documents_present', explicit: false, markers: [] }
    : { kind: 'parent', basis: 'no_shard_documents', explicit: false, markers: [] };
}

function shardInspection(shards, tierId) {
  const seen = new Set();
  const normalized = [];
  const findings = [];

  for (const shard of [...shards].sort((left, right) => left.id.localeCompare(right.id))) {
    if (seen.has(shard.id)) {
      findings.push(finding('DUPLICATE_SHARD_ID', 'error', { shardId: shard.id }));
      continue;
    }
    seen.add(shard.id);
    const shardTierId = String(shard.data?.tierId || '').trim();
    if (shardTierId !== tierId) {
      findings.push(
        finding('SHARD_TIER_ID_MISMATCH', 'error', {
          shardId: shard.id,
          expectedTierId: tierId,
          actualTierId: shardTierId || null,
        }),
      );
    }
    const soldQuantity = Number(shard.data?.soldQuantity ?? 0);
    if (!Number.isSafeInteger(soldQuantity) || soldQuantity < 0) {
      findings.push(
        finding('INVALID_SHARD_SOLD_QUANTITY', 'error', {
          shardId: shard.id,
          value: shard.data?.soldQuantity ?? null,
        }),
      );
    }
    const allocationAliases = [];
    for (const field of [
      'lockedQuantity',
      'allocatedQuantity',
      'heldQuantity',
      'reservedQuantity',
    ]) {
      const value = Number(shard.data?.[field] || 0);
      allocationAliases.push({ field, value });
      if (!Number.isSafeInteger(value) || value < 0) {
        findings.push(
          finding('INVALID_SHARD_ALLOCATION_QUANTITY', 'error', {
            shardId: shard.id,
            field,
            value: shard.data?.[field] ?? null,
          }),
        );
      } else if (value !== 0) {
        findings.push(
          finding('SHARD_LOCAL_ALLOCATION_PRESENT', 'error', {
            shardId: shard.id,
            field,
            value,
          }),
        );
      }
    }
    normalized.push({
      id: shard.id,
      tierId: shardTierId || null,
      soldQuantity: Number.isSafeInteger(soldQuantity) && soldQuantity >= 0 ? soldQuantity : null,
      allocationAliases,
    });
  }

  const soldValuesValid = normalized.every(({ soldQuantity }) => soldQuantity !== null);
  const identityValid = !findings.some(({ code }) =>
    ['DUPLICATE_SHARD_ID', 'SHARD_TIER_ID_MISMATCH'].includes(code),
  );
  const nonzeroAllocationAliases = normalized.flatMap((shard) =>
    shard.allocationAliases
      .filter(({ value }) => Number.isSafeInteger(value) && value > 0)
      .map(({ field, value }) => ({ shardId: shard.id, field, value })),
  );
  return {
    documents: normalized,
    soldSum:
      soldValuesValid && identityValid
        ? normalized.reduce((total, shard) => total + shard.soldQuantity, 0)
        : null,
    nonzeroAllocationAliases,
    findings,
  };
}

function inspectTier({ eventId, event, candidate, shards, now }) {
  const tierId = tierIdOf(candidate.tier) || null;
  const base = {
    eventId,
    tierId,
    sourcePaths: candidate.sourcePaths,
    finite: !isUnlimitedTier(candidate.tier),
  };
  const findings = [];

  if (candidate.sourceAmbiguous) {
    findings.push(finding('AMBIGUOUS_TIER_SOURCE', 'error', { reason: candidate.sourceReason }));
  }
  if (!tierId) findings.push(finding('MISSING_TIER_ID', 'error'));

  const shardState = shardInspection(shards, tierId || '');
  findings.push(...shardState.findings);
  const saleability = classifyTierSaleability({
    event,
    tier: candidate.tier,
    candidate,
    shards: shardState,
    now,
  });
  const soldAuthority = classifySoldAuthority(candidate.tier, shards);
  if (soldAuthority.kind === 'ambiguous') {
    findings.push(finding('AMBIGUOUS_SOLD_AUTHORITY', 'error', { reason: soldAuthority.basis }));
  } else if (!soldAuthority.explicit) {
    findings.push(finding('IMPLICIT_SOLD_AUTHORITY', 'warning', { inferred: soldAuthority.kind }));
  }

  if (isUnlimitedTier(candidate.tier)) {
    if (shards.length > 0) findings.push(finding('UNLIMITED_TIER_HAS_SHARDS', 'error'));
    return {
      ...base,
      status: findings.some(({ severity }) => severity === 'error') ? 'error' : 'not_applicable',
      soldAuthority,
      saleability,
      persisted: null,
      canonical: null,
      invariant: null,
      shards: shardState,
      findings,
    };
  }

  const tier = candidate.tier;
  const inventory = tier.inventory || {};
  const mirrors = {
    capacity: mirrorInspection({
      'inventory.totalQuantity': inventory.totalQuantity,
      'tier.totalQuantity': tier.totalQuantity,
      'tier.quantity': tier.quantity,
      'tier.capacity': tier.capacity,
    }),
    remaining: mirrorInspection({
      'inventory.remaining': inventory.remaining,
      'tier.remaining': tier.remaining,
    }),
    allocatedQuantity: mirrorInspection({
      'inventory.allocatedQuantity': inventory.allocatedQuantity,
      'tier.allocatedQuantity': tier.allocatedQuantity,
      'tier.lockedQuantity': tier.lockedQuantity,
    }),
    soldQuantity: mirrorInspection({
      'inventory.soldQuantity': inventory.soldQuantity,
      'tier.soldQuantity': tier.soldQuantity,
      'tier.sold': tier.sold,
      'tier.soldCount': tier.soldCount,
    }),
  };
  let holdbacks = null;
  try {
    holdbacks = holdbackInspection(tier, now);
    if (!holdbacks.consistent) findings.push(finding('HOLDBACK_MIRROR_MISMATCH', 'error'));
  } catch (error) {
    findings.push(
      finding('INVALID_HOLDBACKS', 'error', {
        message: error instanceof InventoryIntegrityError ? error.message : String(error),
      }),
    );
  }
  const mirrorFindingCodes = {
    capacity: 'CAPACITY_MIRROR_MISMATCH',
    remaining: 'REMAINING_MIRROR_MISMATCH',
    allocatedQuantity: 'ALLOCATED_QUANTITY_MIRROR_MISMATCH',
    soldQuantity: 'SOLD_QUANTITY_MIRROR_MISMATCH',
  };
  const invalidMirrorFindingCodes = {
    capacity: 'INVALID_CAPACITY_MIRROR',
    remaining: 'INVALID_REMAINING_MIRROR',
    allocatedQuantity: 'INVALID_ALLOCATED_QUANTITY_MIRROR',
    soldQuantity: 'INVALID_SOLD_QUANTITY_MIRROR',
  };
  for (const [name, mirror] of Object.entries(mirrors)) {
    if (mirror.invalid) {
      findings.push(finding(invalidMirrorFindingCodes[name], 'error'));
    } else if (!mirror.consistent) {
      findings.push(finding(mirrorFindingCodes[name], 'error'));
    }
  }
  let canonical = null;
  let invariant = null;
  if (
    !candidate.sourceAmbiguous &&
    tierId &&
    shardState.findings.length === 0 &&
    soldAuthority.kind !== 'ambiguous'
  ) {
    try {
      const options = { now };
      if (soldAuthority.kind === 'shards') {
        options.shards = shardState.documents.map(({ soldQuantity }) => ({ soldQuantity }));
      }
      canonical = readFiniteTierInventory(tier, options);
      invariant = auditFiniteInventory(canonical);
      if (!invariant.isBalanced) {
        findings.push(
          finding('INVENTORY_INVARIANT_UNBALANCED', 'error', {
            delta: invariant.delta,
            unaccountedQuantity: invariant.unaccountedQuantity,
            overAccountedQuantity: invariant.overAccountedQuantity,
          }),
        );
      }
      if (soldAuthority.kind === 'shards' && canonical.parentSoldQuantity !== shardState.soldSum) {
        findings.push(
          finding('PARENT_SHARD_SOLD_MISMATCH', 'error', {
            parentSoldQuantity: canonical.parentSoldQuantity,
            shardSoldSum: shardState.soldSum,
            difference: canonical.parentSoldQuantity - shardState.soldSum,
          }),
        );
      }
    } catch (error) {
      findings.push(
        finding('INVALID_FINITE_INVENTORY', 'error', {
          message: error instanceof InventoryIntegrityError ? error.message : String(error),
          details: error instanceof InventoryIntegrityError ? error.details : {},
        }),
      );
    }
  }

  const hasError = findings.some(({ severity }) => severity === 'error');
  return {
    ...base,
    status: hasError ? 'error' : 'balanced',
    soldAuthority,
    saleability,
    persisted: { ...mirrors, holdbacks },
    canonical,
    invariant,
    shards: shardState,
    findings,
  };
}

function summarize(events, orphanShards) {
  const tiers = events.flatMap((event) => event.tiers);
  const findings = [
    ...events.flatMap((event) => event.findings),
    ...tiers.flatMap((tier) => tier.findings),
    ...orphanShards.flatMap((shard) => shard.findings),
  ];
  const byCode = {};
  for (const item of findings) byCode[item.code] = (byCode[item.code] || 0) + 1;
  const authority = { parent: 0, shards: 0, ambiguous: 0, explicit: 0, inferred: 0 };
  for (const tier of tiers) {
    authority[tier.soldAuthority.kind] += 1;
    authority[tier.soldAuthority.explicit ? 'explicit' : 'inferred'] += 1;
  }
  const saleableTiers = tiers.filter(
    ({ saleability }) => saleability.classification === 'saleable',
  );
  const saleabilityReasons = {};
  for (const tier of tiers) {
    const reason = tier.saleability.reason;
    saleabilityReasons[reason] = (saleabilityReasons[reason] || 0) + 1;
  }
  const saleableFindings = saleableTiers.flatMap((tier) => tier.findings);
  return {
    events: events.length,
    tiers: tiers.length,
    finiteTiers: tiers.filter((tier) => tier.finite).length,
    balancedFiniteTiers: tiers.filter((tier) => tier.finite && tier.status === 'balanced').length,
    shardDocuments:
      tiers.reduce((total, tier) => total + tier.shards.documents.length, 0) +
      events.reduce((total, event) => total + event.orphanShards.length, 0) +
      orphanShards.length,
    errors: findings.filter(({ severity }) => severity === 'error').length,
    warnings: findings.filter(({ severity }) => severity === 'warning').length,
    unaccountedQuantity: tiers.reduce(
      (total, tier) => total + Number(tier.invariant?.unaccountedQuantity || 0),
      0,
    ),
    overAccountedQuantity: tiers.reduce(
      (total, tier) => total + Number(tier.invariant?.overAccountedQuantity || 0),
      0,
    ),
    soldAuthority: authority,
    saleability: {
      saleableTiers: saleableTiers.length,
      nonSaleableTiers: tiers.filter(
        ({ saleability }) => saleability.classification === 'non_saleable',
      ).length,
      ambiguousTiers: tiers.filter(
        ({ saleability }) => saleability.classification === 'ambiguous',
      ).length,
      failClosed: tiers.some(({ saleability }) => saleability.classification === 'ambiguous'),
      reasons: Object.fromEntries(
        Object.entries(saleabilityReasons).sort(([a], [b]) => a.localeCompare(b)),
      ),
    },
    saleableSubset: {
      tiers: saleableTiers.length,
      finiteTiers: saleableTiers.filter(({ finite }) => finite).length,
      balancedFiniteTiers: saleableTiers.filter(
        ({ finite, status }) => finite && status === 'balanced',
      ).length,
      failingFiniteTiers: saleableTiers.filter(
        ({ finite, status }) => finite && status === 'error',
      ).length,
      errors: saleableFindings.filter(({ severity }) => severity === 'error').length,
      warnings: saleableFindings.filter(({ severity }) => severity === 'warning').length,
      unaccountedQuantity: saleableTiers.reduce(
        (total, tier) => total + Number(tier.invariant?.unaccountedQuantity || 0),
        0,
      ),
      overAccountedQuantity: saleableTiers.reduce(
        (total, tier) => total + Number(tier.invariant?.overAccountedQuantity || 0),
        0,
      ),
    },
    findingsByCode: Object.fromEntries(
      Object.entries(byCode).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
}

export function buildInventoryV2AuditReport({ events, shardsByEvent = {}, now, projectId }) {
  const auditNow = new Date(now || Date.now());
  if (Number.isNaN(auditNow.getTime())) throw new Error('now must be a valid date');
  const project = String(projectId || '').trim();
  if (!project) throw new Error('projectId is required');

  const normalizedEvents = events.map((record) => asDocument(record, 'event'));
  const eventIds = new Set(normalizedEvents.map(({ id }) => id));
  if (eventIds.size !== normalizedEvents.length) throw new Error('event ids must be unique');

  const reportEvents = normalizedEvents
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(({ id: eventId, data: event }) => {
      const eventShards = (shardsByEvent[eventId] || [])
        .map((record) => asDocument(record, 'shard'))
        .sort((left, right) => left.id.localeCompare(right.id));
      const candidates = eventTierCandidates(event);
      const tierIds = new Set(candidates.map(({ key }) => key));
      const grouped = new Map();
      const eventFindings = [];
      const orphanEventShards = [];

      for (const shard of eventShards) {
        const tierId = String(shard.data.tierId || '').trim();
        if (!tierIds.has(tierId)) {
          eventFindings.push(
            finding('ORPHAN_SHARD', 'error', { shardId: shard.id, tierId: tierId || null }),
          );
          orphanEventShards.push({
            shardId: shard.id,
            tierId: tierId || null,
            soldQuantity: shard.data.soldQuantity ?? null,
            lockedQuantity: shard.data.lockedQuantity ?? null,
          });
          continue;
        }
        const group = grouped.get(tierId) || [];
        group.push(shard);
        grouped.set(tierId, group);
      }

      const tiers = candidates.map((candidate) =>
        inspectTier({
          eventId,
          event,
          candidate,
          shards: grouped.get(candidate.key) || [],
          now: auditNow,
        }),
      );
      return {
        eventId,
        saleContext: eventSaleContext(event, auditNow),
        tiers,
        orphanShards: orphanEventShards,
        findings: eventFindings,
      };
    });

  const orphanShards = Object.entries(shardsByEvent)
    .filter(([eventId]) => !eventIds.has(eventId))
    .flatMap(([eventId, records]) =>
      records.map((record) => {
        const shard = asDocument(record, 'shard');
        return {
          eventId,
          shardId: shard.id,
          tierId: String(shard.data.tierId || '').trim() || null,
          findings: [finding('SHARD_PARENT_EVENT_MISSING', 'error')],
        };
      }),
    )
    .sort((left, right) =>
      `${left.eventId}/${left.shardId}`.localeCompare(`${right.eventId}/${right.shardId}`),
    );

  const summary = summarize(reportEvents, orphanShards);
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    mode: 'dry-run',
    projectId: project,
    auditNow: auditNow.toISOString(),
    failClosed: summary.errors > 0 || summary.saleability.failClosed,
    summary,
    events: reportEvents,
    orphanShards,
  };
  return { ...payload, checksumSha256: checksum(payload) };
}

export async function loadInventoryAuditInputs(db) {
  if (!db || typeof db.collection !== 'function' || typeof db.collectionGroup !== 'function') {
    throw new Error('Firestore reader is required');
  }
  const [eventsSnapshot, shardsSnapshot] = await Promise.all([
    db
      .collection('events')
      .select(
        'ticketCatalog',
        'tickets',
        'lifecycle',
        'status',
        'visibility',
        'settings',
        'isPrivate',
        'isDeleted',
        'publishedAt',
        'startDate',
        'startAt',
        'date',
        'endDate',
        'endAt',
      )
      .get(),
    db.collectionGroup('ticket_shards').get(),
  ]);
  const events = eventsSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  const shardsByEvent = {};
  for (const doc of shardsSnapshot.docs) {
    const eventRef = doc.ref?.parent?.parent;
    const eventId = String(eventRef?.id || '').trim();
    if (!eventId || eventRef?.parent?.id !== 'events') {
      throw new Error(`Cannot resolve events/{eventId} parent for shard ${doc.id}`);
    }
    (shardsByEvent[eventId] ||= []).push({ id: doc.id, data: doc.data() });
  }
  return { events, shardsByEvent };
}

export function parseInventoryAuditArgs(argv) {
  const options = { output: '', project: '', now: '', help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [key, inlineValue] = arg.split('=', 2);
    if (key === '--output') options.output = inlineValue || String(argv[++index] || '');
    else if (key === '--project') options.project = inlineValue || String(argv[++index] || '');
    else if (key === '--now') options.now = inlineValue || String(argv[++index] || '');
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--apply' || arg.startsWith('--confirm')) {
      throw new Error('This audit is report-only; apply/backfill mode does not exist');
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.now && Number.isNaN(new Date(options.now).getTime())) {
    throw new Error('--now must be a valid date');
  }
  return options;
}

function usage() {
  return [
    'Inventory V2 report-only audit (Firestore reads only)',
    '',
    '  node scripts/audit-inventory-v2.mjs --project PROJECT_ID --output ./inventory-v2-audit.json',
    '',
    'Options:',
    '  --project  Must match FIREBASE_PROJECT_ID',
    '  --output   Optional JSON report path; stdout when omitted',
    '  --now      Optional fixed audit instant for reproducible holdback results',
    '',
    'There is intentionally no apply or backfill mode.',
  ].join('\n');
}

async function main() {
  const options = parseInventoryAuditArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const configuredProjectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  if (!configuredProjectId || !isFirebaseConfigured()) {
    throw new Error('Firebase Admin credentials are not configured; no audit was run');
  }
  if (!options.project || options.project !== configuredProjectId) {
    throw new Error(`--project must exactly match configured project ${configuredProjectId}`);
  }

  const inputs = await loadInventoryAuditInputs(getAdminDb());
  const report = buildInventoryV2AuditReport({
    ...inputs,
    now: options.now || new Date(),
    projectId: configuredProjectId,
  });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) {
    const outputPath = resolve(process.cwd(), options.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, json, 'utf8');
    console.log(
      JSON.stringify({
        type: 'inventory-v2-audit-summary',
        output: outputPath,
        checksumSha256: report.checksumSha256,
        failClosed: report.failClosed,
        summary: report.summary,
      }),
    );
  } else process.stdout.write(json);

  if (report.failClosed) process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(
      JSON.stringify({
        type: 'inventory-v2-audit-error',
        code: error?.code || 'INVENTORY_V2_AUDIT_FAILED',
        message: error?.message || String(error),
      }),
    );
    process.exitCode = 1;
  });
}
