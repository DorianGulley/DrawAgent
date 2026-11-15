import { ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, fonts } from "../theme";
import { Squish } from "./Squish";

interface Props {
  colors: string[];
  value?: string | "Mixed";
  onChange: (color: string) => void;
  yours?: string[];
  size?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Swatches({ colors: palette, value, onChange, yours = [], size = 32, testID, style }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={style} contentContainerStyle={styles.row}>
      {value === "Mixed" && <Text style={styles.mixed}>Mixed</Text>}
      {palette.map((color) => {
        const on = value?.toLowerCase() === color.toLowerCase();
        return (
          <View key={color} style={[styles.ring, { width: size + 10, height: size + 10, borderRadius: (size + 10) / 2 }, on && styles.ringOn]}>
            <Squish
              testID={testID ? `${testID}-${color}` : undefined}
              accessibilityRole="button"
              accessibilityLabel={`Color ${color}`}
              accessibilityState={{ selected: on }}
              haptic="tick"
              onPress={() => onChange(color)}
              style={[styles.swatch, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}
            >
              {yours.includes(color) && <View style={styles.yours} />}
            </Squish>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 4, alignItems: "center", paddingVertical: 2 },
  ring: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  ringOn: { borderColor: colors.accent },
  swatch: { alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(30,26,22,0.18)" },
  yours: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.accent },
  mixed: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginRight: 4 },
});
