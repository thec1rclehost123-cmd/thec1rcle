/**
 * ICS Calendar File Generator
 * Creates downloadable .ics calendar invites for events
 */

/**
 * Generate an ICS calendar file string
 * @param {Object} params
 * @param {string} params.eventName - Event title
 * @param {string} params.startDate - ISO date string
 * @param {string} params.endDate - ISO date string (optional)
 * @param {string} params.startTime - HH:mm format (optional)
 * @param {string} params.endTime - HH:mm format (optional)
 * @param {string} params.location - Event location/venue address
 * @param {string} params.description - Event description
 * @param {string} params.eventUrl - Link to event page
 * @param {string} params.organizer - Organizer name
 * @param {string} params.orderId - Order ID for unique UID
 * @returns {string} ICS file content
 */
export function generateICSContent({
    eventName,
    startDate,
    endDate,
    startTime,
    endTime,
    location,
    description = '',
    eventUrl = '',
    organizer = 'THE C1RCLE',
    orderId = '',
}) {
    // Build start/end DateTime in UTC format for ICS
    const buildDateTime = (dateStr, timeStr) => {
        try {
            const date = new Date(dateStr);
            if (timeStr) {
                const [hours, minutes] = timeStr.split(':').map(Number);
                date.setHours(hours, minutes, 0, 0);
            }
            // Format: 20260205T190000Z
            return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        } catch {
            return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        }
    };

    const dtStart = buildDateTime(startDate, startTime);
    const dtEnd = endDate
        ? buildDateTime(endDate, endTime || startTime)
        : buildDateTime(startDate, endTime || startTime);

    const uid = `${orderId || Date.now()}@thec1rcle.com`;
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    // Escape special characters for ICS
    const escapeICS = (str) => (str || '').replace(/[,;\\]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//THE C1RCLE//Ticket System//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${escapeICS(eventName)}`,
        `LOCATION:${escapeICS(location)}`,
        `DESCRIPTION:${escapeICS(description)}${eventUrl ? `\\n\\nView event: ${eventUrl}` : ''}`,
        `ORGANIZER;CN=${escapeICS(organizer)}:mailto:tickets@thec1rcle.com`,
        eventUrl ? `URL:${eventUrl}` : '',
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT1H',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeICS(eventName)} starts in 1 hour`,
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
    ].filter(Boolean);

    return lines.join('\r\n');
}

/**
 * Generate ICS as a Buffer for email attachment
 */
export function generateICSBuffer(params) {
    const content = generateICSContent(params);
    return Buffer.from(content, 'utf-8');
}
