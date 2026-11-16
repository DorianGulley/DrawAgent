import { SymbolView, SymbolViewProps } from "../symbols";
import { StyleProp, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, fonts, night, radius, shadow } from "../theme";
import { Feel } from "./feel";
import { Kneading } from "./Kneading";
import { Squish } from "./Squish";

export type Symbol = SymbolViewProps["name"];
export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "night";

const FILL: Record<ButtonVariant, { background: string; text: string; shadow?: ViewStyle }> = {
  primary: { background: colors.ink, text: colors.onInk, shadow: shadow.pebble },
  accent: { background: colors.accent, text: colors.onAccent, shadow: { ...shadow.pebble, shadowColor: colors.accent, shadowOpacity: 0.35 } },
  secondary: { background: colors.surface, text: colors.ink, shadow: shadow.slab },
  ghost: { background: "transparent", text: colors.inkSoft },
  danger: { background: colors.danger, text: "#FFFFFF" },
  night: { background: night.surface, text: night.ink },
};

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: "md" | "sm";
  icon?: Symbol;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  haptic?: Feel | null;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = "primary", size = "md", icon, loading, disabled, block, haptic, testID, accessibilityLabel, style }: ButtonProps) {
  const fill = FILL[variant];
  const small = size === "sm";
  return (
    <Squish
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(loading) }}
      haptic={haptic ?? (variant === "accent" || variant === "danger" ? "commit" : "tap")}
      disabled={disabled || loading}
      onPress={onPress}
      style={[styles.base, small && styles.small, { backgroundColor: fill.background }, fill.shadow, block && styles.block, style]}
    >
      {loading ? <Kneading size={small ? 12 : 16} color={fill.text} /> : icon ? <SymbolView name={icon} size={small ? 13 : 15} tintColor={fill.text} weight="semibold" /> : null}
      <Text numberOfLines={1} style={[styles.label, small && styles.labelSmall, { color: fill.text }]}>{label}</Text>
    </Squish>
  );
}

interface IconButtonProps {
  icon: Symbol;
  accessibilityLabel: string;
  onPress?: () => void;
  tone?: "surface" | "well" | "ink" | "accent" | "night";
  size?: "md" | "sm";
  disabled?: boolean;
  haptic?: Feel | null;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const ICON_TONE: Record<NonNullable<IconButtonProps["tone"]>, { background: string; tint: string; shadow?: ViewStyle }> = {
  surface: { background: colors.surface, tint: colors.ink, shadow: shadow.pebble },
  well: { background: colors.well, tint: colors.inkSoft },
  ink: { background: colors.ink, tint: colors.onInk, shadow: shadow.pebble },
  accent: { background: colors.accent, tint: colors.onAccent, shadow: shadow.pebble },
  night: { background: night.surface, tint: night.ink },
};

export function IconButton({ icon, accessibilityLabel, onPress, tone = "surface", size = "md", disabled, haptic, testID, style }: IconButtonProps) {
  const fill = ICON_TONE[tone];
  const side = size === "sm" ? 34 : 40;
  return (
    <Squish
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={size === "sm" ? 8 : 4}
      haptic={haptic}
      disabled={disabled}
      onPress={onPress}
      style={[styles.icon, { width: side, height: side, borderRadius: side / 2, backgroundColor: fill.background }, fill.shadow, style]}
    >
      <SymbolView name={icon} size={size === "sm" ? 13 : 15} tintColor={fill.tint} weight="semibold" />
    </Squish>
  );
}

const styles = StyleSheet.create({
  base: { height: 50, paddingHorizontal: 22, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "flex-start" },
  small: { height: 38, paddingHorizontal: 15, gap: 6 },
  block: { alignSelf: "stretch" },
  label: { fontFamily: fonts.semibold, fontSize: 15 },
  labelSmall: { fontSize: 14 },
  icon: { alignItems: "center", justifyContent: "center" },
});
