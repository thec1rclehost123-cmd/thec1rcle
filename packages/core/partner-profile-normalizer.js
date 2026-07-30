const PARTNER_TYPES = new Set(['venue', 'host', 'promoter']);

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== '' && fieldValue !== undefined),
  );
}

export function normalizePartnerProfileFields(partnerType, ...sources) {
  if (!PARTNER_TYPES.has(partnerType)) {
    throw new Error(`Unsupported partner type: ${partnerType}`);
  }

  const merged = Object.assign(
    {},
    ...sources.filter((source) => source && typeof source === 'object'),
  );
  const displayName = pickString(
    merged.displayName,
    merged.brandName,
    merged.venueName,
    merged.name,
  );
  const bio = pickString(merged.bio, merged.description, merged.summary);
  const contactEmail = pickString(
    merged.contactEmail,
    merged.supportEmail,
    merged.promoterEmail,
    merged.email,
  ).toLowerCase();
  const contactPhone = pickString(
    merged.contactPhone,
    merged.legalPhone,
    merged.phone,
    merged.phoneNumber,
  );
  const handle = pickString(merged.handle, merged.username).replace(/^@+/, '').toLowerCase();
  const instagramHandle = pickString(
    merged.instagramHandle,
    merged.instagram,
    merged.socialLinks?.instagram,
  );
  const website = pickString(merged.website, merged.websiteUrl, merged.socialLinks?.website);
  const socialLinks = compactObject({
    ...(merged.socialLinks && typeof merged.socialLinks === 'object' ? merged.socialLinks : {}),
    instagram: instagramHandle,
    website,
  });

  return compactObject({
    name: displayName,
    displayName,
    ...(partnerType === 'venue' ? { venueName: displayName } : {}),
    ...(partnerType === 'promoter' ? { brandName: displayName } : {}),
    legalName: pickString(merged.legalName),
    contactPerson: pickString(merged.contactPerson, merged.contactName),
    bio,
    description: bio,
    city: pickString(merged.city),
    area: pickString(merged.area),
    website,
    contactEmail,
    contactPhone,
    handle,
    username: handle,
    instagramHandle,
    socialLinks,
    contactVisibility:
      merged.contactVisibility && typeof merged.contactVisibility === 'object'
        ? merged.contactVisibility
        : {
            email: 'connected',
            phone: 'connected',
            website: 'public',
          },
  });
}
