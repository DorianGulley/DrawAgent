import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { colors, fonts } from "../theme";
import { suggestionsFor } from "../suggestions";
import { Selection } from "./AppPreview";

interface Props {
  selection: Selection;
  working: boolean;
  error: string | null;
  canUndo: boolean;
  bottomInset: number;
  onSubmit: (instruction: string) => void;
  onUndo: () => void;
  onClose: () => void;
}

function WorkingState({ label }: { label: string }) {
  const steps = [`Reading the ${label.toLowerCase()}`, "Planning the edit", "Updating your app"];
  const [step, setStep] = useState(0);
  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 1100 }), -1, false);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 450);
    return () => clearInterval(timer);
  }, []);
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -220 + sweep.value * 520 }] }));
  return (
    <View testID="edit-working" style={styles.working}>
      <View style={styles.workingTrack}>
        <Animated.View style={[StyleSheet.absoluteFill, sweepStyle]}>
          <LinearGradient colors={["rgba(99,91,255,0)", "rgba(99,91,255,0.9)", "rgba(179,140,255,0.9)", "rgba(99,91,255,0)"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ width: 220, height: "100%" }} />
        </Animated.View>
      </View>
      <View style={styles.workingRow}>
        <SymbolView name="sparkles" size={16} tintColor={colors.accent} />
        <Animated.Text key={step} entering={FadeIn.duration(220)} style={styles.workingText}>
          {steps[step]}…
        </Animated.Text>
      </View>
    </View>
  );
}

export function EditSheet({ selection, working, error, canUndo, bottomInset, onSubmit, onUndo, onClose }: Props) {
  const [text, setText] = useState("");
  const submit = (value: string) => {
    if (!value.trim() || working) return;
    onSubmit(value.trim());
    setText("");
  };

  return (
    <Animated.View entering={SlideInDown.springify().damping(22).stiffness(220)} exiting={SlideOutDown.duration(200)} style={[styles.sheet, { paddingBottom: bottomInset + 12 }]}>
      <View style={styles.grabber} />
      <View style={styles.headerRow}>
        <View style={styles.typeChip}>
          <Text testID="selection-type" style={styles.typeChipText}>{selection.label}</Text>
        </View>
        <Text numberOfLines={1} style={styles.selectionText}>
          {selection.text ? `“${selection.text}”` : ""}
        </Text>
        {canUndo && (
          <Pressable testID="undo-button" accessibilityLabel="Undo" hitSlop={8} onPress={onUndo} style={styles.iconButton}>
            <SymbolView name="arrow.uturn.backward" size={15} tintColor={colors.ink} weight="semibold" />
          </Pressable>
        )}
        <Pressable accessibilityLabel="Deselect" hitSlop={8} onPress={onClose} style={styles.iconButton}>
          <SymbolView name="xmark" size={13} tintColor={colors.ink} weight="bold" />
        </Pressable>
      </View>

      {working ? (
        <WorkingState label={selection.label} />
      ) : (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.suggestions}>
            {suggestionsFor(selection.nodeType).map((suggestion) => (
              <Pressable key={suggestion} onPress={() => submit(suggestion)} style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: colors.accentSoft }]}>
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.inputRow}>
            <TextInput
              testID="instruction-input"
              value={text}
              onChangeText={setText}
              placeholder={`What should this ${selection.label.toLowerCase()} do?`}
              placeholderTextColor={colors.muted}
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={() => submit(text)}
              submitBehavior="submit"
            />
            <Pressable testID="instruction-submit" accessibilityLabel="Apply change" onPress={() => submit(text)} style={[styles.send, !text.trim() && { opacity: 0.35 }]}>
              <SymbolView name="arrow.up" size={17} tintColor="#fff" weight="bold" />
            </Pressable>
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -6 },
  },
  grabber: { alignSelf: "center", width: 38, height: 5, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.12)", marginBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  typeChip: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  typeChipText: { color: "#fff", fontFamily: fonts.semibold, fontSize: 13 },
  selectionText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.inkSoft },
  iconButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  suggestions: { gap: 8, paddingVertical: 14 },
  suggestion: { borderRadius: 16, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: colors.surface },
  suggestionText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.canvas, borderRadius: 22, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.ink, paddingVertical: 8 },
  send: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.danger, marginTop: 10, marginHorizontal: 4 },
  working: { paddingVertical: 18, gap: 14 },
  workingTrack: { height: 6, borderRadius: 3, backgroundColor: colors.accentSoft, overflow: "hidden" },
  workingRow: { flexDirection: "row", alignItems: "center", gap: 8, height: 30 },
  workingText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
});
