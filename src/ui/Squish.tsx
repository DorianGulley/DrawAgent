import { GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { motion } from "../theme";
import { Feel, feel } from "./feel";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface SquishProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  haptic?: Feel | null;
  depth?: "button" | "card";
}

export function Squish({ style, haptic = "tap", depth = "button", disabled, onPressIn, onPressOut, onPress, ...rest }: SquishProps) {
  const reduceMotion = useReducedMotion();
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const dim = useSharedValue(1);
  const squash = depth === "card" ? { x: 1.008, y: 0.975 } : { x: motion.squash.scaleX, y: motion.squash.scaleY };
  const faded = disabled ? 0.4 : 1;

  const animated = useAnimatedStyle(() => ({
    opacity: dim.value * faded,
    transform: [{ scaleX: scaleX.value }, { scaleY: scaleY.value }],
  }));

  const pressIn = (event: GestureResponderEvent) => {
    if (reduceMotion) dim.set(withTiming(0.7, { duration: motion.squash.duration }));
    else {
      scaleX.set(withTiming(squash.x, { duration: motion.squash.duration }));
      scaleY.set(withTiming(squash.y, { duration: motion.squash.duration }));
    }
    onPressIn?.(event);
  };

  const pressOut = (event: GestureResponderEvent) => {
    scaleX.set(withSpring(1, motion.settle));
    scaleY.set(withSpring(1, motion.settle));
    dim.set(withTiming(1, { duration: 120 }));
    onPressOut?.(event);
  };

  const press = (event: GestureResponderEvent) => {
    if (haptic) feel[haptic]();
    onPress?.(event);
  };

  return <AnimatedPressable {...rest} disabled={disabled} onPressIn={pressIn} onPressOut={pressOut} onPress={press} style={[style, animated]} />;
}
