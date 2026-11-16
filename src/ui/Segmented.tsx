import { useState } from "react";
import { LayoutChangeEvent, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { colors, fonts, motion, radius } from "../theme";
import { feel } from "./feel";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  color?: string;
}

interface Props<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Segmented<T extends string>({ options, value, onChange, testID, style }: Props<T>) {
  const [frames, setFrames] = useState<Record<string, { x: number; width: number }>>({});
  const frame = frames[value];

  const thumb = useAnimatedStyle(() =>
    frame ? { opacity: 1, left: withSpring(frame.x, motion.settle), width: withSpring(frame.width, motion.settle) } : { opacity: 0 },
  );

  const measure = (option: T) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setFrames((current) => (current[option]?.x === x && current[option]?.width === width ? current : { ...current, [option]: { x, width } }));
  };

  return (
    <View testID={testID} accessibilityRole="tablist" style={[styles.track, style]}>
      <Animated.View pointerEvents="none" style={[styles.thumb, thumb]} />
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onLayout={measure(option.value)}
            onPress={() => {
              if (on) return;
              feel.tick();
              onChange(option.value);
            }}
            style={styles.segment}
          >
            {option.color && <View style={[styles.dot, { backgroundColor: option.color }]} />}
            <Text numberOfLines={1} style={[styles.label, on && styles.labelOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", backgroundColor: colors.well, borderRadius: 14, padding: 3, borderCurve: "continuous" },
  thumb: {
    position: "absolute",
    top: 3,
    bottom: 3,
    borderRadius: 11,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    shadowColor: "#3C2814",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  segment: { flex: 1, height: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: radius.sm, paddingHorizontal: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft },
  labelOn: { fontFamily: fonts.semibold, color: colors.ink },
});
