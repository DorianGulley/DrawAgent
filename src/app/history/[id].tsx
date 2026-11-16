import { useMutation, useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { ComponentRef, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { KindSpec, kindOf } from "../../../shared/kinds";
import { AppDoc } from "../../../shared/model";
import { DesignThumb } from "../../components/DesignThumb";
import { deviceKey } from "../../device";
import { colors, fonts, timeAgo } from "../../theme";

const STEP = 34;

interface Frame {
  number: number;
  summary: string;
  createdAt: number;
  by: "start" | "you" | "agent";
  doc?: AppDoc;
  imageUrl?: string | null;
  versionId?: Id<"versions">;
}

export default function HistoryScrubber() {
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const key = deviceKey();
  const isProject = params.type === "project";
  const part = useQuery(api.workspaces.component, isProject ? "skip" : { deviceKey: key, componentId: params.id as Id<"components"> });
  const projectId = isProject ? (params.id as Id<"projects">) : part?.project?._id;
  const designVersions = useQuery(api.designs.versions, part?.design ? { deviceKey: key, designId: part.design._id } : "skip");
  const timeline = useQuery(api.feedback.timeline, projectId ? { projectId } : "skip");
  const project = useQuery(api.projects.get, projectId ? { projectId } : "skip");
  const goBack = useMutation(api.designs.goBack);
  const requestRevert = useMutation(api.feedback.requestRevert);

  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const ruler = useRef<ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const pop = useSharedValue(1);
  const tilt = useSharedValue(0);

  const kind: KindSpec | null = part?.design ? kindOf(part.design.kind) : null;
  const frames: Frame[] | null = useMemo(() => {
    if (part?.design && designVersions)
      return designVersions.map((version) => ({
        number: version.number,
        summary: version.summary,
        createdAt: version.createdAt,
        by: version.scope === "start" ? "start" : version.scope === "agent" ? "agent" : "you",
        doc: version.doc,
      }));
    if (timeline)
      return [...timeline].reverse().map((version) => ({
        number: version.number,
        summary: version.summary,
        createdAt: version.createdAt,
        by: version.feedbackId ? "agent" : "start",
        imageUrl: version.afterUrl ?? version.beforeUrl,
        versionId: version._id,
      }));
    return null;
  }, [part?.design?._id, designVersions, timeline]);

  const current = part?.design ? frames?.findIndex((frame) => frame.number === part.design!.position) ?? -1 : (frames?.length ?? 0) - 1;
  const active = index ?? (current >= 0 ? current : (frames?.length ?? 1) - 1);
  const frame = frames?.[active];

  useEffect(() => {
    if (!frames || index !== null) return;
    const start = current >= 0 ? current : frames.length - 1;
    setTimeout(() => ruler.current?.scrollTo({ x: start * STEP, animated: false }), 50);
  }, [frames === null]);

  useEffect(() => {
    if (!playing || !frames) return;
    if (active >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => ruler.current?.scrollTo({ x: (active + 1) * STEP, animated: true }), 650);
    return () => clearTimeout(timer);
  }, [playing, active]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!frames) return;
    const next = Math.max(0, Math.min(frames.length - 1, Math.round(event.nativeEvent.contentOffset.x / STEP)));
    if (next === active) return;
    tilt.value = withSequence(withTiming(next > active ? -1 : 1, { duration: 90 }), withSpring(0, { damping: 12 }));
    pop.value = withSequence(withTiming(0.965, { duration: 80 }), withSpring(1, { damping: 10, stiffness: 220 }));
    Haptics.selectionAsync();
    setIndex(next);
  };

  const stageStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { scale: pop.value }, { rotateY: `${tilt.value * 6}deg` }],
  }));

  const name = part?.name ?? project?.name ?? "History";
  if (!frames || !frame) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  const stageWidth = width - 72;
  const stageHeight = Math.min(height * 0.5, kind?.canvas.height ? stageWidth * (kind.canvas.height / kind.canvas.width) + 40 : height * 0.5);
  const isLatest = active === current;

  const markUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (part?.design) router.replace({ pathname: "/part/[id]", params: { id: part._id, base: String(frame.number) } });
    else if (projectId) router.replace({ pathname: "/project/[id]", params: { id: projectId, base: String(frame.number) } });
  };

  const restore = () => {
    if (part?.design) {
      goBack({ deviceKey: key, designId: part.design._id, number: frame.number }).then(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      });
      return;
    }
    if (!frame.versionId) return;
    Alert.alert(`Go back to version ${frame.number}?`, "Clay asks your coding agent to restore it. Nothing changes until it publishes.", [
      { text: "Cancel", style: "cancel" },
      { text: "Ask agent", onPress: () => requestRevert({ versionId: frame.versionId! }).then(() => router.back()) },
    ]);
  };

  const ghost = (offset: number) => frames[active - offset];

  return (
    <LinearGradient colors={["#17141C", "#241E2B", "#120F15"]} style={styles.fill}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="scrub-back" accessibilityLabel="Back" onPress={() => router.back()} style={styles.circle}>
          <SymbolView name="chevron.left" size={16} tintColor="#fff" weight="semibold" />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.title}>{name}</Text>
          <Text testID="scrub-position" style={styles.subtitle}>
            Version {frame.number} of {frames[frames.length - 1].number}
          </Text>
        </View>
        <Pressable testID="scrub-play" accessibilityLabel={playing ? "Pause" : "Play through versions"} onPress={() => {
          if (!playing && active >= frames.length - 1) ruler.current?.scrollTo({ x: 0, animated: false });
          setPlaying((on) => !on);
        }} style={styles.circle}>
          <SymbolView name={playing ? "pause.fill" : "play.fill"} size={14} tintColor="#fff" />
        </Pressable>
      </View>

      <View style={[styles.stageArea, { height: stageHeight + 60 }]}>
        {[2, 1].map((offset) => {
          const back = ghost(offset);
          if (!back) return null;
          return (
            <View
              key={offset}
              pointerEvents="none"
              style={[
                styles.card,
                { width: stageWidth, height: stageHeight, opacity: offset === 1 ? 0.45 : 0.2, transform: [{ translateY: -18 * offset }, { scale: 1 - 0.06 * offset }] },
              ]}
            >
              {back.doc && kind ? <DesignThumb doc={back.doc} kind={kind} width={stageWidth} height={stageHeight} /> : back.imageUrl ? <Image source={{ uri: back.imageUrl }} style={styles.image} /> : null}
            </View>
          );
        })}
        <Animated.View testID="scrub-stage" style={[styles.card, styles.front, { width: stageWidth, height: stageHeight }, stageStyle]}>
          {frame.doc && kind ? (
            <DesignThumb doc={frame.doc} kind={kind} width={stageWidth} height={stageHeight} />
          ) : frame.imageUrl ? (
            <Animated.Image key={frame.number} entering={FadeIn.duration(180)} source={{ uri: frame.imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.center, { backgroundColor: "#2A2431" }]}>
              <Text style={styles.bigNumber}>v{frame.number}</Text>
              <Text style={styles.noPicture}>No picture saved for this version</Text>
            </View>
          )}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>v{frame.number}</Text>
          </View>
          {isLatest && (
            <View style={[styles.badge, styles.nowBadge]}>
              <Text style={styles.badgeText}>Now</Text>
            </View>
          )}
        </Animated.View>
      </View>

      <Animated.View key={frame.number} entering={FadeIn.duration(160)} style={styles.caption}>
        <Text style={styles.captionMeta}>
          {frame.by === "agent" ? (part?.design ? "Made by Clay" : "Made by your agent") : frame.by === "start" ? "Where it started" : "Your change"} · {timeAgo(frame.createdAt)}
        </Text>
        <Text testID="scrub-summary" numberOfLines={2} style={styles.captionText}>{frame.summary}</Text>
      </Animated.View>

      <View style={styles.rulerWrap}>
        <ScrollView
          ref={ruler}
          testID="scrub-ruler"
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={STEP}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          onScrollBeginDrag={() => setPlaying(false)}
          contentContainerStyle={{ paddingHorizontal: width / 2 - STEP / 2, alignItems: "flex-end" }}
        >
          {frames.map((item, i) => {
            const on = i === active;
            return (
              <Pressable key={item.number} onPress={() => ruler.current?.scrollTo({ x: i * STEP, animated: true })} style={styles.tickSlot}>
                <View style={[styles.dot, { backgroundColor: item.by === "agent" ? "#B8B2FF" : item.by === "start" ? "#7A7480" : "#F2C9A8" }, on && { opacity: 1 }]} />
                <View style={[styles.tick, on && styles.tickOn, i === current && !on && styles.tickCurrent]} />
                <Text style={[styles.tickLabel, on && styles.tickLabelOn]}>{frames.length <= 24 || i % 5 === 0 || on ? item.number : ""}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View pointerEvents="none" style={[styles.needle, { left: width / 2 - 1 }]} />
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable testID="scrub-restore" disabled={isLatest} onPress={restore} style={[styles.secondary, isLatest && { opacity: 0.35 }]}>
          <SymbolView name="arrow.uturn.backward" size={15} tintColor="#fff" weight="semibold" />
          <Text style={styles.secondaryText}>Go back to this</Text>
        </Pressable>
        <Pressable testID="scrub-markup" onPress={markUp} style={styles.primary}>
          <SymbolView name="pencil.tip.crop.circle" size={17} tintColor={colors.ink} weight="semibold" />
          <Text style={styles.primaryText}>Mark up v{frame.number}</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#17141C" },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  circle: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 26, color: "#fff" },
  subtitle: { fontFamily: fonts.medium, fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 1 },
  stageArea: { alignItems: "center", justifyContent: "flex-end", paddingBottom: 6 },
  card: { position: "absolute", bottom: 6, borderRadius: 28, overflow: "hidden", backgroundColor: "#ECE8E0" },
  front: { shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 18 } },
  image: { width: "100%", height: "100%" },
  badge: { position: "absolute", top: 12, left: 12, backgroundColor: "rgba(22,21,26,0.85)", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
  nowBadge: { left: undefined, right: 12, backgroundColor: colors.accent },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: "#fff" },
  bigNumber: { fontFamily: fonts.display, fontSize: 72, color: "#fff" },
  noPicture: { fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,255,255,0.5)" },
  caption: { paddingHorizontal: 28, paddingTop: 18, minHeight: 74, alignItems: "center" },
  captionMeta: { fontFamily: fonts.semibold, fontSize: 12, color: "#B8B2FF", letterSpacing: 0.4, textTransform: "uppercase" },
  captionText: { fontFamily: fonts.medium, fontSize: 17, color: "#fff", textAlign: "center", marginTop: 6, lineHeight: 23 },
  rulerWrap: { height: 92, marginTop: 6, justifyContent: "flex-end" },
  tickSlot: { width: STEP, alignItems: "center", gap: 6, paddingBottom: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, opacity: 0.55 },
  tick: { width: 2, height: 22, borderRadius: 1, backgroundColor: "rgba(255,255,255,0.28)" },
  tickOn: { height: 40, width: 3, backgroundColor: "#fff" },
  tickCurrent: { backgroundColor: colors.accent, height: 30 },
  tickLabel: { fontFamily: fonts.semibold, fontSize: 11, color: "rgba(255,255,255,0.4)", height: 14 },
  tickLabelOn: { color: "#fff" },
  needle: { position: "absolute", bottom: 26, width: 2, height: 56, backgroundColor: colors.accent, borderRadius: 1, opacity: 0.0 },
  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 14, marginTop: "auto" },
  secondary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 54, paddingHorizontal: 16, borderRadius: 27, backgroundColor: "rgba(255,255,255,0.1)" },
  secondaryText: { fontFamily: fonts.semibold, fontSize: 15, color: "#fff" },
  primary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 54, borderRadius: 27, backgroundColor: "#fff" },
  primaryText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
});
