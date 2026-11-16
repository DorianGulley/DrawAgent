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

function alphaOf(hex: string): string {
  const value = hex.replace("#", "");
  return value.length === 8 ? value.slice(6).toUpperCase() : "";
}

function toRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "").slice(0, 6);
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: number[]): string {
  return "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function normalizeHex(hex: string): string {
  return toHex(toRgb(hex)) + alphaOf(hex);
}

export function isTransparent(hex: string): boolean {
  return alphaOf(hex) === "00";
}

export function mix(hex: string, target: string, amount: number): string {
  const a = toRgb(hex);
  const b = toRgb(target);
  return toHex(a.map((c, i) => c + (b[i] - c) * amount)) + alphaOf(hex);
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

export function nearestColorName(hex: string): string {
  const [r, g, b] = toRgb(hex).map((channel) => channel / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const chroma = max - min;
  const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * light - 1));
  if (saturation < 0.12 || chroma < 0.04) {
    if (light > 0.9) return "white";
    if (light > 0.7) return "light gray";
    if (light > 0.35) return "gray";
    return light > 0.12 ? "charcoal" : "black";
  }
  let hue = 0;
  if (max === r) hue = ((g - b) / chroma) % 6;
  else if (max === g) hue = (b - r) / chroma + 2;
  else hue = (r - g) / chroma + 4;
  hue = (hue * 60 + 360) % 360;
  const names: [number, string][] = [[12, "red"], [40, "orange"], [65, "yellow"], [165, "green"], [200, "teal"], [238, "blue"], [290, "purple"], [335, "pink"], [360, "red"]];
  let name = names.find(([limit]) => hue < limit)![1];
  if ((name === "orange" || name === "yellow") && light < 0.4) name = "brown";
  if (light > 0.85) return `pale ${name}`;
  if (light > 0.7) return `light ${name}`;
  if (light < 0.28 && name !== "brown") return `dark ${name}`;
  return name;
}
