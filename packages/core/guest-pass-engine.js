import { getOrderById } from './order-engine.js';

function getDateValue(value) {
  if (!value) return null;
  try {
    const parsed = value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function getEventDate(order, event) {
  return getDateValue(
    event?.startDate || event?.startAt || order?.eventDate || order?.eventStartAt,
  );
}

function getTicketName(order) {
  return order?.tickets?.[0]?.tierName || order?.tickets?.[0]?.name || 'General';
}

function getQuantity(order) {
  return Number(order?.quantity || order?.tickets?.[0]?.quantity || 1);
}

export function buildAppleWalletPassPreview(order, event = {}, env = process.env) {
  const startDate = getEventDate(order, event);
  const hasAppleCerts = Boolean(
    env.APPLE_PASS_TYPE_ID && env.APPLE_PASS_TEAM_ID && env.APPLE_PASS_CERT_PATH,
  );

  return {
    status: 'preview',
    providerConfigured: hasAppleCerts,
    message:
      'Apple Wallet pass generation requires Apple Developer certificates. Download the ticket as PDF instead.',
    pass: {
      formatVersion: 1,
      organizationName: event.hostName || 'C1RCLE',
      description: `Ticket for ${event.title || order.eventTitle}`,
      serialNumber: order.id,
      eventTicket: {
        headerFields: [{ key: 'event', label: 'EVENT', value: event.title || order.eventTitle }],
        primaryFields: [
          {
            key: 'date',
            label: 'DATE',
            value: startDate
              ? startDate.toLocaleDateString('en-IN', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })
              : 'TBA',
          },
          {
            key: 'time',
            label: 'TIME',
            value: startDate
              ? startDate.toLocaleTimeString('en-IN', {
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: 'Asia/Kolkata',
                })
              : 'TBA',
          },
        ],
        secondaryFields: [
          {
            key: 'venue',
            label: 'VENUE',
            value: event.location || event.venueLocation || order.venue || 'TBA',
          },
          { key: 'ticket', label: 'TICKET', value: getTicketName(order) },
        ],
        auxiliaryFields: [
          { key: 'qty', label: 'QTY', value: String(getQuantity(order)) },
          { key: 'order', label: 'ORDER', value: order.id.substring(0, 8).toUpperCase() },
        ],
        backFields: [
          {
            key: 'terms',
            label: 'TERMS',
            value: 'This ticket is non-transferable after entry. Present QR code at the door.',
          },
        ],
      },
      barcode: {
        message: `C1RCLE:${order.id}`,
        format: 'PKBarcodeFormatQR',
      },
    },
  };
}

export function buildGoogleWalletPassPreview(order, event = {}, env = process.env) {
  const startDate = getEventDate(order, event);
  const hasGoogleCreds = Boolean(
    env.GOOGLE_WALLET_ISSUER_ID && env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY,
  );

  return {
    status: 'preview',
    providerConfigured: hasGoogleCreds,
    message:
      'Google Wallet pass generation requires Google Cloud credentials. Download the ticket as PDF instead.',
    pass: {
      eventName: event.title || order.eventTitle,
      venue: event.location || event.venueLocation || order.venue || 'TBA',
      ...(startDate && { dateTime: startDate.toISOString() }),
      ticketType: getTicketName(order),
      quantity: getQuantity(order),
      orderId: order.id.substring(0, 8).toUpperCase(),
      barcode: {
        type: 'QR_CODE',
        value: `C1RCLE:${order.id}`,
      },
    },
  };
}

export async function buildGuestPassPreview({
  orderId,
  platform,
  resolveEvent,
  env = process.env,
} = {}) {
  if (!orderId) {
    return { statusCode: 400, body: { error: 'Missing orderId' } };
  }

  const order = await getOrderById(orderId);
  if (!order) {
    return { statusCode: 404, body: { error: 'Order not found' } };
  }

  const event = order.eventId && resolveEvent ? (await resolveEvent(order.eventId)) || {} : {};
  const body =
    platform === 'google'
      ? buildGoogleWalletPassPreview(order, event, env)
      : buildAppleWalletPassPreview(order, event, env);

  return { statusCode: 501, body };
}

export const buildGuestPass = buildGuestPassPreview;
