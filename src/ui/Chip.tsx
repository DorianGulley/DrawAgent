import { SymbolView } from "../symbols";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, fonts, radius } from "../theme";
import { Symbol } from "./Button";
import { Kneading } from "./Kneading";
import { Squish } from "./Squish";

export type ChipTone = "neutral" | "accent" | "success" | "warning" | "danger";

const TONES: Record<ChipTone, { background: string; text: string }> = {
  neutral: { background: colors.well, text: colors.inkSoft },
  accent: { background: colors.accentSoft, text: colors.accent },
  success: { background: colors.successSoft, text: colors.success },
  warning: { background: colors.warningSoft, text: "#8A5E0E" },
  danger: { background: colors.dangerSoft, text: colors.danger },
};

interface Props {
  label: string;
  tone?: ChipTone;
  icon?: Symbol;
  dot?: string;
  working?: boolean;
  selected?: boolean;
  trailingIcon?: Symbol;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, tone = "neutral", icon, dot, working, selected, trailingIcon, onPress, testID, style }: Props) {
  const fill = selected ? { background: colors.ink, text: colors.onInk } : TONES[tone];
  const content = (
    <>
      {working ? <Kneading size={9} color={fill.text} /> : dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      {icon && <SymbolView name={icon} size={12} tintColor={fill.text} weight="semibold" />}
      <Text numberOfLines={1} style={[styles.label, { color: fill.text }]}>{label}</Text>
      {trailingIcon && <SymbolView name={trailingIcon} size={10} tintColor={fill.text} weight="bold" />}
    </>
  );
  const chipStyle = [styles.chip, { backgroundColor: fill.background }, style];
  if (!onPress) return <View testID={testID} style={chipStyle}>{content}</View>;
  return (
    <Squish testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: Boolean(selected) }} hitSlop={6} onPress={onPress} style={chipStyle}>
      {content}
    </Squish>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 28, paddingHorizontal: 11, borderRadius: radius.pill, alignSelf: "flex-start" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontFamily: fonts.semibold, fontSize: 13 },
});
