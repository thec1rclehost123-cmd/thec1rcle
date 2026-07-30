import { z } from 'zod';

const MenuItemSchema = z
  .object({
    id: z.string().min(1).max(120),
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000),
    pricePaise: z.number().int().min(0).max(100_000_000),
    imageUrl: z.union([z.string().url(), z.literal('')]),
    dietaryTags: z.array(z.string().trim().min(1).max(40)).max(20),
    available: z.boolean(),
    displayOrder: z.number().int().min(0).max(10_000),
    variants: z
      .array(
        z
          .object({
            id: z.string().min(1).max(120),
            name: z.string().trim().min(1).max(120),
            pricePaise: z.number().int().min(0).max(100_000_000),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();

const MenuSectionSchema = z
  .object({
    id: z.string().min(1).max(120),
    name: z.string().trim().min(1).max(120),
    displayOrder: z.number().int().min(0).max(10_000),
    active: z.boolean(),
    items: z.array(MenuItemSchema).max(300),
  })
  .strict();

export const VenueMenuSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase()),
    published: z.boolean(),
    sections: z.array(MenuSectionSchema).max(50),
  })
  .strict();

export const EMPTY_VENUE_MENU = Object.freeze({
  name: 'Food & Drinks Menu',
  description: '',
  currency: 'INR',
  published: false,
  sections: [],
});

function normalizeOrder(menu) {
  return {
    ...menu,
    sections: menu.sections.map((section, sectionIndex) => ({
      ...section,
      displayOrder: sectionIndex,
      items: section.items.map((item, itemIndex) => ({
        ...item,
        displayOrder: itemIndex,
      })),
    })),
  };
}

export async function getVenueMenu(db, venueId) {
  const doc = await db.collection('venue_menu').doc(String(venueId)).get();
  if (!doc.exists) return { ...EMPTY_VENUE_MENU };
  const data = doc.data() || {};
  const parsed = VenueMenuSchema.safeParse({
    name: data.name ?? EMPTY_VENUE_MENU.name,
    description: data.description ?? '',
    currency: data.currency ?? 'INR',
    published: data.published === true,
    sections: Array.isArray(data.sections) ? data.sections : [],
  });
  return parsed.success ? normalizeOrder(parsed.data) : { ...EMPTY_VENUE_MENU };
}

export async function saveVenueMenu(db, venueId, input, actorId) {
  const menu = normalizeOrder(VenueMenuSchema.parse(input));
  const updatedAt = new Date().toISOString();
  const record = {
    ...menu,
    id: String(venueId),
    venueId: String(venueId),
    updatedAt,
    updatedBy: String(actorId || ''),
    ...(menu.published ? { publishedAt: updatedAt } : {}),
  };
  await db.collection('venue_menu').doc(String(venueId)).set(record, { merge: true });
  await db.collection('venues').doc(String(venueId)).set(
    {
      menuPublished: menu.published,
      menuUpdatedAt: updatedAt,
      updatedAt,
    },
    { merge: true },
  );
  return record;
}
