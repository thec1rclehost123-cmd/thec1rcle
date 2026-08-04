export function formatInr(value: number, freeLabel = true): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return freeLabel ? 'Free' : '₹0.00';
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPaiseInr(paise: number, freeLabel = true): string {
  return formatInr(Number(paise) / 100, freeLabel);
}
