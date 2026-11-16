import { useEffect, useRef, useState } from "react";
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, { SharedValue, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { colors, fonts, marks as markColors, night } from "../theme";
import { feel } from "./feel";

export interface RulerStop {
  key: string;
  dayLabel?: string;
  mark?: keyof typeof markColors | null;
}

interface Props {
  stops: RulerStop[];
  index: number;
  onIndexChange: (index: number) => void;
  position?: SharedValue<number>;
  tone?: "night" | "light";
  spacing?: number;
  height?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const MINOR_PER_STOP = 3;
const BASELINE = 22;

interface TickProps {
  offset: number;
  scrollX: SharedValue<number>;
  curve: number;
  center: number;
  length: number;
  width: number;
  color: string;
  fade: number;
  dot?: string;
  label?: string;
  labelColor: string;
}

function Tick({ offset, scrollX, curve, center, length, width, color, fade, dot, label, labelColor }: TickProps) {
  const animated = useAnimatedStyle(() => {
    const distance = offset - scrollX.value;
    const angle = Math.max(-1.55, Math.min(1.55, distance / curve));
    const facing = Math.cos(angle);
    return {
      opacity: Math.pow(Math.max(facing, 0), 1.6) * fade,
      transform: [{ translateX: curve * Math.sin(angle) - distance }, { scale: 0.55 + 0.45 * facing }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.tick, { left: center + offset - 20 }, animated]}>
      {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
      <View style={{ width, height: length, borderRadius: width, backgroundColor: color }} />
      <Text numberOfLines={1} style={[styles.day, { color: labelColor }]}>{label ?? ""}</Text>
    </Animated.View>
  );
}

export function Ruler({ stops, index, onIndexChange, position, tone = "night", spacing = 46, height = 96, testID, style }: Props) {
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(index * spacing);
  const detent = useSharedValue(index);
  const reported = useRef(index);
  const dragging = useRef(false);
  const stopsRef = useRef(stops);
  const changeRef = useRef(onIndexChange);
  useEffect(() => {
    stopsRef.current = stops;
    changeRef.current = onIndexChange;
  }, [stops, onIndexChange]);
  const last = Math.max(0, stops.length - 1);
  const ink = tone === "night" ? night.ink : colors.ink;
  const muted = tone === "night" ? night.muted : colors.muted;
  const center = width / 2;
  const curve = Math.max(1, width * 0.62);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
    position?.set(event.contentOffset.x / spacing);
  });

  const passed = (next: number) => {
    reported.current = next;
    if (stopsRef.current[next]?.mark) feel.land();
    else feel.tick();
    changeRef.current(next);
  };

  useAnimatedReaction(
    () => Math.min(last, Math.max(0, Math.round(scrollX.value / spacing))),
    (next, previous) => {
      if (previous === null || next === detent.get()) return;
      detent.set(next);
      scheduleOnRN(passed, next);
    },
    [last, spacing],
  );

  useEffect(() => {
    if (!width || dragging.current || index === reported.current) return;
    reported.current = index;
    scrollRef.current?.scrollTo({ x: index * spacing, animated: true });
  }, [index, width, spacing]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next === width) return;
    setWidth(next);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: reported.current * spacing, animated: false }));
  };

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    dragging.current = false;
    const settled = Math.min(last, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / spacing)));
    if (settled !== reported.current) passed(settled);
  };

  const ticks: TickProps[] = [];
  if (width) {
    stops.forEach((stop, i) => {
      const newDay = Boolean(stop.dayLabel) && (i === 0 || stops[i - 1].dayLabel !== stop.dayLabel);
      ticks.push({
        offset: i * spacing,
        scrollX,
        curve,
        center,
        length: newDay ? 40 : 28,
        width: 2.4,
        color: ink,
        fade: 1,
        dot: stop.mark ? markColors[stop.mark] : undefined,
        label: newDay ? stop.dayLabel : undefined,
        labelColor: muted,
      });
      if (i === last) return;
      for (let minor = 1; minor <= MINOR_PER_STOP; minor++) {
        ticks.push({ offset: i * spacing + (minor * spacing) / (MINOR_PER_STOP + 1), scrollX, curve, center, length: 12, width: 1.3, color: ink, fade: 0.45, labelColor: muted });
      }
    });
  }

  return (
    <View
      testID={testID}
      onLayout={onLayout}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Versions"
      accessibilityValue={{ text: `Version ${index + 1} of ${stops.length}` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        const next = Math.min(last, Math.max(0, index + (event.nativeEvent.actionName === "increment" ? 1 : -1)));
        if (next !== index) onIndexChange(next);
      }}
      style={[{ height }, style]}
    >
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={spacing}
        decelerationRate="normal"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          dragging.current = true;
        }}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(event) => {
          if (Math.abs(event.nativeEvent.velocity?.x ?? 0) < 0.05) settle(event);
        }}
        contentContainerStyle={{ width: width + last * spacing, height }}
      >
        {ticks.map((tick) => (
          <Tick key={tick.offset} {...tick} />
        ))}
      </Animated.ScrollView>
      <View pointerEvents="none" style={[styles.needle, { left: center - 1.5, height: height - BASELINE + 4 }]}>
        <View style={styles.needleHead} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tick: { position: "absolute", bottom: 0, width: 40, alignItems: "center", justifyContent: "flex-end", transformOrigin: "50% 80%" },
  dot: { width: 7, height: 7, borderRadius: 4, marginBottom: 6 },
  day: { height: BASELINE, paddingTop: 5, fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.3 },
  needle: { position: "absolute", top: 0, width: 3, borderRadius: 2, backgroundColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, zIndex: -1 },
  needleHead: { position: "absolute", top: -5, left: -4.5, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
});
