const PALETTE: Record<string, string> = {
  purple: "#7C3AED",
  violet: "#8B5CF6",
  lavender: "#A78BFA",
  indigo: "#4F46E5",
  blue: "#2563EB",
  navy: "#1E3A8A",
  sky: "#0EA5E9",
  cyan: "#06B6D4",
  teal: "#0D9488",
  green: "#16A34A",
  emerald: "#059669",
  mint: "#10B981",
  lime: "#65A30D",
  olive: "#6B7A2A",
  yellow: "#EAB308",
  gold: "#C9A227",
  amber: "#F59E0B",
  orange: "#F97316",
  peach: "#FDBA8C",
  coral: "#FF6B5B",
  red: "#EF4444",
  crimson: "#DC143C",
  rose: "#F43F5E",
  pink: "#EC4899",
  magenta: "#D946EF",
  brown: "#92400E",
  beige: "#E8DCC4",
  cream: "#FFF8EC",
  black: "#111111",
  charcoal: "#2B2B2B",
  gray: "#6B7280",
  grey: "#6B7280",
  silver: "#C0C4CC",
  white: "#FFFFFF",
};

export const COLOR_NAMES = Object.keys(PALETTE);

export function namedColor(name: string): string | undefined {
  return PALETTE[name];
}

function toRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: number[]): string {
  return "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function normalizeHex(hex: string): string {
  return toHex(toRgb(hex));
}

export function mix(hex: string, target: string, amount: number): string {
  const a = toRgb(hex);
  const b = toRgb(target);
  return toHex(a.map((c, i) => c + (b[i] - c) * amount));
}

export const tint = (hex: string) => mix(hex, "#FFFFFF", 0.86);
export const shade = (hex: string) => mix(hex, "#000000", 0.35);

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function readableOn(background: string): string {
  return contrast(background, "#FFFFFF") >= contrast(background, "#1B1A17") ? "#FFFFFF" : "#1B1A17";
}
