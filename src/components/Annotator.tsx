import * as Haptics from "expo-haptics";
import { SymbolView, SymbolViewProps } from "../symbols";
import { ComponentRef, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown, ZoomIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";
import { captureRef } from "../capture";
import { colors, fonts } from "../theme";
import { ElementInfo, Point, Probe } from "./LiveApp";

export type Tool = "pen" | "arrow" | "circle" | "text";
export type Tag = "change" | "broken" | "keep";

export interface Mark {
  kind: Tool;
  tag: Tag;
  points: Point[];
  text?: string;
  elements: ElementInfo[];
}

export const TAG_COLORS: Record<Tag, string> = { change: "#7C5CFF", broken: "#FF4D4F", keep: "#1FB57A" };
const TAG_LABELS: Record<Tag, string> = { change: "Change", broken: "Broken", keep: "Keep" };
const TOOLS: { tool: Tool; icon: SymbolViewProps["name"]; label: string }[] = [
  { tool: "pen", icon: "scribble", label: "Draw" },
  { tool: "circle", icon: "circle.dashed", label: "Circle" },
  { tool: "arrow", icon: "arrow.up.right", label: "Arrow" },
  { tool: "text", icon: "textformat", label: "Note" },
];

interface Props {
  frameUri: string;
  hitTest: (probes: Probe[]) => Promise<ElementInfo[][]>;
  onCancel: () => void;
  onSubmit: (input: { note: string; marks: Mark[]; imageUri: string; assetIds: string[] }) => Promise<void>;
  onAttachPhoto?: () => Promise<{ id: string; uri: string } | null>;
  agentName?: string;
  heading?: string;
  subject?: string;
}

function probeFor(kind: Tool, points: Point[]): Probe {
  if (kind === "circle") return { kind: "area", points };
  if (kind === "arrow") return { kind: "point", points: [points[points.length - 1]] };
  if (kind === "text") return { kind: "point", points: [points[0]] };
  const step = Math.max(1, Math.floor(points.length / 6));
  return { kind: "point", points: points.filter((_, i) => i % step === 0).slice(0, 8) };
}

function penPath(points: Point[]): string {
  if (points.length === 0) return "";
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    d += ` Q${points[i].x},${points[i].y} ${mid.x},${mid.y}`;
  }
  const last = points[points.length - 1];
  return d + ` L${last.x},${last.y}`;
}

function MarkShape({ mark, index }: { mark: Mark; index?: number }) {
  const color = TAG_COLORS[mark.tag];
  const [a, b] = [mark.points[0], mark.points[mark.points.length - 1]];
  let shape: React.ReactNode = null;
  let badge = a;
  if (mark.kind === "pen") shape = <Path d={penPath(mark.points)} stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
  if (mark.kind === "circle") {
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = Math.max(12, Math.abs(b.x - a.x) / 2);
    const ry = Math.max(12, Math.abs(b.y - a.y) / 2);
    shape = <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke={color} strokeWidth={4.5} fill={color} fillOpacity={0.08} />;
    badge = { x: cx + rx * 0.72, y: cy - ry * 0.72 };
  }
  if (mark.kind === "arrow") {
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const head = (offset: number) => `${b.x - 18 * Math.cos(angle + offset)},${b.y - 18 * Math.sin(angle + offset)}`;
    shape = (
      <G>
        <Line x1={a.x} y1={a.y} x2={b.x - 8 * Math.cos(angle)} y2={b.y - 8 * Math.sin(angle)} stroke={color} strokeWidth={5} strokeLinecap="round" />
        <Polygon points={`${b.x},${b.y} ${head(0.45)} ${head(-0.45)}`} fill={color} />
      </G>
    );
  }
  if (mark.kind === "text") {
    const label = mark.text ?? "";
    const width = Math.min(260, 24 + label.length * 7.6);
    const x = Math.max(6, a.x - 12);
    shape = (
      <G>
        <Rect x={x} y={a.y - 18} width={width} height={36} rx={18} fill={color} />
        <SvgText x={x + 12} y={a.y + 5} fill="#fff" fontSize={14} fontWeight="600">
          {label.length > 32 ? label.slice(0, 31) + "…" : label}
        </SvgText>
      </G>
    );
    badge = { x: x, y: a.y - 18 };
  }
  return (
    <G>
      {shape}
      {index !== undefined && (
        <G>
          <Circle cx={badge.x} cy={badge.y} r={11} fill="#fff" stroke={color} strokeWidth={2.5} />
          <SvgText x={badge.x} y={badge.y + 4.5} fill={color} fontSize={12} fontWeight="700" textAnchor="middle">
            {index + 1}
          </SvgText>
        </G>
      )}
    </G>
  );
}

function Flash() {
  const opacity = useSharedValue(0.85);
  useEffect(() => {
    opacity.value = withTiming(0, { duration: 420 });
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff" }, style]} />;
}

export function Annotator({ frameUri, hitTest, onCancel, onSubmit, onAttachPhoto, agentName = "your agent", heading, subject = "your app" }: Props) {
  const [photos, setPhotos] = useState<{ id: string; uri: string }[]>([]);
  const [attaching, setAttaching] = useState(false);
  const insets = useSafeAreaInsets();
  const canvas = useRef<ComponentRef<typeof View>>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [tool, setTool] = useState<Tool>("circle");
  const [tag, setTag] = useState<Tag>("change");
  const [draft, setDraft] = useState<Point[] | null>(null);
  const [textAt, setTextAt] = useState<Point | null>(null);
  const [textValue, setTextValue] = useState("");
  const [step, setStep] = useState<"draw" | "note" | "sending">("draw");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const live = useRef({ tool, tag, points: [] as Point[] });
  live.current.tool = tool;
  live.current.tag = tag;

  const addMark = async (kind: Tool, points: Point[], text?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const mark: Mark = { kind, tag: live.current.tag, points: points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })), text, elements: [] };
    setMarks((all) => [...all, mark]);
    const [elements] = await hitTest([probeFor(kind, points)]);
    setMarks((all) => all.map((m) => (m === mark ? { ...m, elements: elements ?? [] } : m)));
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const { locationX: x, locationY: y } = event.nativeEvent;
          live.current.points = [{ x, y }];
          if (live.current.tool !== "text") setDraft([{ x, y }]);
        },
        onPanResponderMove: (event) => {
          if (live.current.tool === "text") return;
          const { locationX: x, locationY: y } = event.nativeEvent;
          const points = live.current.points;
          const last = points[points.length - 1];
          if (Math.hypot(x - last.x, y - last.y) < 2) return;
          live.current.points = live.current.tool === "pen" ? [...points, { x, y }] : [points[0], { x, y }];
          setDraft(live.current.points);
        },
        onPanResponderRelease: () => {
          const { tool: kind, points } = live.current;
          setDraft(null);
          if (kind === "text") {
            setTextAt(points[0]);
            return;
          }
          const [a, b] = [points[0], points[points.length - 1]];
          const size = Math.hypot(b.x - a.x, b.y - a.y);
          if (kind === "pen" ? points.length < 3 : size < 14) return;
          void addMark(kind, points);
        },
      }),
    [],
  );

  const commitText = () => {
    if (textAt && textValue.trim()) void addMark("text", [textAt], textValue.trim());
    setTextAt(null);
    setTextValue("");
  };

  const send = async () => {
    if (!note.trim() && marks.length === 0 && photos.length === 0) return;
    setStep("sending");
    setError(null);
    try {
      const imageUri = await captureRef(canvas, { format: "png", quality: 1, result: "tmpfile" });
      await onSubmit({ note: note.trim(), marks, imageUri, assetIds: photos.map((photo) => photo.id) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send. Try again.");
      setStep("note");
    }
  };

  const draftMark: Mark | null = draft && draft.length > 0 ? { kind: tool, tag, points: draft, elements: [] } : null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View ref={canvas} collapsable={false} style={StyleSheet.absoluteFill} {...(step === "draw" && !textAt ? responder.panHandlers : {})}>
        <Image source={{ uri: frameUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {marks.map((mark, index) => (
            <MarkShape key={index} mark={mark} index={index} />
          ))}
          {draftMark && <MarkShape mark={draftMark} />}
        </Svg>
      </View>

      <Flash />
      <View pointerEvents="none" style={[styles.frame, { borderRadius: 44 }]} />

      <Animated.View entering={FadeInDown.duration(300)} style={[styles.topRow, { top: insets.top + 8 }]}>
        <Pressable testID="annotate-cancel" accessibilityLabel="Cancel annotation" onPress={onCancel} style={styles.roundButton}>
          <SymbolView name="xmark" size={14} tintColor={colors.ink} weight="bold" />
        </Pressable>
        <View style={styles.hint}>
          <View style={[styles.hintDot, { backgroundColor: TAG_COLORS[tag] }]} />
          <Text style={styles.hintText}>{marks.length === 0 ? `Draw on ${subject}` : `${marks.length} mark${marks.length === 1 ? "" : "s"}`}</Text>
        </View>
        <Pressable
          testID="annotate-undo"
          accessibilityLabel="Undo last mark"
          onPress={() => setMarks((all) => all.slice(0, -1))}
          disabled={marks.length === 0}
          style={[styles.roundButton, marks.length === 0 && { opacity: 0.4 }]}
        >
          <SymbolView name="arrow.uturn.backward" size={15} tintColor={colors.ink} weight="semibold" />
        </Pressable>
      </Animated.View>

      {step === "draw" && !textAt && (
        <Animated.View entering={FadeInDown.springify().damping(20)} exiting={FadeOutDown.duration(150)} style={[styles.toolbar, { bottom: insets.bottom + 12 }]}>
          <View style={styles.tagRow}>
            {(Object.keys(TAG_COLORS) as Tag[]).map((value) => (
              <Pressable
                key={value}
                testID={`tag-${value}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  setTag(value);
                }}
                style={[styles.tagChip, tag === value && { backgroundColor: TAG_COLORS[value] }]}
              >
                <View style={[styles.tagDot, { backgroundColor: tag === value ? "#fff" : TAG_COLORS[value] }]} />
                <Text style={[styles.tagText, tag === value && { color: "#fff" }]}>{TAG_LABELS[value]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.toolRow}>
            {TOOLS.map((item) => (
              <Pressable
                key={item.tool}
                testID={`tool-${item.tool}`}
                accessibilityLabel={item.label}
                onPress={() => {
                  Haptics.selectionAsync();
                  setTool(item.tool);
                }}
                style={[styles.toolButton, tool === item.tool && styles.toolActive]}
              >
                <SymbolView name={item.icon} size={20} tintColor={tool === item.tool ? "#fff" : colors.ink} weight="semibold" />
              </Pressable>
            ))}
            <Pressable
              testID="annotate-next"
              accessibilityLabel="Next"
              onPress={() => setStep("note")}
              disabled={marks.length === 0}
              style={[styles.nextButton, marks.length === 0 && { opacity: 0.35 }]}
            >
              <SymbolView name="arrow.right" size={18} tintColor="#fff" weight="bold" />
            </Pressable>
          </View>
        </Animated.View>
      )}

      {textAt && (
        <KeyboardAvoidingView behavior="padding" style={styles.sheetWrap} pointerEvents="box-none">
          <Animated.View entering={ZoomIn.springify().damping(18)} style={styles.textCard}>
            <TextInput
              testID="mark-text-input"
              autoFocus
              value={textValue}
              onChangeText={setTextValue}
              placeholder="Add a note here"
              placeholderTextColor={colors.muted}
              style={styles.textInput}
              returnKeyType="done"
              onSubmitEditing={commitText}
              maxLength={140}
            />
            <Pressable onPress={commitText} style={[styles.smallSend, { backgroundColor: TAG_COLORS[tag] }]}>
              <SymbolView name="checkmark" size={14} tintColor="#fff" weight="bold" />
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      )}

      {step !== "draw" && (
        <KeyboardAvoidingView behavior="padding" style={styles.sheetWrap} pointerEvents="box-none">
          <Animated.View entering={FadeInDown.springify().damping(22)} style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>What should change?</Text>
            <Text style={styles.sheetSub}>
              {heading ? `${heading}. ` : ""}{agentName.charAt(0).toUpperCase() + agentName.slice(1)} gets the screenshot, your {marks.length} mark{marks.length === 1 ? "" : "s"}, and the parts under them.
            </Text>
            <TextInput
              testID="feedback-note"
              value={note}
              onChangeText={setNote}
              placeholder="Make this pop"
              placeholderTextColor={colors.muted}
              style={styles.noteInput}
              multiline
              autoFocus
              maxLength={1000}
              editable={step === "note"}
            />
            {onAttachPhoto && (
              <View style={styles.photoRow}>
                {photos.map((photo) => (
                  <Pressable key={photo.id} onLongPress={() => setPhotos((all) => all.filter((item) => item.id !== photo.id))}>
                    <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                  </Pressable>
                ))}
                {photos.length < 4 && (
                  <Pressable
                    testID="attach-photo"
                    disabled={attaching || step === "sending"}
                    onPress={async () => {
                      setAttaching(true);
                      setError(null);
                      try {
                        const photo = await onAttachPhoto();
                        if (photo) setPhotos((all) => [...all, photo]);
                      } catch (problem) {
                        setError(problem instanceof Error ? problem.message.replace(/^.*Uncaught Error: /s, "").split("\n")[0] : "Couldn't add that photo");
                      } finally {
                        setAttaching(false);
                      }
                    }}
                    style={styles.attach}
                  >
                    {attaching ? <ActivityIndicator size="small" color={colors.ink} /> : <SymbolView name="photo.badge.plus" size={18} tintColor={colors.ink} />}
                    <Text style={styles.attachText}>{photos.length ? "Another" : "Add a photo"}</Text>
                  </Pressable>
                )}
              </View>
            )}
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.sheetActions}>
              <Pressable onPress={() => setStep("draw")} disabled={step === "sending"} style={styles.backButton}>
                <Text style={styles.backText}>Keep drawing</Text>
              </Pressable>
              <Pressable testID="feedback-send" accessibilityLabel={`Send to ${agentName}`} onPress={send} disabled={step === "sending"} style={styles.sendButton}>
                <SymbolView name="paperplane.fill" size={15} tintColor="#fff" />
                <Text style={styles.sendText}>{step === "sending" ? "Sending…" : `Send to ${agentName}`}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  photoThumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.canvas },
  attach: { flexDirection: "row", alignItems: "center", gap: 7, height: 52, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.canvas },
  attachText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  frame: { ...StyleSheet.absoluteFill, borderWidth: 3, borderColor: "rgba(124,92,255,0.55)" },
  topRow: { position: "absolute", left: 14, right: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roundButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.94)", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  hint: { flexDirection: "row", alignItems: "center", gap: 8, height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.ink },
  hintDot: { width: 8, height: 8, borderRadius: 4 },
  hintText: { fontFamily: fonts.semibold, fontSize: 14, color: "#fff" },
  toolbar: { position: "absolute", left: 12, right: 12, gap: 10, padding: 10, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.97)", shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  tagRow: { flexDirection: "row", gap: 8 },
  tagChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 36, borderRadius: 18, backgroundColor: colors.canvas },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  tagText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  toolRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  toolButton: { flex: 1, height: 50, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  toolActive: { backgroundColor: colors.ink },
  nextButton: { width: 64, height: 50, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  sheetWrap: { ...StyleSheet.absoluteFill, justifyContent: "flex-end" },
  textCard: { flexDirection: "row", alignItems: "center", gap: 8, margin: 16, marginBottom: 24, padding: 8, paddingLeft: 16, borderRadius: 24, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 6 } },
  textInput: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink, paddingVertical: 8 },
  smallSend: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 8, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 30, shadowOffset: { width: 0, height: -6 } },
  grabber: { alignSelf: "center", width: 38, height: 5, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.12)", marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
  sheetSub: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft, marginTop: 2, marginBottom: 14 },
  noteInput: { minHeight: 84, maxHeight: 140, fontFamily: fonts.regular, fontSize: 17, color: colors.ink, backgroundColor: colors.canvas, borderRadius: 18, padding: 14, paddingTop: 14, textAlignVertical: "top" },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.danger, marginTop: 8 },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  backButton: { height: 52, paddingHorizontal: 18, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  backText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  sendButton: { flex: 1, flexDirection: "row", gap: 8, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  sendText: { fontFamily: fonts.semibold, fontSize: 16, color: "#fff" },
});
