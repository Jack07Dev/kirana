/** Kirana visual system — fresh market green + warm saffron */
export const colors = {
  primary: '#0B6E4F',
  primaryDark: '#085640',
  primarySoft: '#E6F4EF',
  accent: '#E85D04',
  accentSoft: '#FFF0E6',
  bg: '#F5F7F6',
  surface: '#FFFFFF',
  text: '#1A2421',
  textSecondary: '#5A6B64',
  textMuted: '#8A9A93',
  border: '#D8E2DD',
  success: '#1B9C6E',
  warning: '#D97706',
  danger: '#C0392B',
  dangerSoft: '#FDECEA',
  online: '#1B9C6E',
  offline: '#9CA3AF',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(26,36,33,0.45)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const typography = {
  brand: {
    fontSize: 32,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  h1: { fontSize: 26, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyBold: { fontSize: 16, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  button: { fontSize: 17, fontWeight: '700' as const },
  largeButton: { fontSize: 18, fontWeight: '700' as const },
};

/** Large touch targets for shopkeepers */
export const touch = {
  minHeight: 56,
  iconSize: 28,
};
