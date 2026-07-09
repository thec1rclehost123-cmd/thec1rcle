import { inngest, Events } from '../inngest-client.js';
import { telemetry } from '../telemetry.js';
import { extractAndSaveEventDominantColor } from '../image-utils.js';

/**
 * Extracts the dominant color from an event's poster image and saves it
 * on the event document. Triggered automatically when events are created
 * or updated with a poster URL.
 */
export const extractPosterDominantColor = inngest.createFunction(
  {
    id: 'extract-poster-dominant-color',
    name: 'Extract Poster Dominant Color',
    retries: 2,
    concurrency: {
      limit: 10,
    },
  },
  { event: Events.POSTER_COLOR_EXTRACT },
  async ({ event, step }) => {
    const { eventId, posterUrl } = event.data;

    if (!eventId || !posterUrl) {
      telemetry.track('POSTER_COLOR_EXTRACT_SKIPPED', {
        reason: !eventId ? 'missing eventId' : 'missing posterUrl',
        eventId,
      });
      return { status: 'skipped', reason: 'missing required data' };
    }

    const result = await step.run('extract-dominant-color', async () => {
      await extractAndSaveEventDominantColor(eventId, posterUrl);
      return { eventId };
    });

    telemetry.track('POSTER_COLOR_EXTRACT_COMPLETED', {
      eventId: result.eventId,
    });

    return { status: 'completed', eventId };
  },
);
