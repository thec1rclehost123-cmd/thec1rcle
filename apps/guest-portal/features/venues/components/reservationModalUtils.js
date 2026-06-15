'use client';

import { Armchair, Crown, Sparkles, Star, Wine } from 'lucide-react';

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const TABLE_TYPE_CONFIG = {
  standard: { icon: Armchair, color: '#86868b', label: 'Standard' },
  premium: { icon: Crown, color: '#F44A22', label: 'Premium' },
  vvip: { icon: Star, color: '#FFD700', label: 'VVIP' },
  booth: { icon: Wine, color: '#8B5CF6', label: 'Booth' },
  cabana: { icon: Sparkles, color: '#06B6D4', label: 'Cabana' },
};

export function isSameDay(firstDate, secondDate) {
  if (!firstDate || !secondDate) return false;
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

export function isToday(date) {
  return isSameDay(date, new Date());
}

export function isPast(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export function formatCurrency(amount) {
  if (!amount || amount === 0) return 'Free';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}
