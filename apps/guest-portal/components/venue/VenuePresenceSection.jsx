/**
 * VenuePresenceSection
 * Renders the venue owner-configured presence data:
 *   - Description (if set)
 *   - Price range (if set)
 *   - Table booking info (if enabled)
 *
 * Data comes from venues/{venueId}.presenceConfig written by the Partner Dashboard.
 */

export default function VenuePresenceSection({ presenceConfig, venueName }) {
  if (!presenceConfig) return null;

  const { description, price, bookingConfig } = presenceConfig;
  const hasContent = description || price || bookingConfig?.enabled;

  if (!hasContent) return null;

  return (
    <section className="px-4 sm:px-6 py-8">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Description */}
        {description && (
          <div>
            <h2 className="text-lg font-bold text-black dark:text-white mb-2">About {venueName}</h2>
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              {description}
            </p>
          </div>
        )}

        {/* Price */}
        {price && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Price Range
            </span>
            <span className="text-sm font-semibold text-black dark:text-white">{price}</span>
          </div>
        )}

        {/* Table Booking */}
        {bookingConfig?.enabled && (
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{
              background: 'rgba(244,74,34,0.05)',
              border: '1px solid rgba(244,74,34,0.15)',
            }}
          >
            <div>
              <h3 className="text-base font-bold text-black dark:text-white">Book a Table</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Reserve your spot at {venueName}
              </p>
            </div>

            {/* Timings */}
            {bookingConfig.timings?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
                  Available Timings
                </p>
                <div className="flex flex-wrap gap-2">
                  {bookingConfig.timings.map((t, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{
                        background: 'rgba(244,74,34,0.1)',
                        color: '#F44A22',
                        border: '1px solid rgba(244,74,34,0.2)',
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Capacity */}
            {bookingConfig.capacity > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Capacity: up to{' '}
                <span className="font-semibold text-black dark:text-white">
                  {bookingConfig.capacity}
                </span>{' '}
                guests
              </p>
            )}

            {/* Contact */}
            {bookingConfig.contact && (
              <a
                href={
                  bookingConfig.contact.includes('@')
                    ? `mailto:${bookingConfig.contact}`
                    : `tel:${bookingConfig.contact}`
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: '#F44A22' }}
              >
                Book Now · {bookingConfig.contact}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
