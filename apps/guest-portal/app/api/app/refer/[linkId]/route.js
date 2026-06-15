import { guestBffUpstreamJson } from '../../../../../lib/bff/server.js';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const { linkId } = await params;
  if (!linkId) {
    return Response.json({ ok: false, error: { message: 'Missing linkId' } }, { status: 400 });
  }

  // Resolve link by ID from the gateway
  const result = await guestBffUpstreamJson(`/promoter-links/${encodeURIComponent(linkId)}`);

  if (!result.response.ok || !result.data?.link) {
    return Response.json(
      { ok: false, error: { message: 'Link not found or inactive' } },
      { status: 404 },
    );
  }

  const link = result.data.link;
  return Response.json({
    ok: true,
    data: {
      linkId: link.id,
      code: link.code,
      eventId: link.eventId,
      eventSlug: link.eventSlug || link.eventId,
      isActive: link.isActive,
    },
  });
}
