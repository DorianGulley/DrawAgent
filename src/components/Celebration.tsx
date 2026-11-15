import { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

const COLORS = ["#7C5CFF", "#FF7A59", "#1FB57A", "#F5A524", "#3B82F6", "#EC4899"];

function Piece({ index, width }: { index: number; width: number }) {
  const progress = useSharedValue(0);
  const startX = width / 2 + (Math.random() - 0.5) * 60;
  const dx = (Math.random() - 0.5) * width * 1.1;
  const rise = 260 + Math.random() * 260;
  const spin = (Math.random() - 0.5) * 720;
  useEffect(() => {
    progress.value = withDelay(index * 6, withTiming(1, { duration: 1500 + Math.random() * 500, easing: Easing.out(Easing.quad) }));
  }, []);
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: t < 0.8 ? 1 : (1 - t) * 5,
      transform: [{ translateX: startX + dx * t }, { translateY: -rise * t + 520 * t * t }, { rotate: `${spin * t}deg` }],
    };
  });
  return <Animated.View style={[styles.piece, { backgroundColor: COLORS[index % COLORS.length], width: index % 3 === 0 ? 8 : 10, height: index % 3 === 0 ? 14 : 8 }, style]} />;
}

export function Celebration() {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top: height * 0.55 }]}>
      {Array.from({ length: 42 }, (_, index) => (
        <Piece key={index} index={index} width={width} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: "absolute", left: 0, top: 0, borderRadius: 2 },
});
