export function buildTonightEventUrl(venueId: string) {
  const query = new URLSearchParams({
    venueId,
    date: 'today',
    limit: '1',
  });
  return `/api/partners/venues/events?${query.toString()}`;
}

export function calculateTableCapacity(tables: Array<{ capacity?: unknown }>) {
  return tables.reduce((total, table) => total + Number(table.capacity || 0), 0);
}
