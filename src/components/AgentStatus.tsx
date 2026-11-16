import { SymbolView } from "../symbols";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useEffect } from "react";
import { colors, fonts } from "../theme";

export type FeedbackStatus = "pending" | "claimed" | "working" | "published" | "failed";

const STEPS: { status: FeedbackStatus; label: string }[] = [
  { status: "pending", label: "Sent" },
  { status: "claimed", label: "Picked up" },
  { status: "working", label: "Editing" },
  { status: "published", label: "Published" },
];

function Pulse({ color }: { color: string }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(withTiming(2.2, { duration: 1100 }), -1, false);
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: 2.2 - scale.value }));
  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulse, { backgroundColor: color }, style]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

export function StatusSteps({ status }: { status: FeedbackStatus }) {
  const current = STEPS.findIndex((step) => step.status === status);
  return (
    <View style={styles.steps}>
      {STEPS.map((step, index) => {
        const reached = status !== "failed" && index <= current;
        return (
          <View key={step.status} style={styles.step}>
            <View style={[styles.bar, reached && { backgroundColor: index === current && status !== "published" ? colors.accent : colors.success }]} />
            <Text style={[styles.stepLabel, reached && { color: colors.ink }]}>{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function AgentStatus({ status, message, agent }: { status: FeedbackStatus; message?: string | null; agent: string }) {
  const failed = status === "failed";
  const waiting = status === "pending";
  const title = failed ? "Your agent couldn't finish" : waiting ? `Waiting for ${agent}` : status === "published" ? "Published" : `${agent} is on it`;
  return (
    <Animated.View testID="agent-status" entering={FadeInDown.springify().damping(18)} exiting={FadeOutDown.duration(180)} style={styles.card}>
      <View style={styles.row}>
        {failed ? <SymbolView name="exclamationmark.triangle.fill" size={16} tintColor={colors.danger} /> : <Pulse color={waiting ? "#F5A524" : colors.accent} />}
        <View style={{ flex: 1 }}>
          <Text testID="agent-status-title" style={styles.title}>{title}</Text>
          {message ? (
            <Text testID="agent-status-message" numberOfLines={2} style={[styles.message, failed && { color: colors.danger }]}>
              {message}
            </Text>
          ) : null}
        </View>
      </View>
      {!failed && <StatusSteps status={status} />}
    </Animated.View>
  );
}

export function agentLabel(agent: string): string {
  return agent === "codex" ? "Codex" : agent === "claude" ? "Claude Code" : agent;
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 14, marginBottom: 10, padding: 14, gap: 12, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.97)", shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 6 } },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  message: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  pulseWrap: { width: 16, height: 16, alignItems: "center", justifyContent: "center" },
  pulse: { position: "absolute", width: 10, height: 10, borderRadius: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  steps: { flexDirection: "row", gap: 6 },
  step: { flex: 1, gap: 6 },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.line },
  stepLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
});
