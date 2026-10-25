export interface ThemeColors {
  isDark: boolean;
  bgApp: string;
  bgSurface: string;
  bgElevated: string;
  bgHover: string;
  bgOverlay: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  borderSubtle: string;
  borderStrong: string;
  borderFocus: string;

  accentPrimary: string;
  accentPrimaryHover: string;
  accentPrimarySubtle: string;
  accentPrimaryText: string;

  accentLime: string;
  accentLimeSubtle: string;

  success: string;
  successSubtle: string;
  successText: string;

  warning: string;
  warningSubtle: string;
  warningText: string;

  danger: string;
  dangerSubtle: string;
  dangerText: string;

  info: string;
  infoSubtle: string;

  // Bento & Tile palettes from web app
  tileExpenses: { bg: string; fg: string };
  tileTiffin: { bg: string; fg: string };
  tileChatbot: { bg: string; fg: string };
  tileSplits: { bg: string; fg: string };
}

export const darkTheme: ThemeColors = {
  isDark: true,
  bgApp: '#0b0a09',
  bgSurface: '#1d1c1a',
  bgElevated: '#262421',
  bgHover: '#2a2825',
  bgOverlay: 'rgba(0, 0, 0, 0.72)',

  textPrimary: '#f5f5f7',
  textSecondary: '#d2d2d7',
  textMuted: '#a1a1a6',
  textInverse: '#1d1d1f',

  borderSubtle: '#3a3a3c',
  borderStrong: '#545458',
  borderFocus: '#2dd4bf',

  accentPrimary: '#2dd4bf',
  accentPrimaryHover: '#5eead4',
  accentPrimarySubtle: 'rgba(45, 212, 191, 0.16)',
  accentPrimaryText: '#5eead4',

  accentLime: '#30d158',
  accentLimeSubtle: 'rgba(48, 209, 88, 0.16)',

  success: '#30d158',
  successSubtle: 'rgba(48, 209, 88, 0.16)',
  successText: '#8ee99f',

  warning: '#ffd60a',
  warningSubtle: 'rgba(255, 214, 10, 0.16)',
  warningText: '#ffe680',

  danger: '#ff453a',
  dangerSubtle: 'rgba(255, 69, 58, 0.16)',
  dangerText: '#ff8a80',

  info: '#38bdf8',
  infoSubtle: 'rgba(56, 189, 248, 0.16)',

  tileExpenses: { bg: 'rgba(124, 58, 237, 0.22)', fg: '#c4b5fd' },
  tileTiffin: { bg: 'rgba(217, 119, 6, 0.22)', fg: '#fde047' },
  tileChatbot: { bg: 'rgba(13, 148, 136, 0.22)', fg: '#5eead4' },
  tileSplits: { bg: 'rgba(37, 99, 235, 0.22)', fg: '#93c5fd' },
};

export const lightTheme: ThemeColors = {
  isDark: false,
  bgApp: '#f4f1ea',
  bgSurface: '#ffffff',
  bgElevated: '#faf8f3',
  bgHover: '#efede7',
  bgOverlay: 'rgba(29, 29, 31, 0.12)',

  textPrimary: '#1d1d1f',
  textSecondary: '#333333',
  textMuted: '#7a7a7a',
  textInverse: '#ffffff',

  borderSubtle: '#e0e0e0',
  borderStrong: '#d2d2d7',
  borderFocus: '#0f766e',

  accentPrimary: '#0f766e',
  accentPrimaryHover: '#0d9488',
  accentPrimarySubtle: 'rgba(15, 118, 110, 0.1)',
  accentPrimaryText: '#115e59',

  accentLime: '#30d158',
  accentLimeSubtle: 'rgba(48, 209, 88, 0.1)',

  success: '#34c759',
  successSubtle: 'rgba(52, 199, 89, 0.1)',
  successText: '#137333',

  warning: '#ff9f0a',
  warningSubtle: 'rgba(255, 159, 10, 0.12)',
  warningText: '#a05a00',

  danger: '#ff3b30',
  dangerSubtle: 'rgba(255, 59, 48, 0.1)',
  dangerText: '#b42318',

  info: '#0f766e',
  infoSubtle: 'rgba(15, 118, 110, 0.1)',

  tileExpenses: { bg: '#F3E8FF', fg: '#7C3AED' },
  tileTiffin: { bg: '#FEF9C3', fg: '#92400E' },
  tileChatbot: { bg: '#ECFCCB', fg: '#4D7C0F' },
  tileSplits: { bg: '#DBEAFE', fg: '#1D4ED8' },
};

export const GLOBS = {
  radiusSm: 10,
  radiusMd: 16,
  radiusLg: 22,
  radiusXl: 28,
  radiusFull: 9999,
};
