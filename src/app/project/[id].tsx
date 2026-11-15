import { useMutation, useQuery } from "convex/react";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { ComponentRef, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown, useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { AgentStatus, FeedbackStatus, agentLabel } from "../../components/AgentStatus";
import { Annotator, Mark } from "../../components/Annotator";
import { Celebration } from "../../components/Celebration";
import { LiveApp, LiveAppHandle, Viewport } from "../../components/LiveApp";
import { Timeline } from "../../components/Timeline";
import { colors, fonts } from "../../theme";

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id as Id<"projects">;
  const insets = useSafeAreaInsets();
  const project = useQuery(api.projects.get, { projectId });
  const feedback = useQuery(api.feedback.listForProject, { projectId });
  const generateUploadUrl = useMutation(api.feedback.generateUploadUrl);
  const createFeedback = useMutation(api.feedback.create);

  const live = useRef<LiveAppHandle>(null);
  const frame = useRef<ComponentRef<typeof View>>(null);
  const [annotating, setAnnotating] = useState<{ frameUri: string; viewport: Viewport } | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [celebrate, setCelebrate] = useState<{ number: number; summary: string } | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const seenVersion = useRef<string | undefined>(undefined);
  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  useEffect(() => {
    const latest = project?.latestVersionId;
    if (!latest || !project?.latest) return;
    if (seenVersion.current && seenVersion.current !== latest) {
      setReloadKey((k) => k + 1);
      setCelebrate({ number: project.latest.number, summary: project.latest.summary });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      pop.value = withSequence(withSpring(1.25, { damping: 6 }), withSpring(1));
    }
    seenVersion.current = latest;
  }, [project?.latestVersionId]);

  useEffect(() => {
    if (!celebrate) return;
    const timer = setTimeout(() => setCelebrate(null), 6000);
    return () => clearTimeout(timer);
  }, [celebrate]);

  if (project === undefined) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={colors.inkSoft} />
      </View>
    );
  }
  if (project === null) {
    router.back();
    return null;
  }

  const agent = agentLabel(project.agent);
  const webTop = insets.top + 56;
  const toWeb = (points: { x: number; y: number }[]) => points.map((p) => ({ x: p.x, y: Math.round(p.y - webTop) }));
  const newest = feedback?.[0];
  const active = newest && newest.status !== "published" && newest._id !== dismissed ? newest : null;

  const startAnnotating = async () => {
    if (capturing) return;
    setCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const [frameUri, viewport] = await Promise.all([
        captureRef(frame, { format: "png", quality: 1, result: "tmpfile" }),
        live.current!.viewport(),
      ]);
      setAnnotating({ frameUri, viewport: viewport ?? { width: 0, height: 0, scrollY: 0, url: project.url } });
    } finally {
      setCapturing(false);
    }
  };

  const submit = async ({ note, marks, imageUri }: { note: string; marks: Mark[]; imageUri: string }) => {
    const uploadUrl = await generateUploadUrl();
    const image = await (await fetch(imageUri)).blob();
    const upload = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "image/png" }, body: image });
    if (!upload.ok) throw new Error("Upload failed. Check your connection.");
    const { storageId } = (await upload.json()) as { storageId: Id<"_storage"> };
    const viewport = annotating!.viewport;
    await createFeedback({
      projectId,
      note,
      marks: marks.map((mark) => ({ ...mark, points: toWeb(mark.points) })),
      imageId: storageId,
      viewport: { width: viewport.width, height: viewport.height, scrollY: viewport.scrollY },
      pageUrl: viewport.url,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAnnotating(null);
  };

  return (
    <View style={styles.fill}>
      <View ref={frame} collapsable={false} style={[styles.fill, { paddingTop: webTop }]}>
        <LiveApp key={reloadKey} ref={live} url={project.url} style={styles.fill} />
      </View>

      <View pointerEvents="box-none" style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="back-button" accessibilityLabel="Back to projects" onPress={() => router.back()}>
          <BlurView intensity={60} tint="light" style={styles.circle}>
            <SymbolView name="chevron.left" size={16} tintColor={colors.ink} weight="semibold" />
          </BlurView>
        </Pressable>
        <Animated.View style={popStyle}>
          <BlurView intensity={60} tint="light" style={styles.titlePill}>
            <Text style={styles.emoji}>{project.emoji}</Text>
            <Text style={styles.titleText}>{project.name}</Text>
            <View style={styles.versionBadge}>
              <Text testID="version-label" style={styles.versionText}>v{project.latest?.number ?? 1}</Text>
            </View>
          </BlurView>
        </Animated.View>
        <Pressable testID="timeline-button" accessibilityLabel="Timeline" onPress={() => setTimelineOpen(true)}>
          <BlurView intensity={60} tint="light" style={styles.circle}>
            <SymbolView name="clock.arrow.circlepath" size={16} tintColor={colors.ink} weight="semibold" />
          </BlurView>
        </Pressable>
      </View>

      {!annotating && (
        <View pointerEvents="box-none" style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
          {celebrate && (
            <Animated.View entering={FadeInDown.springify().damping(16)} exiting={FadeOut.duration(200)}>
              <Pressable testID="publish-toast" onPress={() => setTimelineOpen(true)} style={styles.toast}>
                <View style={styles.toastBadge}>
                  <Text style={styles.toastBadgeText}>v{celebrate.number}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toastTitle}>New version from {agent}</Text>
                  <Text numberOfLines={2} style={styles.toastText}>{celebrate.summary}</Text>
                </View>
              </Pressable>
            </Animated.View>
          )}
          {active && !celebrate && (
            <Pressable onLongPress={() => setDismissed(active._id)} onPress={() => setTimelineOpen(true)}>
              <AgentStatus
                status={active.status as FeedbackStatus}
                message={active.statusMessage ?? active.events[active.events.length - 1]?.message}
                agent={agent}
              />
            </Pressable>
          )}
          <Animated.View entering={FadeInDown.duration(300)} exiting={FadeOutDown.duration(150)} style={styles.dock}>
            <Pressable
              testID="annotate-button"
              accessibilityLabel="Annotate"
              onPress={startAnnotating}
              style={({ pressed }) => [styles.annotateButton, pressed && { transform: [{ scale: 0.97 }] }]}
            >
              {capturing ? <ActivityIndicator color="#fff" /> : <SymbolView name="pencil.tip.crop.circle" size={20} tintColor="#fff" weight="semibold" />}
              <Text style={styles.annotateText}>Mark it up</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {annotating && (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
          <Annotator frameUri={annotating.frameUri} hitTest={(probes) => live.current!.hitTest(probes.map((probe) => ({ ...probe, points: toWeb(probe.points) })))} onCancel={() => setAnnotating(null)} onSubmit={submit} />
        </Animated.View>
      )}

      {celebrate && <Celebration key={celebrate.number} />}

      <Timeline projectId={projectId} agent={project.agent} latestVersionId={project.latestVersionId} visible={timelineOpen} onClose={() => setTimelineOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.canvas },
  center: { alignItems: "center", justifyContent: "center" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 },
  circle: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)" },
  titlePill: { flexDirection: "row", alignItems: "center", gap: 7, height: 40, paddingLeft: 12, paddingRight: 6, borderRadius: 20, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.7)" },
  emoji: { fontSize: 16 },
  titleText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  versionBadge: { backgroundColor: colors.ink, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  versionText: { fontFamily: fonts.semibold, fontSize: 12, color: "#fff" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0 },
  dock: { alignItems: "center" },
  annotateButton: { flexDirection: "row", alignItems: "center", gap: 10, height: 58, paddingHorizontal: 28, borderRadius: 29, backgroundColor: colors.ink, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  annotateText: { fontFamily: fonts.semibold, fontSize: 17, color: "#fff" },
  toast: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 14, marginBottom: 10, padding: 14, borderRadius: 22, backgroundColor: colors.ink, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  toastBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  toastBadgeText: { fontFamily: fonts.bold, fontSize: 15, color: "#fff" },
  toastTitle: { fontFamily: fonts.semibold, fontSize: 14, color: "#fff" },
  toastText: { fontFamily: fonts.regular, fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
});
