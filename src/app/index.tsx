import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";
import { AppDoc } from "../../shared/model";
import { AppPreview } from "../components/AppPreview";
import { colors, fonts, timeAgo } from "../theme";

type ProjectSummary = Doc<"projects"> & { currentNumber: number };

const PREVIEW_SCALE = 0.62;

function ProjectCard({ project, index }: { project: ProjectSummary; index: number }) {
  const { width } = useWindowDimensions();
  const cardWidth = width - 40;
  const previewHeight = 360;
  const open = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: "/project/[id]", params: { id: project._id } });
  };
  const edits = project.versionCount - 1;
  return (
    <Animated.View entering={FadeInDown.delay(120 + index * 90).duration(500)}>
      <Pressable testID={`project-${project.templateId}`} accessibilityLabel={`Open ${project.name}`} onPress={open} style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }] }]}>
        <View style={[styles.previewWell, { height: previewHeight }]}>
          <View pointerEvents="none" style={[styles.phone, { width: cardWidth * 0.62, height: previewHeight + 40 }]}>
            <View style={{ width: (cardWidth * 0.62) / PREVIEW_SCALE, height: (previewHeight + 40) / PREVIEW_SCALE, transform: [{ scale: PREVIEW_SCALE }], transformOrigin: "top left" }}>
              <AppPreview doc={project.doc as AppDoc} interactive={false} insetTop={18} />
            </View>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.emoji}>
            <Text style={{ fontSize: 22 }}>{project.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{project.name}</Text>
            <Text style={styles.cardMeta}>
              {project.tagline} · {edits === 0 ? "Untouched" : `${edits} edit${edits === 1 ? "" : "s"}`} · {timeAgo(project.updatedAt)}
            </Text>
          </View>
          <View style={styles.openButton}>
            <SymbolView name="arrow.up.right" size={15} tintColor={colors.ink} weight="semibold" />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const projects = useQuery(api.projects.list);
  const seed = useMutation(api.projects.seed);
  const create = useMutation(api.projects.createFromTemplate);

  useEffect(() => {
    if (projects && projects.length === 0) seed();
  }, [projects]);

  const createFrom = async (templateId: "habits" | "dashboard") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const id = await create({ templateId });
    router.push({ pathname: "/project/[id]", params: { id } });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: insets.bottom + 40 }}>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>Direct</Text>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>D</Text>
          </View>
        </View>
        <Text style={styles.lede}>
          Tap anything in your app.{"\n"}
          <Text style={{ fontFamily: fonts.displayItalic, color: colors.ink }}>Say what should change.</Text>
        </Text>
      </Animated.View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>Your apps</Text>
        {projects && <Text style={styles.sectionCount}>{projects.length}</Text>}
      </View>

      {!projects || projects.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.inkSoft} />
        </View>
      ) : (
        <View style={{ gap: 18, paddingHorizontal: 20 }}>
          {projects.map((project, index) => (
            <ProjectCard key={project._id} project={project} index={index} />
          ))}
        </View>
      )}

      <Text style={[styles.sectionLabel, { marginTop: 34, marginHorizontal: 20 }]}>Start something new</Text>
      <View style={styles.templateRow}>
        {([
          ["habits", "🌱", "Habit tracker"],
          ["dashboard", "☀️", "Daily dashboard"],
        ] as const).map(([id, emoji, label]) => (
          <Pressable key={id} onPress={() => createFrom(id)} style={({ pressed }) => [styles.template, pressed && { opacity: 0.7 }]}>
            <Text style={{ fontSize: 20 }}>{emoji}</Text>
            <Text style={styles.templateText}>{label}</Text>
            <SymbolView name="plus" size={13} tintColor={colors.muted} weight="semibold" />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, marginBottom: 30 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { fontFamily: fonts.display, fontSize: 46, color: colors.ink, letterSpacing: -0.5 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontFamily: fonts.semibold, fontSize: 15 },
  lede: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.inkSoft, marginTop: 14, letterSpacing: -0.3 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, marginBottom: 14 },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, textTransform: "uppercase", letterSpacing: 1.1 },
  sectionCount: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, backgroundColor: colors.line, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, overflow: "hidden" },
  loading: { height: 300, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.surface, borderRadius: 30, overflow: "hidden", shadowColor: "#1A1408", shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  previewWell: { backgroundColor: "#ECE8E0", alignItems: "center", paddingTop: 26, overflow: "hidden" },
  phone: { borderRadius: 28, overflow: "hidden", backgroundColor: "#fff", borderWidth: 5, borderColor: "#16151A" },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18 },
  emoji: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, letterSpacing: -0.2 },
  cardMeta: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 1 },
  openButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  templateRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 14 },
  template: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  templateText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
});
