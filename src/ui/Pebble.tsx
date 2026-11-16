import { ReactNode } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Glaze, glazes } from "../theme";

interface Props {
  emoji?: string;
  glaze?: Glaze;
  size?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Pebble({ emoji, glaze = "ash", size = 46, children, style }: Props) {
  return (
    <View style={[styles.pebble, { width: size, height: size, borderRadius: size * 0.33, backgroundColor: glazes[glaze] }, style]}>
      {emoji ? <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  pebble: { alignItems: "center", justifyContent: "center", borderCurve: "continuous", overflow: "hidden" },
});
