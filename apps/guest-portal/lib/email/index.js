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
import { generateOrderQRCodes } from '../server/qrStore';

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

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
        console.log('[Email] Would have sent ticket email to:', to, 'for order:', orderId);
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

        if (order && event) {
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

        console.log(`[Email] ✅ Confirmation sent to ${to} for order ${orderId}`, data);
        return { success: true, data };
    } catch (error) {
        console.error(`[Email] ❌ Failed to send to ${to} for order ${orderId}:`, error);
        return { success: false, error: error.message || error };
    }
}
