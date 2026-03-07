// ═══════════════════════════════════════════════════════
// DESIGN SYSTEM — "Institutional Warmth"
// Inspired by private wealth management portals.
// Cream whites, deep navy anchors, sage green accents.
// Generous space. Confident typography. Zero clutter.
// ═══════════════════════════════════════════════════════

export const DISPLAY = `'Fraunces', 'Georgia', serif`;
export const BODY = `'Plus Jakarta Sans', -apple-system, sans-serif`;
export const MONO = `'IBM Plex Mono', monospace`;

export const C = {
  // Backgrounds
  pageBg: '#F8F7F4',
  cardBg: '#FFFFFF',
  cardBgWarm: '#FDFCF9',
  cardBgAccent: '#1B2E4A',
  cardBgAccentLight: '#243B5C',
  panelBg: 'rgba(255,255,255,0.7)',

  // Borders
  border: '#E5E2DC',
  borderLight: '#EDEAE4',
  borderFocus: '#8BADC9',

  // Text
  navy: '#1B2E4A',
  navyLight: '#2D4A6F',
  text: '#2C2A26',
  textSecondary: '#6B6760',
  textTertiary: '#9C9890',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: 'rgba(255,255,255,0.7)',
  textOnDarkDim: 'rgba(255,255,255,0.45)',

  // Accents
  sage: '#5B8A72',
  sageLight: '#EDF5F0',
  sageDark: '#4A7360',
  gold: '#C49A3C',
  goldLight: '#FBF5E8',
  goldMuted: 'rgba(196, 154, 60, 0.12)',
  sky: '#6AADCF',
  skyLight: '#EDF6FA',
  coral: '#D4725C',
  coralLight: '#FDF0EC',
  coralMuted: 'rgba(212, 114, 92, 0.12)',
} as const;
