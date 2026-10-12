/**
 * QR Attendance — design tokens.
 *
 * Required brand palette (do not substitute):
 *  • Royal / Navy Blue  #0B3098  → primary actions, links, active state
 *  • Crimson Red        #BD1B20  → danger / destructive / errors
 *  • Pure White         #FFFFFF  → text accent (NEVER used as a screen background)
 *  • Wood / Leather Brown #3A1E14 → secondary accent (badges, icon chips, depth)
 *
 * Every screen background is a deep navy derived from the primary hue so the
 * app never shows any shade of white as its background. Cards are translucent
 * "glass" layers that let the anamorphic gradient bleed through.
 */
export const COLORS = {
  // ── Brand: Royal / Navy Blue (HSL 224°) ──────────────────────────────
  primary: '#0B3098',
  primaryDark: '#071E5E',
  primaryLight: '#2550D6',
  accent: '#4C79FF', // lifted royal blue — legible emphasis on dark
  primaryTint: 'rgba(11, 48, 152, 0.30)',

  // ── Brand: Crimson Red (HSL 358°) ────────────────────────────────────
  crimson: '#BD1B20',
  crimsonDark: '#7E1014',
  crimsonLight: '#E24B50',
  crimsonTint: 'rgba(189, 27, 32, 0.24)',

  // ── Brand: Wood / Leather Brown (HSL 16°) ────────────────────────────
  brown: '#3A1E14',
  brownLight: '#6E4536',
  brownTint: 'rgba(110, 69, 54, 0.35)',

  // ── Brand: Pure White (text / highlights only) ───────────────────────
  white: '#FFFFFF',

  // ── Surfaces: deep navy + glass (never white) ────────────────────────
  background: '#050B22',
  backgroundDeep: '#03071A',
  surface: 'rgba(255, 255, 255, 0.05)',
  card: 'rgba(255, 255, 255, 0.07)',
  cardSolid: '#0A1330',
  glassBorder: 'rgba(255, 255, 255, 0.12)',

  // ── Text ─────────────────────────────────────────────────────────────
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.66)',
  textMuted: 'rgba(255, 255, 255, 0.40)',
  textOnPrimary: '#FFFFFF',

  // ── Lines / depth ────────────────────────────────────────────────────
  border: 'rgba(255, 255, 255, 0.12)',
  borderStrong: 'rgba(255, 255, 255, 0.24)',
  shadow: '#000000',

  // ── Semantic ─────────────────────────────────────────────────────────
  info: '#4C79FF',
  success: '#2FBF71',
  warning: '#F5A524',
  danger: '#BD1B20',
} as const;