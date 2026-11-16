import { useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { FunctionReturnType } from "convex/server";
import { KINDS } from "../../shared/kinds";
import { AppDoc } from "../../shared/model";
import { DesignThumb } from "../components/DesignThumb";
import { deviceKey } from "../device";
import { colors, fonts, timeAgo } from "../theme";

type Workspace = FunctionReturnType<typeof api.workspaces.list>[number];

function WorkspaceCard({ workspace, index }: { workspace: Workspace; index: number }) {
  const running = workspace.components.some((part) => part.run?.status === "thinking");
  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 70).duration(450)}>
      <Pressable
        testID={`workspace-${workspace.name}`}
        accessibilityLabel={`Open ${workspace.name}`}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push({ pathname: "/workspace/[id]", params: { id: workspace._id } });
        }}
        style={({ pressed }) => [styles.workspace, pressed && { transform: [{ scale: 0.985 }] }]}
      >
        <View style={styles.partsRow}>
          {workspace.components.map((part) => {
            const tall = part.role === "app";
            const size = tall ? { width: 84, height: 136 } : { width: 84, height: 84 };
            return (
              <View key={part._id} style={[styles.partThumb, size]}>
                {part.design ? (
                  <DesignThumb key={part.design.updatedAt} doc={part.design.doc as AppDoc} kind={KINDS[part.design.kind]} width={size.width} height={size.height} style={{ backgroundColor: "#ECE8E0" }} />
                ) : part.project?.afterUrl ? (
                  <Image source={{ uri: part.project.afterUrl }} resizeMode="cover" style={size} />
                ) : (
                  <View style={[size, styles.liveThumb]}>
                    <SymbolView name="globe" size={22} tintColor={colors.muted} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.emoji}>
            <Text style={{ fontSize: 22 }}>{workspace.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{workspace.name}</Text>
            <Text numberOfLines={1} style={styles.cardMeta}>
              {running ? "Clay is working… · " : ""}
              {workspace.components.length} {workspace.components.length === 1 ? "part" : "parts"} · {timeAgo(workspace.updatedAt)}
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
  const workspaces = useQuery(api.workspaces.list, { deviceKey: deviceKey() });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: insets.bottom + 40 }}>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>Clay</Text>
          <Pressable testID="settings" accessibilityLabel="Settings" onPress={() => router.push("/settings")} style={styles.avatar}>
            <SymbolView name="gearshape.fill" size={17} tintColor="#fff" />
          </Pressable>
        </View>
        <Text style={styles.lede}>
          <Text style={{ fontFamily: fonts.displayItalic, color: colors.ink }}>Mold what you make.</Text>
        </Text>
        <View style={styles.actions}>
          <Pressable testID="new-workspace" onPress={() => router.push("/workspace/new")} style={[styles.action, styles.actionPrimary]}>
            <SymbolView name="plus" size={15} tintColor="#fff" weight="bold" />
            <Text style={[styles.actionText, { color: "#fff" }]}>New workspace</Text>
          </Pressable>
          <Pressable testID="your-style" onPress={() => router.push("/style")} style={styles.action}>
            <SymbolView name="paintpalette" size={15} tintColor={colors.ink} />
            <Text style={styles.actionText}>Your style</Text>
          </Pressable>
        </View>
      </Animated.View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>Workspaces</Text>
        {workspaces && <Text style={styles.sectionCount}>{workspaces.length}</Text>}
      </View>
      {workspaces === undefined ? (
        <View style={[styles.loading, { height: 120 }]}>
          <ActivityIndicator color={colors.inkSoft} />
        </View>
      ) : workspaces.length === 0 ? (
        <Pressable testID="workspace-empty" onPress={() => router.push("/workspace/new")} style={[styles.empty, { marginBottom: 30 }]}>
          <Text style={styles.emptyTitle}>Start a workspace</Text>
          <Text style={styles.emptyText}>An app plus its logo and icon. Mark up any of them, at any version, and Clay reshapes it with your own model key.</Text>
        </Pressable>
      ) : (
        <View style={{ gap: 16, paddingHorizontal: 20, marginBottom: 30 }}>
          {workspaces.map((workspace, index) => (
            <WorkspaceCard key={workspace._id} workspace={workspace} index={index} />
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
  lede: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.inkSoft, marginTop: 14, letterSpacing: -0.3 },
  actions: { flexDirection: "row", gap: 10, marginTop: 20 },
  action: { flexDirection: "row", alignItems: "center", gap: 7, height: 42, paddingHorizontal: 16, borderRadius: 21, backgroundColor: colors.surface },
  actionPrimary: { backgroundColor: colors.ink },
  actionText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  workspace: { backgroundColor: colors.surface, borderRadius: 28, overflow: "hidden", shadowColor: "#1A1408", shadowOpacity: 0.07, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
  partsRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 16, backgroundColor: "#ECE8E0" },
  partThumb: { borderRadius: 14, overflow: "hidden", backgroundColor: "#fff", shadowColor: "#1A1408", shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  liveThumb: { alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, marginBottom: 14 },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, textTransform: "uppercase", letterSpacing: 1.1 },
  sectionCount: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, backgroundColor: colors.line, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, overflow: "hidden" },
  loading: { height: 300, alignItems: "center", justifyContent: "center" },
  empty: { marginHorizontal: 20, padding: 22, borderRadius: 26, backgroundColor: colors.surface, gap: 8 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  emptyText: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft, lineHeight: 21 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18 },
  emoji: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, letterSpacing: -0.2 },
  cardMeta: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 1 },
  openButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
});
