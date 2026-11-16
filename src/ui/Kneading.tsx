import { useEffect } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { colors, motion } from "../theme";

interface Props {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function Kneading({ size = 14, color = colors.warning, style }: Props) {
  const reduceMotion = useReducedMotion();
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.set(withRepeat(withTiming(1, { duration: motion.knead.duration, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(phase);
  }, [phase]);

  const animated = useAnimatedStyle(() => {
    const turn = phase.value * Math.PI * 2;
    if (reduceMotion) return { opacity: 0.55 + 0.45 * Math.cos(turn) };
    return {
      transform: [
        { rotate: `${phase.value * 120}deg` },
        { scaleX: 1 + 0.18 * Math.sin(turn * 2) },
        { scaleY: 1 - 0.16 * Math.sin(turn * 2) },
      ],
    };
  });

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Working"
      style={[
        {
          width: size,
          height: size,
          backgroundColor: color,
          borderTopLeftRadius: size * 0.5,
          borderTopRightRadius: size * 0.45,
          borderBottomRightRadius: size * 0.55,
          borderBottomLeftRadius: size * 0.5,
        },
        animated,
        style,
      ]}
    />
  );
}
