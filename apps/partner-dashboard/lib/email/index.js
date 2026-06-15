/**
 * THE C1RCLE — Email Service
 * Sends professional order confirmation emails with:
 * - Rich HTML email (dark theme, event poster, QR code)
 * - PDF ticket receipt attachment
 * - ICS calendar file attachment
 * - Gmail structured data for native calendar card
 */

import { Resend } from 'resend';
import TicketEmail from '../../components/emails/TicketEmail';
import { generateICSBuffer } from './generateICS';
import { generateTicketPDF } from './generateTicketPDF';

// QR store may not exist in partner-dashboard — import is optional
let generateOrderQRCodes = null;
try {
  const qrModule = await import('../server/qrStore');
  generateOrderQRCodes = qrModule.generateOrderQRCodes;
} catch {
  // QR generation not available in this app — will fall back to orderId
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Format date for display in emails
 */
function formatEventDate(startDate, endDate) {
  if (!startDate) return '';
  try {
    const start = new Date(startDate);
    const formatter = new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
    const result = formatter.format(start);

    if (endDate) {
      const end = new Date(endDate);
      // Only show end date if it's a different day
      if (start.toDateString() !== end.toDateString()) {
        return `${result} — ${formatter.format(end)}`;
      }
    }
    return result;
  } catch {
    return startDate;
  }
}

/**
 * Format time for display
 */
function formatEventTime(startTime, endTime) {
  if (!startTime) return '';

  const formatTime = (t) => {
    try {
      const [h, m] = t.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
    } catch {
      return t;
    }
  };

  const start = formatTime(startTime);
  if (endTime) {
    return `${start} — ${formatTime(endTime)}`;
  }
  return start;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSlotRequestDate(date) {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(date));
  } catch {
    return String(date);
  }
}

/**
 * Send professional order confirmation email
 *
 * @param {Object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.userName - Customer name
 * @param {string} params.eventName - Event title
 * @param {string} params.eventDate - Pre-formatted date string (legacy support)
 * @param {string} params.eventLocation - Venue address
 * @param {string} params.eventPosterUrl - Poster image URL
 * @param {string} params.orderId - Order ID
 * @param {Array}  params.tickets - [{ name, quantity, price, ticketId, entryType }]
 * @param {number} params.totalAmount - Total order amount
 *
 * Enhanced params (optional, falls back gracefully):
 * @param {string} params.eventId - Event ID (for generating event URL)
 * @param {string} params.eventVenue - Venue name (separate from address)
 * @param {string} params.startDate - ISO date string
 * @param {string} params.endDate - ISO date string
 * @param {string} params.startTime - HH:mm
 * @param {string} params.endTime - HH:mm
 * @param {string} params.eventDescription - Event description
 * @param {boolean} params.isRSVP - Whether this is an RSVP (free) order
 * @param {string} params.userId - User ID for QR generation
 * @param {Object} params.order - Full order object (for QR generation)
 * @param {Object} params.event - Full event object (for QR generation)
 */
export async function sendTicketEmail({
  to,
  userName,
  eventName,
  eventDate,
  eventLocation,
  eventPosterUrl,
  orderId,
  tickets,
  totalAmount,
  // Enhanced params
  eventId = '',
  eventVenue = '',
  startDate = '',
  endDate = '',
  startTime = '',
  endTime = '',
  eventDescription = '',
  isRSVP = false,
  userId = '',
  order = null,
  event = null,
}) {
  if (!resend) {
    console.warn('[Email] Resend API key not found. Skipping email send.');
    return { success: false, error: 'Missing API key' };
  }

  try {
    // ── Resolve display values ──────────────────────────────
    const displayDate = eventDate || formatEventDate(startDate, endDate);
    const displayTime = formatEventTime(startTime, endTime);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thec1rcle.com';
    const eventUrl = eventId ? `${siteUrl}/event/${eventId}` : '';
    const orderDate = new Date().toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });

    // ── Generate QR code data ───────────────────────────────
    let qrCodeData = orderId; // Fallback: just the order ID

    if (order && event && generateOrderQRCodes) {
      try {
        const qrCodes = generateOrderQRCodes(order, event);
        if (qrCodes.length > 0) {
          qrCodeData = qrCodes[0].qrData; // Use the signed QR payload
        }
      } catch (qrError) {
        console.warn('[Email] QR generation failed, using orderId fallback:', qrError.message);
      }
    }

    // ── Build attachments ───────────────────────────────────
    const attachments = [];

    // 1. PDF Ticket Receipt
    try {
      const pdfBuffer = generateTicketPDF({
        orderId,
        userName,
        eventName,
        eventDate: displayDate,
        eventTime: displayTime,
        location: eventVenue ? `${eventVenue}, ${eventLocation}` : eventLocation,
        tickets,
        totalAmount,
        isRSVP,
      });

      attachments.push({
        filename: `ticket-${orderId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      });
    } catch (pdfError) {
      console.warn('[Email] PDF generation failed:', pdfError.message);
    }

    // 2. ICS Calendar File
    try {
      const icsBuffer = generateICSBuffer({
        eventName,
        startDate: startDate || new Date().toISOString(),
        endDate: endDate || startDate || new Date().toISOString(),
        startTime,
        endTime,
        location: eventVenue ? `${eventVenue}, ${eventLocation}` : eventLocation,
        description: eventDescription || `You have tickets for ${eventName}`,
        eventUrl,
        organizer: 'THE C1RCLE',
        orderId,
      });

      attachments.push({
        filename: `${eventName.replace(/[^a-zA-Z0-9 ]/g, '').trim()}.ics`,
        content: icsBuffer,
        contentType: 'text/calendar; method=PUBLISH',
      });
    } catch (icsError) {
      console.warn('[Email] ICS generation failed:', icsError.message);
    }

    // ── Send via Resend ─────────────────────────────────────
    const data = await resend.emails.send({
      from: 'THE C1RCLE <tickets@thec1rcle.com>',
      to: [to],
      subject: `Your Ticket for ${eventName}`,
      react: TicketEmail({
        userName,
        eventName,
        eventDate: displayDate,
        eventTime: displayTime,
        eventLocation,
        eventVenue,
        eventPosterUrl,
        eventUrl,
        eventStartDate: startDate,
        eventEndDate: endDate,
        orderId,
        orderDate,
        tickets,
        totalAmount,
        isRSVP,
        qrCodeData,
      }),
      attachments: attachments.length > 0 ? attachments : undefined,
      headers: {
        'X-Entity-Ref-ID': orderId,
      },
    });

    console.info(`[Email] ✅ Confirmation sent to ${to} for order ${orderId}`);
    return { success: true, data };
  } catch (error) {
    console.error(`[Email] ❌ Failed to send to ${to} for order ${orderId}:`, error);
    return { success: false, error: error.message || error };
  }
}

export async function sendVenueSlotRequestEmail({
  to,
  venueName,
  hostName,
  eventTitle,
  requestedDate,
  requestedStartTime,
  requestedEndTime,
  notes = '',
  eventId = '',
  slotRequestId = '',
}) {
  if (!to || (Array.isArray(to) && to.length === 0)) {
    return { success: false, error: 'Missing recipients' };
  }

  if (!resend) {
    console.warn('[Email] Resend API key not found. Skipping slot request email send.');
    return { success: false, error: 'Missing API key' };
  }

  try {
    const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://dashboard.thec1rcle.com';
    const requestsUrl = `${dashboardUrl}/venue/events/requests`;
    const eventUrl = eventId ? `${dashboardUrl}/venue/events/${eventId}` : requestsUrl;
    const displayDate = formatSlotRequestDate(requestedDate);
    const displayTime =
      formatEventTime(requestedStartTime, requestedEndTime) ||
      `${requestedStartTime} - ${requestedEndTime}`;

    const html = `
            <div style="margin:0;padding:32px;background:#08090b;font-family:Inter,Arial,sans-serif;color:#f5f5f5;">
                <div style="max-width:620px;margin:0 auto;border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;background:linear-gradient(180deg,#121316 0%,#0c0d10 100%);box-shadow:0 24px 80px rgba(0,0,0,0.45);">
                    <div style="padding:28px 28px 20px;border-bottom:1px solid rgba(255,255,255,0.06);background:radial-gradient(circle at top right,rgba(244,74,34,0.22),transparent 46%),#121316;">
                        <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(244,74,34,0.12);color:#ff9a6b;font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">
                            New Slot Request
                        </div>
                        <h1 style="margin:16px 0 10px;font-size:30px;line-height:1.02;font-weight:900;letter-spacing:-0.04em;color:#ffffff;">
                            ${escapeHtml(hostName || 'A host')} wants a date on your calendar.
                        </h1>
                        <p style="margin:0;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.72);">
                            ${escapeHtml(hostName || 'A host')} submitted a new slot request for <strong style="color:#ffffff;">${escapeHtml(eventTitle || 'an event')}</strong> at <strong style="color:#ffffff;">${escapeHtml(venueName || 'your venue')}</strong>.
                        </p>
                    </div>

                    <div style="padding:24px 28px;">
                        <div style="border:1px solid rgba(255,255,255,0.08);border-radius:20px;background:#0f1013;padding:20px 20px 16px;">
                            <div style="font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.42);margin-bottom:12px;">Request Summary</div>
                            <div style="font-size:24px;font-weight:900;letter-spacing:-0.03em;color:#ffffff;margin-bottom:10px;">${escapeHtml(eventTitle || 'Untitled Event')}</div>
                            <div style="font-size:14px;line-height:1.8;color:rgba(255,255,255,0.8);">
                                <div><strong style="color:#ffffff;">Host:</strong> ${escapeHtml(hostName || 'Unknown Host')}</div>
                                <div><strong style="color:#ffffff;">Requested Date:</strong> ${escapeHtml(displayDate)}</div>
                                <div><strong style="color:#ffffff;">Requested Time:</strong> ${escapeHtml(displayTime)}</div>
                            </div>
                            ${
                              notes
                                ? `
                                <div style="margin-top:16px;padding:14px 16px;border-radius:16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);">
                                    <div style="font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.42);margin-bottom:8px;">Host Note</div>
                                    <div style="font-size:14px;line-height:1.65;color:rgba(255,255,255,0.78);">${escapeHtml(notes)}</div>
                                </div>
                            `
                                : ''
                            }
                        </div>

                        <div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">
                            <a href="${requestsUrl}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:linear-gradient(135deg,#f97316,#ea580c);color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;">
                                Review Slot Requests
                            </a>
                            <a href="${eventUrl}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
                                Open Event
                            </a>
                        </div>

                        <p style="margin:22px 0 0;font-size:12px;line-height:1.7;color:rgba(255,255,255,0.48);">
                            Review the request in your venue dashboard to approve, reject, or suggest a different slot.
                        </p>
                    </div>
                </div>
            </div>
        `;

    const data = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'THE C1RCLE <notifications@thec1rcle.com>',
      to: Array.isArray(to) ? to : [to],
      subject: `${hostName || 'A host'} requested a slot at ${venueName || 'your venue'}`,
      html,
      headers: {
        'X-Entity-Ref-ID': slotRequestId || eventId || 'slot-request',
      },
    });

    console.info(`[Email] ✅ Slot request notification sent for ${slotRequestId}`);
    return { success: true, data };
  } catch (error) {
    console.error(`[Email] ❌ Failed to send slot request notification ${slotRequestId}:`, error);
    return { success: false, error: error.message || error };
  }
}
