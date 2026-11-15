import { useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { FunctionReturnType } from "convex/server";
import { agentLabel } from "../components/AgentStatus";
import { LiveApp } from "../components/LiveApp";
import { colors, fonts, timeAgo } from "../theme";

type Project = FunctionReturnType<typeof api.projects.list>[number];

const PREVIEW_SCALE = 0.6;

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const { width } = useWindowDimensions();
  const phoneWidth = (width - 40) * 0.6;
  const previewHeight = 340;
  const open = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: "/project/[id]", params: { id: project._id } });
  };
  const host = project.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return (
    <Animated.View entering={FadeInDown.delay(120 + index * 90).duration(500)}>
      <Pressable testID={`project-${project.name}`} accessibilityLabel={`Open ${project.name}`} onPress={open} style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }] }]}>
        <View style={[styles.previewWell, { height: previewHeight }]}>
          <View pointerEvents="none" style={[styles.phone, { width: phoneWidth, height: previewHeight + 40 }]}>
            <View style={{ width: phoneWidth / PREVIEW_SCALE, height: (previewHeight + 40) / PREVIEW_SCALE, transform: [{ scale: PREVIEW_SCALE }], transformOrigin: "top left" }}>
              <LiveApp key={project.latestVersionId} url={project.url} interactive={false} style={{ flex: 1 }} />
            </View>
          </View>
          {project.openCount > 0 && (
            <View style={styles.openBadge}>
              <View style={styles.openDot} />
              <Text style={styles.openText}>{project.openCount} in progress</Text>
            </View>
          )}
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.emoji}>
            <Text style={{ fontSize: 22 }}>{project.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.cardTitle}>{project.name}</Text>
              <Text style={styles.agentChip}>{agentLabel(project.agent)}</Text>
            </View>
            <Text numberOfLines={1} style={styles.cardMeta}>
              v{project.versionCount} · {host} · {timeAgo(project.updatedAt)}
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
          Draw on your app.{"\n"}
          <Text style={{ fontFamily: fonts.displayItalic, color: colors.ink }}>Your agent ships it.</Text>
        </Text>
      </Animated.View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>Your apps</Text>
        {projects && <Text style={styles.sectionCount}>{projects.length}</Text>}
      </View>

      {!projects ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.inkSoft} />
        </View>
      ) : projects.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Connect your first app</Text>
          <Text style={styles.emptyText}>In your project folder on your laptop, run</Text>
          <Text selectable style={styles.code}>direct init --url https://your-preview.app</Text>
          <Text style={styles.emptyText}>then start the watcher with direct watch. The app appears here.</Text>
        </View>
      ) : (
        <View style={{ gap: 18, paddingHorizontal: 20 }}>
          {projects.map((project, index) => (
            <ProjectCard key={project._id} project={project} index={index} />
          ))}
        </View>
      )}
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
  empty: { marginHorizontal: 20, padding: 22, borderRadius: 26, backgroundColor: colors.surface, gap: 8 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  emptyText: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft, lineHeight: 21 },
  code: { fontFamily: "Menlo", fontSize: 13, color: colors.ink, backgroundColor: colors.canvas, padding: 12, borderRadius: 12, overflow: "hidden" },
  card: { backgroundColor: colors.surface, borderRadius: 30, overflow: "hidden", shadowColor: "#1A1408", shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  previewWell: { backgroundColor: "#ECE8E0", alignItems: "center", paddingTop: 26, overflow: "hidden" },
  phone: { borderRadius: 28, overflow: "hidden", backgroundColor: "#fff", borderWidth: 5, borderColor: "#16151A" },
  openBadge: { position: "absolute", top: 14, right: 14, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.ink, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  openDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#F5A524" },
  openText: { fontFamily: fonts.semibold, fontSize: 12, color: "#fff" },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18 },
  emoji: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, letterSpacing: -0.2 },
  agentChip: { fontFamily: fonts.semibold, fontSize: 11, color: colors.accent, backgroundColor: colors.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: "hidden" },
  cardMeta: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 1 },
  openButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
});
