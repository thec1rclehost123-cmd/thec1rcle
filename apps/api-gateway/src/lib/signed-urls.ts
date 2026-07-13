import { getAdminStorage } from '@c1rcle/core/admin';

export function parseStorageUrl(url: string | null | undefined) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'storage.googleapis.com') {
      // Format: https://storage.googleapis.com/bucket-name/object-path
      const parts = parsed.pathname.slice(1).split('/');
      const bucketName = parts[0];
      const objectPath = parts.slice(1).join('/');
      return { bucketName, objectPath };
    }
    if (parsed.hostname === 'firebasestorage.googleapis.com') {
      // Format: https://firebasestorage.googleapis.com/v0/b/bucket-name/o/object-path
      const parts = parsed.pathname.slice(1).split('/');
      if (parts[1] === 'b' && parts[3] === 'o') {
        const bucketName = parts[2];
        const encodedPath = parts.slice(4).join('/');
        const objectPath = decodeURIComponent(encodedPath);
        return { bucketName, objectPath };
      }
    }
  } catch {}
  return null;
}

export function cleanStorageUrl(url: string | null | undefined): string | null | undefined {
  if (!url || typeof url !== 'string') return url;
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === 'storage.googleapis.com' ||
      parsed.hostname === 'firebasestorage.googleapis.com'
    ) {
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    }
  } catch {}
  return url;
}

export async function signStorageUrl(
  url: string | null | undefined,
): Promise<string | null | undefined> {
  if (!url || typeof url !== 'string') return url;
  const parsed = parseStorageUrl(url);
  if (!parsed) return url;

  try {
    const storage = getAdminStorage();
    const bucket = storage.bucket();

    // Check if the URL belongs to our bucket and has an allowed path prefix
    if (
      parsed.bucketName === bucket.name &&
      (parsed.objectPath.startsWith('venues/') ||
        parsed.objectPath.startsWith('support-attachments/') ||
        parsed.objectPath.startsWith('hosts/') ||
        parsed.objectPath.startsWith('promoters/') ||
        parsed.objectPath.startsWith('kyc/') ||
        parsed.objectPath.startsWith('kyc-documents/'))
    ) {
      const file = bucket.file(parsed.objectPath);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days expiration
      });
      return signedUrl;
    }
  } catch (err) {
    // If anything fails (e.g. invalid credentials for signing), fallback to original URL
    console.error('Failed to sign storage URL:', err);
  }
  return url;
}

export async function enrichVenueProfileWithSignedUrls(venueOrProfile: any) {
  if (!venueOrProfile || typeof venueOrProfile !== 'object') return venueOrProfile;

  const fieldsToSign = [
    'profileImage',
    'photoURL',
    'logo',
    'coverImage',
    'coverURL',
    'backdropURL',
  ];

  for (const key of fieldsToSign) {
    if (venueOrProfile[key]) {
      venueOrProfile[key] = await signStorageUrl(venueOrProfile[key]);
    }
  }

  if (Array.isArray(venueOrProfile.photos)) {
    venueOrProfile.photos = await Promise.all(
      venueOrProfile.photos.map((url: any) => signStorageUrl(url)),
    );
  }

  return venueOrProfile;
}

export function cleanVenueProfilePatch(patch: any) {
  if (!patch || typeof patch !== 'object') return patch;

  const fieldsToClean = [
    'profileImage',
    'photoURL',
    'logo',
    'coverImage',
    'coverURL',
    'backdropURL',
  ];

  for (const key of fieldsToClean) {
    if (patch[key] !== undefined) {
      patch[key] = cleanStorageUrl(patch[key]);
    }
  }

  if (Array.isArray(patch.photos)) {
    patch.photos = patch.photos.map((url: any) => cleanStorageUrl(url));
  }

  return patch;
}

export async function enrichSupportTicketWithSignedUrls(ticket: any) {
  if (!ticket || typeof ticket !== 'object') return ticket;

  if (Array.isArray(ticket.images)) {
    ticket.images = await Promise.all(ticket.images.map((url: any) => signStorageUrl(url)));
  }
  if (Array.isArray(ticket.documents)) {
    ticket.documents = await Promise.all(ticket.documents.map((url: any) => signStorageUrl(url)));
  }
  if (Array.isArray(ticket.screenshots)) {
    ticket.screenshots = await Promise.all(
      ticket.screenshots.map((url: any) => signStorageUrl(url)),
    );
  }
  if (Array.isArray(ticket.screenRecordings)) {
    ticket.screenRecordings = await Promise.all(
      ticket.screenRecordings.map((url: any) => signStorageUrl(url)),
    );
  }

  // Also replies can have attachments (if applicable)
  if (Array.isArray(ticket.replies)) {
    for (const r of ticket.replies) {
      if (Array.isArray(r.attachments)) {
        r.attachments = await Promise.all(r.attachments.map((url: any) => signStorageUrl(url)));
      }
    }
  }

  return ticket;
}

export function cleanSupportTicketBeforeSave(ticket: any) {
  if (!ticket || typeof ticket !== 'object') return ticket;

  if (Array.isArray(ticket.images)) {
    ticket.images = ticket.images.map((url: any) => cleanStorageUrl(url));
  }
  if (Array.isArray(ticket.documents)) {
    ticket.documents = ticket.documents.map((url: any) => cleanStorageUrl(url));
  }
  if (Array.isArray(ticket.screenshots)) {
    ticket.screenshots = ticket.screenshots.map((url: any) => cleanStorageUrl(url));
  }
  if (Array.isArray(ticket.screenRecordings)) {
    ticket.screenRecordings = ticket.screenRecordings.map((url: any) => cleanStorageUrl(url));
  }

  return ticket;
}

export async function enrichHostProfileWithSignedUrls(hostOrProfile: any) {
  if (!hostOrProfile || typeof hostOrProfile !== 'object') return hostOrProfile;

  const fieldsToSign = [
    'profileImage',
    'coverImage',
    'avatar',
    'photoURL',
    'cover',
    'coverURL',
    'backdropURL',
  ];

  for (const key of fieldsToSign) {
    if (hostOrProfile[key]) {
      hostOrProfile[key] = await signStorageUrl(hostOrProfile[key]);
    }
  }

  if (Array.isArray(hostOrProfile.photos)) {
    hostOrProfile.photos = await Promise.all(
      hostOrProfile.photos.map((url: any) => signStorageUrl(url)),
    );
  }

  return hostOrProfile;
}

export function cleanHostProfilePatch(patch: any) {
  if (!patch || typeof patch !== 'object') return patch;

  const fieldsToClean = [
    'profileImage',
    'coverImage',
    'avatar',
    'photoURL',
    'cover',
    'coverURL',
    'backdropURL',
  ];

  for (const key of fieldsToClean) {
    if (patch[key] !== undefined) {
      patch[key] = cleanStorageUrl(patch[key]);
    }
  }

  if (Array.isArray(patch.photos)) {
    patch.photos = patch.photos.map((url: any) => cleanStorageUrl(url));
  }

  return patch;
}

export async function enrichPromoterProfileWithSignedUrls(promoterOrProfile: any) {
  if (!promoterOrProfile || typeof promoterOrProfile !== 'object') return promoterOrProfile;

  const fieldsToSign = [
    'profileImage',
    'avatarUrl',
    'photoURL',
    'coverImage',
    'coverURL',
    'backdropURL',
  ];

  for (const key of fieldsToSign) {
    if (promoterOrProfile[key]) {
      promoterOrProfile[key] = await signStorageUrl(promoterOrProfile[key]);
    }
  }

  return promoterOrProfile;
}

export function cleanPromoterProfilePatch(patch: any) {
  if (!patch || typeof patch !== 'object') return patch;

  const fieldsToClean = [
    'profileImage',
    'avatarUrl',
    'photoURL',
    'coverImage',
    'coverURL',
    'backdropURL',
  ];

  for (const key of fieldsToClean) {
    if (patch[key] !== undefined) {
      patch[key] = cleanStorageUrl(patch[key]);
    }
  }

  return patch;
}
