import { NextResponse } from 'next/server';
import {
  followEntity,
  unfollowEntity,
  isFollowing,
} from '../../../../../lib/server/notificationStore';
import { verifyAuth } from '../../../../../lib/server/auth';

/**
 * GET /api/venues/[venueId]/follow-status
 * Check if current user follows this venue
 */
export async function GET(request, { params }) {
  try {
    const { venueId } = params;

    const decodedToken = await verifyAuth(request);
    if (!decodedToken) {
      return NextResponse.json({ isFollowing: false });
    }

    const following = await isFollowing(decodedToken.uid, venueId);
    return NextResponse.json({ isFollowing: following });
  } catch (error) {
    console.error('[Venue Follow Status API] Error:', error);
    return NextResponse.json({ isFollowing: false });
  }
}
