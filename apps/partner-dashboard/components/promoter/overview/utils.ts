export function formatINR(amount?: number) {
  return `₹${(amount || 0).toLocaleString('en-IN')}`;
}

export function formatCompactINR(amount?: number) {
  const value = amount || 0;
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toLocaleString('en-IN')}`;
}

export function formatDateTime(date?: string) {
  if (!date) return 'Unknown';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatEventDate(date?: string | null) {
  if (!date) return 'Date TBA';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Date TBA';
  return parsed.toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getInitials(name?: string) {
  if (!name) return 'GU';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export function getOrderStatusTone(status?: string) {
  const key = String(status || '').toLowerCase();
  if (key === 'cancelled') {
    return {
      label: 'Cancelled',
      color: '#f87171',
      background: 'rgba(248,113,113,0.12)',
      border: 'rgba(248,113,113,0.18)',
    };
  }
  return {
    label: 'Ticket',
    color: '#8ab4ff',
    background: 'rgba(90,141,238,0.12)',
    border: 'rgba(90,141,238,0.18)',
  };
}
