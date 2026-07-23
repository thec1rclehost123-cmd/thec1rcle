/**
 * THE C1RCLE — Professional Order Confirmation Email
 * Dark-themed, poster-featured, Posh-quality ticket confirmation
 *
 * Includes:
 * - Personalized "You're in..." heading
 * - Event poster/cover image
 * - Ticket count & order total
 * - Date, time, venue with Google Maps link
 * - "View event details" CTA
 * - Order summary section
 * - QR code for entry
 * - Terms of Service / Privacy Policy
 * - Brand footer with social links
 *
 * Gmail structured data (JSON-LD) is injected for
 * the native calendar card preview in Gmail inbox.
 */

// ─── Helpers ──────────────────────────────────────────────────

const formatCurrency = (amount) => {
  if (amount === 0) return 'Free';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
};

const getGoogleMapsUrl = (address) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const getGoogleCalendarUrl = ({ eventName, startDate, endDate, location, description }) => {
  const fmt = (d) =>
    new Date(d)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventName,
    dates: `${fmt(startDate)}/${fmt(endDate || startDate)}`,
    location: location || '',
    details: description || `Your ticket for ${eventName} via THE C1RCLE`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

// ─── Inline Styles (email-safe) ───────────────────────────────

const styles = {
  body: {
    backgroundColor: '#0A0A0B',
    color: '#ffffff',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    margin: 0,
    padding: 0,
    width: '100%',
    WebkitTextSizeAdjust: '100%',
  },
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: '#0A0A0B',
    padding: '0',
  },
  // Header
  headerPad: {
    padding: '40px 32px 24px 32px',
  },
  heroText: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#ffffff',
    margin: '0 0 8px 0',
    lineHeight: '1.2',
  },
  dividerThin: {
    borderTop: '1px solid #27272A',
    margin: '16px 0',
  },
  eventTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#ffffff',
    margin: '0',
    lineHeight: '1.3',
  },
  // Poster
  posterWrap: {
    padding: '0 32px 24px 32px',
  },
  posterImg: {
    width: '100%',
    height: 'auto',
    display: 'block',
    borderRadius: '12px',
    border: '1px solid #27272A',
  },
  // Ticket summary
  section: {
    padding: '0 32px 24px 32px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#6366F1',
    margin: '0 0 4px 0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  value: {
    fontSize: '15px',
    color: '#E4E4E7',
    margin: '0 0 2px 0',
    lineHeight: '1.5',
  },
  valueBold: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#ffffff',
    margin: '0 0 2px 0',
    lineHeight: '1.5',
  },
  link: {
    color: '#818CF8',
    fontSize: '13px',
    textDecoration: 'underline',
  },
  // CTA
  ctaWrap: {
    padding: '8px 32px 28px 32px',
    textAlign: 'center',
  },
  ctaButton: {
    display: 'inline-block',
    backgroundColor: '#6366F1',
    color: '#ffffff',
    padding: '14px 36px',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '600',
    textDecoration: 'none',
    letterSpacing: '0.3px',
  },
  // Order Summary
  orderSection: {
    padding: '28px 32px',
    borderTop: '1px solid #27272A',
  },
  orderTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffffff',
    margin: '0 0 16px 0',
  },
  orderMeta: {
    fontSize: '13px',
    color: '#A1A1AA',
    margin: '0 0 4px 0',
  },
  orderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #1C1C1E',
  },
  orderItemName: {
    fontSize: '14px',
    color: '#E4E4E7',
  },
  orderItemPrice: {
    fontSize: '14px',
    color: '#E4E4E7',
    fontWeight: '600',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0 0 0',
    borderTop: '1px solid #27272A',
    marginTop: '8px',
  },
  totalLabel: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffffff',
  },
  totalValue: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffffff',
  },
  // Terms
  termsText: {
    fontSize: '11px',
    color: '#71717A',
    margin: '16px 0 0 0',
    lineHeight: '1.5',
  },
  // QR
  qrSection: {
    padding: '24px 32px 8px 32px',
    textAlign: 'center',
  },
  qrBox: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    display: 'inline-block',
  },
  qrHint: {
    fontSize: '12px',
    color: '#374151',
    margin: '0 0 16px 0',
    fontWeight: '500',
  },
  qrSubHint: {
    fontSize: '11px',
    color: '#9CA3AF',
    margin: '12px 0 0 0',
  },
  // Footer
  footer: {
    padding: '32px',
    textAlign: 'center',
    borderTop: '1px solid #27272A',
  },
  brandName: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-0.5px',
    margin: '0 0 16px 0',
  },
  socialRow: {
    margin: '0 0 16px 0',
  },
  socialIcon: {
    display: 'inline-block',
    width: '28px',
    height: '28px',
    margin: '0 6px',
    color: '#A1A1AA',
    textDecoration: 'none',
    fontSize: '18px',
  },
  footerText: {
    fontSize: '12px',
    color: '#52525B',
    margin: '0 0 4px 0',
  },
};

// ─── Component ───────────────────────────────────────────────

export const TicketEmail = ({
  userName = 'Guest',
  eventName = 'Event',
  eventDate = '',
  eventTime = '',
  eventLocation = '',
  eventVenue = '',
  eventPosterUrl = '',
  eventUrl = '',
  eventStartDate = '',
  eventEndDate = '',
  orderId = '',
  orderDate = '',
  tickets = [],
  totalAmount = 0,
  isRSVP = false,
  qrCodeData = '',
}) => {
  const previewText = `Your ticket for ${eventName} — ${eventDate}`;
  const displayLocation = eventVenue ? `${eventVenue}, ${eventLocation}` : eventLocation;
  const mapsUrl = getGoogleMapsUrl(displayLocation);
  const calendarUrl = getGoogleCalendarUrl({
    eventName,
    startDate: eventStartDate || new Date().toISOString(),
    endDate: eventEndDate || eventStartDate || new Date().toISOString(),
    location: displayLocation,
  });

  const qrImageUrl = qrCodeData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeData)}&bgcolor=FFFFFF&color=000000&margin=10`
    : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(orderId)}&bgcolor=FFFFFF&color=000000&margin=10`;

  const ticketCountLabel = tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);

  // JSON-LD structured data for Gmail calendar card
  const jsonLd = {
    '@context': 'http://schema.org',
    '@type': 'EventReservation',
    reservationNumber: orderId,
    reservationStatus: 'http://schema.org/ReservationConfirmed',
    underName: {
      '@type': 'Person',
      name: userName,
    },
    reservationFor: {
      '@type': 'Event',
      name: eventName,
      startDate: eventStartDate || new Date().toISOString(),
      endDate: eventEndDate || eventStartDate || new Date().toISOString(),
      location: {
        '@type': 'Place',
        name: eventVenue || eventLocation,
        address: {
          '@type': 'PostalAddress',
          streetAddress: eventLocation,
        },
      },
      ...(eventPosterUrl ? { image: eventPosterUrl } : {}),
    },
  };

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
        <title>{previewText}</title>
        {/* Hidden preview text for email clients */}
        <div style={{ display: 'none', maxHeight: 0, overflow: 'hidden' }}>
          {previewText}
          {'\u200C'.repeat(150)}
        </div>
        {/* Gmail structured data for calendar card.
                    Safety: jsonLd is constructed entirely from server-controlled values
                    (event name, date, venue, ticket ID) — never from raw user input.
                    JSON.stringify ensures all values are properly escaped. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body style={styles.body}>
        <table
          role="presentation"
          cellPadding="0"
          cellSpacing="0"
          width="100%"
          style={{ backgroundColor: '#0A0A0B' }}
        >
          <tr>
            <td align="center">
              <table
                role="presentation"
                cellPadding="0"
                cellSpacing="0"
                style={styles.container}
                width="600"
              >
                {/* ── Header: "You're in..." ── */}
                <tr>
                  <td style={styles.headerPad}>
                    <h1 style={styles.heroText}>{userName.split(' ')[0]}, you're in...</h1>
                    <div style={styles.dividerThin} />
                    <h2 style={styles.eventTitle}>{eventName}</h2>
                  </td>
                </tr>

                {/* ── Event Poster ── */}
                {eventPosterUrl && (
                  <tr>
                    <td style={styles.posterWrap}>
                      <a href={eventUrl || '#'}>
                        <img
                          src={eventPosterUrl}
                          alt={eventName}
                          style={styles.posterImg}
                          width="536"
                        />
                      </a>
                    </td>
                  </tr>
                )}

                {/* ── Ticket Details ── */}
                <tr>
                  <td style={styles.section}>
                    {/* Ticket count */}
                    <p style={styles.label}>
                      {ticketCountLabel}x Ticket{ticketCountLabel > 1 ? 's' : ''}
                    </p>
                    <p style={{ ...styles.value, color: '#A1A1AA', marginBottom: '16px' }}>
                      Order total: {isRSVP ? 'RSVP (Free)' : formatCurrency(totalAmount)}
                    </p>

                    {/* Date & Time */}
                    <p style={styles.valueBold}>
                      {eventDate}
                      {eventTime ? `, ${eventTime}` : ''}
                    </p>

                    {/* Venue & Location */}
                    {eventVenue && <p style={styles.valueBold}>{eventVenue}</p>}
                    <p style={styles.value}>{eventLocation}</p>
                    <a href={mapsUrl} style={styles.link}>
                      View on map
                    </a>
                  </td>
                </tr>

                {/* ── CTA Buttons ── */}
                <tr>
                  <td style={styles.ctaWrap}>
                    {eventUrl && (
                      <a href={eventUrl} style={styles.ctaButton}>
                        View event details
                      </a>
                    )}
                  </td>
                </tr>

                {/* ── Add to Calendar ── */}
                <tr>
                  <td style={{ ...styles.section, paddingBottom: '8px', textAlign: 'center' }}>
                    <a href={calendarUrl} style={{ ...styles.link, fontSize: '14px' }}>
                      Add to calendar »
                    </a>
                  </td>
                </tr>

                {/* ── Order Summary ── */}
                <tr>
                  <td style={styles.orderSection}>
                    <h3 style={styles.orderTitle}>Order Summary</h3>
                    <p style={styles.orderMeta}>
                      Order {orderId} —{' '}
                      {orderDate ||
                        new Date().toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZone: 'Asia/Kolkata',
                        })}
                    </p>

                    {/* Ticket line items */}
                    <table
                      role="presentation"
                      cellPadding="0"
                      cellSpacing="0"
                      width="100%"
                      style={{ marginTop: '12px' }}
                    >
                      {tickets.map((ticket, index) => (
                        <tr key={index}>
                          <td
                            style={{
                              padding: '10px 0',
                              borderBottom: '1px solid #1C1C1E',
                              fontSize: '14px',
                              color: '#E4E4E7',
                            }}
                          >
                            {userName} × {ticket.quantity || 1}x {ticket.name}
                          </td>
                          <td
                            style={{
                              padding: '10px 0',
                              borderBottom: '1px solid #1C1C1E',
                              fontSize: '14px',
                              color: '#E4E4E7',
                              fontWeight: '600',
                              textAlign: 'right',
                            }}
                          >
                            {isRSVP
                              ? 'RSVP'
                              : formatCurrency((ticket.price || 0) * (ticket.quantity || 1))}
                          </td>
                        </tr>
                      ))}
                      {/* Total */}
                      <tr>
                        <td
                          style={{
                            padding: '14px 0 0 0',
                            fontSize: '16px',
                            fontWeight: '700',
                            color: '#ffffff',
                          }}
                        >
                          Total
                        </td>
                        <td
                          style={{
                            padding: '14px 0 0 0',
                            fontSize: '16px',
                            fontWeight: '700',
                            color: '#ffffff',
                            textAlign: 'right',
                          }}
                        >
                          {isRSVP ? 'RSVP $0' : formatCurrency(totalAmount)}
                        </td>
                      </tr>
                    </table>

                    {/* Terms */}
                    <p style={styles.termsText}>
                      This order is subject to THE C1RCLE's{' '}
                      <a
                        href="https://thec1rcle.com/terms"
                        style={{ color: '#71717A', textDecoration: 'underline' }}
                      >
                        Terms of Service
                      </a>{' '}
                      and{' '}
                      <a
                        href="https://thec1rcle.com/privacy"
                        style={{ color: '#71717A', textDecoration: 'underline' }}
                      >
                        Privacy Policy
                      </a>
                      .
                    </p>
                  </td>
                </tr>

                {/* ── QR Code ── */}
                <tr>
                  <td style={styles.qrSection}>
                    <div style={styles.qrBox}>
                      <p style={styles.qrHint}>
                        This QR is for the entire order. Individual QR codes for each ticket are
                        located in the attached PDF.
                      </p>
                      <img
                        src={qrImageUrl}
                        alt="Order QR Code"
                        width="180"
                        height="180"
                        style={{ display: 'block', margin: '0 auto' }}
                      />
                      <p style={styles.qrSubHint}>Show this at the venue entrance</p>
                    </div>
                  </td>
                </tr>

                {/* ── Footer ── */}
                <tr>
                  <td style={styles.footer}>
                    <p style={styles.brandName}>THE C1RCLE</p>

                    {/* Social Icons */}
                    <div style={styles.socialRow}>
                      <a
                        href="https://instagram.com/thec1rcle"
                        style={styles.socialIcon}
                        title="Instagram"
                      >
                        📷
                      </a>
                      <a
                        href="https://twitter.com/thec1rcle"
                        style={styles.socialIcon}
                        title="Twitter / X"
                      >
                        𝕏
                      </a>
                    </div>

                    <p style={styles.footerText}>Pune, India</p>
                    <p style={styles.footerText}>
                      © {new Date().getFullYear()} THE C1RCLE. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  );
};

export default TicketEmail;
