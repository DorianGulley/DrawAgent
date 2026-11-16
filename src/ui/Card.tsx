import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius as radii, selectedRing, shadow } from "../theme";
import { Squish } from "./Squish";

interface Props {
  children: ReactNode;
  tone?: "slab" | "well";
  radius?: keyof typeof radii;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, tone = "slab", radius = "lg", selected, onPress, onLongPress, testID, accessibilityLabel, style }: Props) {
  const surface = [styles.base, { borderRadius: radii[radius] }, tone === "slab" ? styles.slab : styles.well, style];
  const ring = selected ? <View pointerEvents="none" style={[styles.ring, { borderRadius: radii[radius] + 4 }]} /> : null;
  if (!onPress && !onLongPress) {
    return (
      <View testID={testID} style={surface}>
        {children}
        {ring}
      </View>
    );
  }
  return (
    <Squish
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: Boolean(selected) }}
      depth="card"
      haptic="press"
      onPress={onPress}
      onLongPress={onLongPress}
      style={surface}
    >
      {children}
      {ring}
    </Squish>
  );
}

const styles = StyleSheet.create({
  base: { borderCurve: "continuous" },
  slab: { backgroundColor: colors.surface, ...shadow.slab },
  well: { backgroundColor: colors.well, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  ring: { position: "absolute", top: -4, left: -4, right: -4, bottom: -4, ...selectedRing },
});
