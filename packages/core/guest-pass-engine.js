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

function missingEnv(env, keys) {
  return keys.filter((key) => !env[key]);
}

function interpolateUrlTemplate(template, values) {
  return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) =>
    encodeURIComponent(values[key] || ''),
  );
}

function notConfigured(provider, missing) {
  return {
    statusCode: 503,
    body: {
      success: false,
      code: 'not_configured',
      provider,
      missing,
      fallback: 'pdf',
      message: `${provider === 'apple' ? 'Apple Wallet' : 'Google Wallet'} credentials are not configured.`,
    },
  };
}

function notImplemented(provider) {
  return {
    statusCode: 501,
    body: {
      success: false,
      code: 'not_implemented',
      provider,
      fallback: 'pdf',
      message: `${provider === 'apple' ? 'Apple Wallet' : 'Google Wallet'} credentials are configured, but pass artifact generation is not enabled.`,
    },
  };
}

export async function buildGuestPass({ orderId, platform, resolveEvent, env = process.env } = {}) {
  if (!orderId) {
    return { statusCode: 400, body: { error: 'Missing orderId' } };
  }

  const order = await getOrderById(orderId);
  if (!order) {
    return { statusCode: 404, body: { error: 'Order not found' } };
  }

  const event = order.eventId && resolveEvent ? (await resolveEvent(order.eventId)) || {} : {};

  if (platform === 'google') {
    const template = env.GOOGLE_WALLET_SAVE_URL_TEMPLATE;
    const missing = template
      ? []
      : missingEnv(env, ['GOOGLE_WALLET_ISSUER_ID', 'GOOGLE_WALLET_SERVICE_ACCOUNT_KEY']);
    if (missing.length > 0) return notConfigured('google', missing);
    if (!template) return notImplemented('google');

    return {
      statusCode: 200,
      body: {
        success: true,
        provider: 'google',
        saveUrl: interpolateUrlTemplate(template, {
          orderId,
          eventId: order.eventId || '',
          userId: order.userId || '',
        }),
        pass: buildGoogleWalletPassPreview(order, event, env).pass,
      },
    };
  }

  const template = env.APPLE_WALLET_PASS_URL_TEMPLATE;
  const missing = template
    ? []
    : missingEnv(env, [
        'APPLE_PASS_TYPE_ID',
        'APPLE_PASS_TEAM_ID',
        'APPLE_PASS_CERT_PATH',
        'APPLE_PASS_KEY_PATH',
        'APPLE_PASS_WWDR_CERT_PATH',
      ]);
  if (missing.length > 0) return notConfigured('apple', missing);
  if (!template) return notImplemented('apple');

  return {
    statusCode: 302,
    headers: {
      Location: interpolateUrlTemplate(template, {
        orderId,
        eventId: order.eventId || '',
        userId: order.userId || '',
      }),
    },
    body: null,
  };
}

export async function buildGuestPassPreview(options = {}) {
  return buildGuestPass(options);
}
