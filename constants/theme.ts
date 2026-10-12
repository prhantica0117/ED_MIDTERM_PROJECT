import { COLORS } from '@/constants/colors';

/**
 * Shared layout tokens so alignment, spacing and rounding stay consistent
 * across every screen instead of being ad-hoc numbers.
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Single horizontal screen gutter used everywhere for aligned edges. */
export const GUTTER = SPACING.xl;

export const SHADOW = {
  card: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 2,
  },
  elevated: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

/**
 * Shared "glassmorphism" surface used by every card/panel. Translucent white
 * over the deep-navy anamorphic background — no opaque white anywhere.
 */
export const GLASS = {
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
  },
  cardStrong: {
    backgroundColor: 'rgba(5, 11, 34, 0.72)',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    color: COLORS.textPrimary,
  },
} as const;