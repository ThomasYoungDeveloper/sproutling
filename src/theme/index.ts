export const colors = {
  bg: '#CFEDE0',
  card: '#FFFCF5',
  ink: '#24323A',
  muted: '#6B7C80',
  mint: '#2FB58A',
  mintSoft: '#D7F2E7',
  mintDark: '#1E8A68',
  peach: '#FF9E7A',
  line: '#DCE7E2',
  sky: '#DDF0FB',
  gold: '#FFC94D',
};

export const radius = { sm: 10, md: 16, lg: 22 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const font = {
  title: { fontSize: 22, fontWeight: '800' as const, color: colors.ink },
  h2: { fontSize: 18, fontWeight: '800' as const, color: colors.ink },
  body: { fontSize: 15, color: colors.ink },
  small: { fontSize: 13, color: colors.muted, fontWeight: '600' as const },
  tiny: { fontSize: 13, color: colors.muted, fontWeight: '700' as const },
};
