import { Platform, ViewStyle } from "react-native";

export const colors = {
  canvas: "#F3EEE6",
  surface: "#FFFDF9",
  well: "#E9E2D7",
  ink: "#1E1A16",
  inkSoft: "#5B534B",
  muted: "#9A9086",
  line: "rgba(30,26,22,0.09)",
  accent: "#C65A35",
  accentSoft: "#F5E2D7",
  onAccent: "#FFF8F2",
  onInk: "#FFF8F2",
  success: "#3E8E6C",
  successSoft: "#DCEDE4",
  warning: "#C98A1E",
  warningSoft: "#F6E9CC",
  danger: "#C2412F",
  dangerSoft: "#F5DAD4",
  scrim: "rgba(30,22,14,0.32)",
};

export const night = {
  bg: "#15120F",
  surface: "#221D18",
  ink: "#F6EFE6",
  muted: "#8C8277",
  line: "rgba(246,239,230,0.12)",
};

export const glazes = {
  celadon: "#DCE8DF",
  cobalt: "#DCE2F4",
  ochre: "#F3E4C6",
  rose: "#F2DCD5",
  ash: "#E5E0D9",
  lilac: "#E6DFEE",
};

export type Glaze = keyof typeof glazes;

export const marks = {
  change: "#3457D5",
  broken: "#E0483A",
  keep: "#2E9A72",
};

export const fonts = {
  display: "InstrumentSerif_400Regular",
  displayItalic: "InstrumentSerif_400Regular_Italic",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  mono: Platform.select({ ios: "Menlo", default: "monospace" }),
};

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 44, lineHeight: 46, letterSpacing: -0.6, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.3, color: colors.ink },
  heading: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.ink },
  label: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.ink },
  callout: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: colors.inkSoft },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.muted },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.9, textTransform: "uppercase", color: colors.muted },
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, gutter: 20 } as const;

export const radius = { xs: 8, sm: 12, md: 18, lg: 24, xl: 32, pill: 999 } as const;

export const shadow = {
  slab: { shadowColor: "#3C2814", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  pebble: { shadowColor: "#28190A", shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  sheet: { shadowColor: "#28190A", shadowOpacity: 0.16, shadowRadius: 30, shadowOffset: { width: 0, height: -8 } },
} satisfies Record<string, ViewStyle>;

export const selectedRing: ViewStyle = { borderWidth: 2, borderColor: colors.accent };

export const motion = {
  squash: { scaleX: 1.02, scaleY: 0.95, duration: 70 },
  settle: { damping: 14, stiffness: 260, mass: 0.7 },
  sheet: { damping: 22, stiffness: 220, mass: 1 },
  rise: { distance: 12, duration: 420, stagger: 60, damping: 20, stiffness: 180 },
  knead: { duration: 1600 },
} as const;

export function timeAgo(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
