export async function getAllVenues(db, cityFilter = null) {
  let query = db.collection('venues').where('status', '==', 'active');
  
  if (cityFilter) {
    query = query.where('city', '==', cityFilter);
  }

  const snap = await query.get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getVenueById(db, venueId) {
  if (!venueId) throw new Error('Venue ID is required');

  const doc = await db.collection('venues').doc(venueId).get();
  if (!doc.exists) {
    throw new Error('Venue not found');
  }

  const data = doc.data();
  // Safe filtering of fields
  return {
    id: doc.id,
    name: data.name,
    city: data.city,
    photos: Array.isArray(data.photos) ? data.photos : [],
    address: data.address || '',
    bio: data.bio || '',
    entryRules: data.entryRules || '',
    status: data.status,
  };
}

export async function getVenueEvents(db, venueId) {
  if (!venueId) throw new Error('Venue ID is required');

  const now = new Date().toISOString();
  // Fetch future events for this venue
  const snap = await db.collection('events')
    .where('venueId', '==', venueId)
    .where('startDate', '>=', now)
    .orderBy('startDate', 'asc')
    .get();

  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function toggleVenueFollow(db, venueId, userId) {
  if (!venueId || !userId) throw new Error('Missing venueId or userId');

  const followerRef = db.collection('venues').doc(venueId).collection('venueFollowers').doc(userId);
  const followerDoc = await followerRef.get();

  if (followerDoc.exists) {
    // Unfollow
    await followerRef.delete();
    return { followed: false };
  } else {
    // Follow
    await followerRef.set({
      userId,
      followedAt: new Date().toISOString()
    });
    return { followed: true };
  }
}
