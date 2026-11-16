import { SymbolView } from "../symbols";
import { useState } from "react";
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { contrast, readableOn } from "../../shared/colors";
import { KindSpec } from "../../shared/kinds";
import { AppDoc, AppNode, BOXED_TYPES, CONTAINER_TYPES, StyleProp, TEXT_TYPES, TYPE_LABELS, describeSelection, effectiveStyle, findNode } from "../../shared/model";
import { Operation } from "../../shared/operations";
import { Profile } from "../../shared/style";
import { EVERYTHING_SUGGESTIONS, suggestionsFor } from "../suggestions";
import { colors, fonts } from "../theme";

export type Scope = "one" | "like" | "all";

const SWATCHES = ["#FFFFFF", "#111111", "#635BFF", "#16A34A", "#F97316", "#EF4444", "#0EA5E9", "#EC4899", "#FFE7D6", "#E8F1FF", "#EAF7EF", "#F3EEFF", "#FFF1C9"];

interface Props {
  doc: AppDoc;
  kind: KindSpec;
  selection: string[];
  scope: Scope;
  profile: Profile;
  error: string | null;
  canUndo: boolean;
  bottomInset: number;
  onScope: (scope: Scope) => void;
  onInstruction: (instruction: string) => void;
  onOperations: (operations: Operation[], summary: string) => void;
  onUseMyStyle: () => void;
  onUndo: () => void;
  onClose: () => void;
  onHeight: (height: number) => void;
}

function shared(nodes: AppNode[], prop: StyleProp): number | string | "Mixed" | undefined {
  const values = nodes.map((node) => effectiveStyle(node)[prop]).filter((value) => value !== undefined);
  if (values.length === 0) return undefined;
  return values.every((value) => value === values[0]) ? values[0] : "Mixed";
}

function Stepper({ label, value, onStep, testID }: { label: string; value: number | string | "Mixed" | undefined; onStep: (direction: 1 | -1) => void; testID: string }) {
  const shown = value === undefined ? "–" : value === "Mixed" ? "Mixed" : value === 999 ? "Pill" : String(value);
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepRow}>
        <Pressable testID={`${testID}-minus`} accessibilityLabel={`Less ${label.toLowerCase()}`} hitSlop={6} onPress={() => onStep(-1)} style={styles.stepButton}>
          <SymbolView name="minus" size={12} tintColor={colors.ink} weight="bold" />
        </Pressable>
        <Text testID={`${testID}-value`} style={[styles.stepValue, value === "Mixed" && { color: colors.muted }]}>{shown}</Text>
        <Pressable testID={`${testID}-plus`} accessibilityLabel={`More ${label.toLowerCase()}`} hitSlop={6} onPress={() => onStep(1)} style={styles.stepButton}>
          <SymbolView name="plus" size={12} tintColor={colors.ink} weight="bold" />
        </Pressable>
      </View>
    </View>
  );
}

export function MakeSheet(props: Props) {
  const { doc, kind, selection, scope, profile, error, canUndo, bottomInset } = props;
  const [text, setText] = useState("");
  const nodes = selection.map((id) => findNode(doc.root, id)).filter((node): node is AppNode => Boolean(node));
  const everything = scope === "all";
  const title = everything ? "Everything" : describeSelection(doc.root, selection);
  const first = nodes[0];
  const allowed = (prop: StyleProp) => kind.ops.styles.includes(prop);
  const hasProfile = Object.keys(profile).length > 0;

  const submit = (value: string) => {
    if (!value.trim()) return;
    props.onInstruction(value.trim());
    setText("");
  };

  const step = (prop: StyleProp, eligible: AppNode[], amount: number, noun: string) => (direction: 1 | -1) => {
    const current = shared(eligible, prop);
    const base = typeof current === "number" ? current : Number(effectiveStyle(eligible[0])[prop] ?? 0);
    const from = base >= 999 ? 48 : base;
    const value = Math.max(0, from + amount * direction);
    const what = nodes.length > 1 ? ` on ${title.toLowerCase()}` : "";
    props.onOperations([{ op: "setStyle", targets: eligible.map((node) => node.id), prop, value }], `${direction > 0 ? "More" : "Less"} ${noun}${what}`);
  };

  const paint = (prop: StyleProp, eligible: AppNode[], color: string) => {
    const operations: Operation[] = [{ op: "setStyle", targets: eligible.map((node) => node.id), prop, value: color }];
    if (prop === "backgroundColor") {
      const fix = eligible.filter((node) => contrast(color, String(effectiveStyle(node).color ?? "#1B1A17").slice(0, 7)) < 3).map((node) => node.id);
      if (fix.length) operations.push({ op: "setStyle", targets: fix, prop: "color", value: readableOn(color) });
    }
    const what = nodes.length > 1 ? ` on ${title.toLowerCase()}` : "";
    props.onOperations(operations, `New ${prop === "color" ? "text color" : prop === "accentColor" ? "accent" : "fill"}${what}`);
  };

  const boxed = nodes.filter((node) => BOXED_TYPES.includes(node.type) && node.type !== "progress");
  const padded = nodes.filter((node) => BOXED_TYPES.includes(node.type) || CONTAINER_TYPES.includes(node.type));
  const texty = nodes.filter((node) => TEXT_TYPES.includes(node.type));
  const filled = nodes.filter((node) => node.type !== "progress" && (BOXED_TYPES.includes(node.type) || node.type === "screen"));
  const accented = nodes.filter((node) => node.type === "progress" || node.type === "habit");
  const fillNodes = filled.length ? filled : accented;
  const fillProp: StyleProp = filled.length ? "backgroundColor" : "accentColor";
  const yours = [profile.accent, profile.surface].filter((value): value is string => typeof value === "string");
  const swatches = [...new Set([...yours, ...SWATCHES])];

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(22).stiffness(220)}
      exiting={SlideOutDown.duration(200)}
      onLayout={(event: LayoutChangeEvent) => props.onHeight(event.nativeEvent.layout.height)}
      style={[styles.sheet, { paddingBottom: bottomInset + 12 }]}
    >
      <View style={styles.grabber} />
      <View style={styles.headerRow}>
        <View style={styles.typeChip}>
          <Text testID="selection-label" style={styles.typeChipText}>{title}</Text>
        </View>
        <Text testID="selection-count" numberOfLines={1} style={styles.selectionText}>
          {everything ? "The whole design" : nodes.length > 1 ? `${nodes.length} selected` : first?.text ? `“${first.text}”` : ""}
        </Text>
        {canUndo && (
          <Pressable testID="undo-button" accessibilityLabel="Undo" hitSlop={8} onPress={props.onUndo} style={styles.iconButton}>
            <SymbolView name="arrow.uturn.backward" size={15} tintColor={colors.ink} weight="semibold" />
          </Pressable>
        )}
        <Pressable testID="sheet-close" accessibilityLabel="Close" hitSlop={8} onPress={props.onClose} style={styles.iconButton}>
          <SymbolView name="xmark" size={13} tintColor={colors.ink} weight="bold" />
        </Pressable>
      </View>

      <View style={styles.scopeRow}>
        {([["one", "Just this"], ["like", "All like it"], ["all", "Everything"]] as [Scope, string][]).map(([value, label]) => (
          <Pressable key={value} testID={`scope-${value}`} onPress={() => props.onScope(value)} style={[styles.scope, scope === value && styles.scopeOn]}>
            <Text style={[styles.scopeText, scope === value && styles.scopeTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {!everything && nodes.length > 1 && <Text style={styles.tapHint}>Tap things to add or remove them</Text>}

      {!everything && (
        <Animated.View entering={FadeIn.duration(180)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.props}>
            {boxed.length > 0 && allowed("borderRadius") && <Stepper testID="corners" label="Corners" value={shared(boxed, "borderRadius")} onStep={step("borderRadius", boxed, 6, "rounded corners")} />}
            {padded.length > 0 && allowed("padding") && <Stepper testID="padding" label="Padding" value={shared(padded, "padding")} onStep={step("padding", padded, 4, "padding")} />}
            {texty.length > 0 && allowed("fontSize") && <Stepper testID="text-size" label="Text size" value={shared(texty, "fontSize")} onStep={step("fontSize", texty, 2, "text size")} />}
            {hasProfile && (
              <Pressable testID="use-my-style" onPress={props.onUseMyStyle} style={styles.myStyle}>
                <SymbolView name="wand.and.stars" size={15} tintColor="#fff" />
                <Text style={styles.myStyleText}>Use my style</Text>
              </Pressable>
            )}
          </ScrollView>
          {fillNodes.length > 0 && allowed(fillProp) && (
            <View style={styles.swatchRow}>
              <Text style={styles.swatchLabel}>{fillProp === "accentColor" ? "Accent" : "Fill"}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatches}>
                {shared(fillNodes, fillProp) === "Mixed" && <Text style={styles.mixed}>Mixed</Text>}
                {swatches.map((color) => (
                  <Pressable key={color} testID={`swatch-${color}`} accessibilityLabel={`Color ${color}`} onPress={() => paint(fillProp, fillNodes, color)} style={[styles.swatch, { backgroundColor: color }, shared(fillNodes, fillProp) === color && styles.swatchOn]}>
                    {yours.includes(color) && <View style={styles.yoursDot} />}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </Animated.View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.suggestions}>
        {(everything ? EVERYTHING_SUGGESTIONS : suggestionsFor(first?.type ?? "card", nodes.length)).map((suggestion) => (
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
          placeholder={everything ? "Change the whole thing…" : nodes.length > 1 ? `Change all ${nodes.length}…` : `Change this ${first ? TYPE_LABELS[first.type].toLowerCase() : "thing"}…`}
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
      {error && <Text testID="sheet-error" style={styles.error}>{error}</Text>}
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
  grabber: { alignSelf: "center", width: 38, height: 5, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.12)", marginBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  typeChip: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  typeChipText: { color: "#fff", fontFamily: fonts.semibold, fontSize: 13 },
  selectionText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.inkSoft },
  iconButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  scopeRow: { flexDirection: "row", backgroundColor: colors.canvas, borderRadius: 14, padding: 3, marginTop: 12 },
  scope: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 11 },
  scopeOn: { backgroundColor: colors.surface, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  scopeText: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft },
  scopeTextOn: { fontFamily: fonts.semibold, color: colors.ink },
  tapHint: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginTop: 8, marginLeft: 4 },
  props: { gap: 8, paddingTop: 12, alignItems: "stretch" },
  stepper: { backgroundColor: colors.canvas, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
  stepLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepButton: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  stepValue: { minWidth: 40, textAlign: "center", fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  myStyle: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.ink, borderRadius: 14, paddingHorizontal: 14 },
  myStyleText: { fontFamily: fonts.semibold, fontSize: 13, color: "#fff" },
  swatchRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  swatchLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, width: 44 },
  swatches: { gap: 8, alignItems: "center" },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", alignItems: "center", justifyContent: "center" },
  swatchOn: { borderWidth: 3, borderColor: colors.accent },
  yoursDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.accent },
  mixed: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginRight: 2 },
  suggestions: { gap: 8, paddingVertical: 12 },
  suggestion: { borderRadius: 16, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: colors.surface },
  suggestionText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.canvas, borderRadius: 22, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.ink, paddingVertical: 8 },
  send: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.danger, marginTop: 10, marginHorizontal: 4 },
});
