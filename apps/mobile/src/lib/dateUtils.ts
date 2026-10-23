// apps/mobile/src/lib/dateUtils.ts
import { format, parseISO, isValid } from 'date-fns';

export const formatDate = (date: string | Date | null, formatStr = 'MMM dd, yyyy'): string => {
  if (!date) return 'N/A';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return isValid(parsed) ? format(parsed, formatStr) : 'Invalid date';
};

export const daysUntil = (expiryDate: string | Date | null): number => {
  if (!expiryDate) return Infinity;
  const expiry = typeof expiryDate === 'string' ? parseISO(expiryDate) : expiryDate;
  if (!isValid(expiry)) return Infinity;
  const diff = expiry.getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export const isNearExpiry = (days: number): boolean => days <= 7 && days >= 0;
export const isExpired = (days: number): boolean => days < 0;