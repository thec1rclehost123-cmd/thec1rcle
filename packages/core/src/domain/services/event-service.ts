import { IEventRepository, Event } from '../repositories/event-repository.js';
import { buildEvent } from '@c1rcle/core/event-engine';
import { EVENT_LIFECYCLE } from '@c1rcle/core/events';
import { getAdminDb } from '@c1rcle/core/admin';

const START_DATE_REQUIRED_LIFECYCLES = new Set([
  EVENT_LIFECYCLE.SUBMITTED,
  EVENT_LIFECYCLE.APPROVED,
  EVENT_LIFECYCLE.SCHEDULED,
  EVENT_LIFECYCLE.LIVE,
  EVENT_LIFECYCLE.PAUSED,
  EVENT_LIFECYCLE.COMPLETED,
]);

function withCode<T extends Error>(error: T, code: string, statusCode = 400): T {
  return Object.assign(error, { code, statusCode });
}

function toFiniteNumber(value: any): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeCoordinates(value: any): { latitude: number; longitude: number } | null {
  if (!value || typeof value !== 'object') return null;
  const latitude =
    toFiniteNumber(value.latitude) ?? toFiniteNumber(value.lat) ?? toFiniteNumber(value._latitude);
  const longitude =
    toFiniteNumber(value.longitude) ??
    toFiniteNumber(value.lng) ??
    toFiniteNumber(value.lon) ??
    toFiniteNumber(value._longitude);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function normalizeLifecycle(payload: any): string | undefined {
  const lifecycle = String(payload.lifecycle || '').toLowerCase();
  const status = String(payload.status || '').toLowerCase();
  if (lifecycle === 'active') return EVENT_LIFECYCLE.SCHEDULED;
  if (lifecycle) return lifecycle;
  if (status === 'published') return EVENT_LIFECYCLE.SCHEDULED;
  if (status === 'draft') return EVENT_LIFECYCLE.DRAFT;
  if (status === 'cancelled' || status === 'canceled') return EVENT_LIFECYCLE.CANCELLED;
  if (status === 'completed') return EVENT_LIFECYCLE.COMPLETED;
  return undefined;
}

async function resolveVenueCoordinates(venueId?: string | null) {
  if (!venueId) return null;
  try {
    const db = getAdminDb();
    const doc = await db.collection('venues').doc(String(venueId)).get();
    if (!doc.exists) return null;
    const venue = doc.data() || {};
    return normalizeCoordinates(
      venue.coordinates || venue.locationCoordinates || venue.geo || venue._geoloc,
    );
  } catch {
    return null;
  }
}

export class EventService {
  constructor(private eventRepo: IEventRepository) {}

  async getEventByIdOrSlug(id: string, workspaceId: string): Promise<Event | null> {
    const event = await this.eventRepo.getById(id, workspaceId);
    if (event) return event;
    return this.eventRepo.getBySlug(id, workspaceId);
  }

  async listEvents(
    filters: any,
    workspaceId: string,
  ): Promise<{ events: Event[]; nextCursor: string | null; hasMore: boolean }> {
    try {
      const { limit = 20 } = filters;
      // Fetch limit + 1 to determine if there's a next page
      const events = await this.eventRepo.list({ ...filters, limit: limit + 1 }, workspaceId);

      const hasMore = events.length > limit;
      const data = events.slice(0, limit);
      const nextCursor = hasMore ? data[data.length - 1].id : null;

      return { events: data, nextCursor, hasMore };
    } catch (error: any) {
      console.error('EventService.listEvents failed:', error.message);
      return { events: [], nextCursor: null, hasMore: false };
    }
  }

  async createEvent(payload: any, actorId: string, workspaceId: string): Promise<Event> {
    const normalizedPayload = await this.normalizeEventPayload(payload);
    const event = buildEvent({
      ...normalizedPayload,
      creatorId: actorId,
      workspaceId, // 🏢 SaaS: Tag event with workspace
    });
    event.workspaceId = workspaceId; // Ensure property is present for TS
    await this.eventRepo.create(event as Event);
    return event as Event;
  }

  async updateEvent(
    id: string,
    updates: any,
    actorId: string,
    workspaceId: string,
  ): Promise<Event | null> {
    const existing = await this.getEventByIdOrSlug(id, workspaceId);
    if (!existing) return null;

    const normalizedUpdates = await this.normalizeEventPayload({ ...existing, ...updates });
    const updatedEvent = buildEvent({
      ...existing,
      ...normalizedUpdates,
      id,
      updatedAt: new Date().toISOString(),
    });
    updatedEvent.workspaceId = workspaceId;

    await this.eventRepo.update(id, updatedEvent as Partial<Event>, workspaceId);
    return updatedEvent as Event;
  }

  private async normalizeEventPayload(payload: any): Promise<any> {
    const normalized = { ...payload };
    const lifecycle = normalizeLifecycle(normalized);
    if (lifecycle) {
      normalized.lifecycle = lifecycle;
    }

    if (START_DATE_REQUIRED_LIFECYCLES.has(normalized.lifecycle) && !normalized.startDate) {
      throw withCode(
        new Error('startDate is required for public or submitted events'),
        'BAD_REQUEST',
      );
    }

    const explicitCoordinates = normalizeCoordinates(normalized.coordinates);
    const venueCoordinates = explicitCoordinates
      ? null
      : await resolveVenueCoordinates(normalized.venueId || null);
    const coordinates = explicitCoordinates || venueCoordinates;
    if (coordinates) {
      normalized.coordinates = coordinates;
      normalized.latitude = coordinates.latitude;
      normalized.longitude = coordinates.longitude;
    }

    return normalized;
  }

  async deleteEvent(id: string, actorId: string, workspaceId: string): Promise<void> {
    await this.eventRepo.updateLifecycle(id, 'deleted', actorId, workspaceId);
  }

  async listNearby(lat: number, lng: number, radius: number, limit: number): Promise<any[]> {
    // Enforce limit at repository level
    const events = await this.eventRepo.listNearby(lat, lng, radius, limit);

    // Maintain Haversine parity for exact distance sorting
    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    return events
      .map((data: any) => {
        const coords = data.coordinates;
        const latitude = toFiniteNumber(coords?.latitude);
        const longitude = toFiniteNumber(coords?.longitude);
        if (latitude === null || longitude === null) return null;
        const distance = haversine(lat, lng, latitude, longitude);
        return { ...data, distance };
      })
      .filter((e: any) => e !== null && e.distance <= radius)
      .sort((a: any, b: any) => a.distance - b.distance)
      .slice(0, limit);
  }
}
