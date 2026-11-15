export const colors = {
  canvas: "#F5F3EE",
  surface: "#FFFFFF",
  ink: "#16151A",
  inkSoft: "#57545E",
  muted: "#9A968F",
  line: "rgba(22,21,26,0.08)",
  accent: "#635BFF",
  accentSoft: "#EEEDFF",
  success: "#1F9D63",
  danger: "#D9432F",
};

export const fonts = {
  display: "InstrumentSerif_400Regular",
  displayItalic: "InstrumentSerif_400Regular_Italic",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};

export function timeAgo(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
