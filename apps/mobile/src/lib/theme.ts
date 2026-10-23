// apps/mobile/src/lib/theme.ts
import type { TextStyle } from 'react-native';

export const colors = {
  primary: '#0066CC',
  primaryDark: '#004C99',

  success: '#28A745',
  warning: '#FF9500',
  danger: '#DC3545',

  background: '#F8F9FA',
  surface: '#FFFFFF',

  textPrimary: '#212529',
  textSecondary: '#6C757D',
  /** Alias used by some screens */
  text: '#212529',

  border: '#DEE2E6',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const typography: Record<
  'title' | 'subtitle' | 'label' | 'body' | 'small',
  TextStyle
> = {
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textPrimary,
  },
  small: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
  },
};