export const colors = {
  bg: '#EEF5F1',
  card: '#FFFFFF',
  ink: '#1F2A2E',
  muted: '#6B7A76',
  mint: '#2FB58A',
  mintSoft: '#DDF3EA',
  mintDark: '#1E8A68',
  peach: '#FF9E7A',
  line: '#E3ECE8',
  sky: '#DDF0FB',
  gold: '#F2C14E',
  /** Quiet fill for tiles and small buttons inside a card. */
  tile: '#F2F7F5',
};

/** Corners: tiles 12, cards 20, sheets 28. */
export const radius = { sm: 12, md: 16, lg: 20, sheet: 28 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
/** Smallest comfortable tap size. */
export const TAP = 44;

/** Bold only for titles and names; everything else reads in a calmer weight. */
export const font = {
  page: { fontSize: 28, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.3 },
  title: { fontSize: 22, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.2 },
  h2: { fontSize: 17, fontWeight: '800' as const, color: colors.ink },
  name: { fontSize: 15, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 15, color: colors.ink, fontWeight: '500' as const },
  small: { fontSize: 13, color: colors.muted, fontWeight: '500' as const },
  tiny: { fontSize: 12, color: colors.muted, fontWeight: '600' as const },
};

/** The one card look: white, thin line, no drop shadow. */
export const cardStyle = { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line } as const;
