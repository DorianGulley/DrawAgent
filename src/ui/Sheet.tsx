import { ReactNode, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { colors, motion, radius, shadow, space, type } from "../theme";
import { IconButton } from "./Button";

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  testID?: string;
}

export function Sheet({ visible, onClose, title, children, testID }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const offset = useSharedValue(height);
  const scrim = useSharedValue(0);

  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      offset.set(withSpring(0, motion.sheet));
      scrim.set(withTiming(1, { duration: 220 }));
      return;
    }
    scrim.set(withTiming(0, { duration: 180 }));
    offset.set(
      withTiming(height, { duration: 220, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) scheduleOnRN(setMounted, false);
      }),
    );
  }, [visible, height, offset, scrim]);

  const drag = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => offset.set(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 120 || gesture.vy > 1) onClose();
          else offset.set(withSpring(0, motion.sheet));
        },
      }),
    [offset, onClose],
  );

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.anchor} pointerEvents="box-none">
        <Animated.View testID={testID} style={[styles.sheet, { paddingBottom: insets.bottom + space[4], maxHeight: height - insets.top - space[3] }, sheetStyle]}>
          <View {...drag.panHandlers} style={styles.handleArea}>
            <View style={styles.grabber} />
            {title && (
              <View style={styles.header}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                <IconButton icon="xmark" accessibilityLabel="Close" tone="well" size="sm" onPress={onClose} />
              </View>
            )}
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.scrim },
  anchor: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderCurve: "continuous",
    paddingHorizontal: space.gutter,
    ...shadow.sheet,
  },
  handleArea: { paddingTop: space[2], paddingBottom: space[3] },
  grabber: { alignSelf: "center", width: 38, height: 5, borderRadius: 3, backgroundColor: "rgba(30,26,22,0.14)", marginBottom: space[3] },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] },
  title: { ...type.heading, flex: 1 },
});
