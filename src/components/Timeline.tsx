import { useMutation, useQuery } from "convex/react";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { colors, fonts, timeAgo } from "../theme";
import { AgentStatus, FeedbackStatus, agentLabel } from "./AgentStatus";

interface Props {
  projectId: Id<"projects">;
  agent: string;
  latestVersionId?: Id<"versions">;
  visible: boolean;
  onClose: () => void;
}

export function Timeline({ projectId, agent, latestVersionId, visible, onClose }: Props) {
  const versions = useQuery(api.feedback.timeline, visible ? { projectId } : "skip");
  const feedback = useQuery(api.feedback.listForProject, visible ? { projectId } : "skip");
  const requestRevert = useMutation(api.feedback.requestRevert);
  const [preview, setPreview] = useState<string | null>(null);
  const open = (feedback ?? []).filter((item) => item.status !== "published");

  const revert = (versionId: Id<"versions">, number: number) =>
    Alert.alert(`Roll back to v${number}?`, `Direct will ask ${agentLabel(agent)} to restore v${number}. Nothing changes until it publishes.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Ask agent", onPress: () => requestRevert({ versionId }).then(onClose) },
    ]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Timeline</Text>
          <Pressable testID="timeline-close" accessibilityLabel="Close timeline" onPress={onClose} style={styles.close}>
            <SymbolView name="xmark" size={13} tintColor={colors.ink} weight="bold" />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>Every version {agentLabel(agent)} published from your feedback.</Text>
        <ScrollView contentContainerStyle={{ paddingBottom: 60, gap: 14 }} showsVerticalScrollIndicator={false}>
          {open.map((item) => (
            <View key={item._id} style={styles.openItem}>
              <Text style={styles.openNote} numberOfLines={2}>“{item.note || `${item.marks.length} marks`}”</Text>
              <AgentStatus status={item.status as FeedbackStatus} message={item.statusMessage ?? item.events[item.events.length - 1]?.message} agent={agentLabel(agent)} />
            </View>
          ))}
          {(versions ?? []).map((version) => {
            const latest = version._id === latestVersionId;
            return (
              <View key={version._id} testID={`version-${version.number}`} style={[styles.version, latest && styles.latest]}>
                <View style={styles.versionHead}>
                  <View style={[styles.badge, latest && { backgroundColor: colors.accent }]}>
                    <Text style={[styles.badgeText, latest && { color: "#fff" }]}>v{version.number}</Text>
                  </View>
                  <Text style={styles.time}>{timeAgo(version.createdAt)}</Text>
                  {version.commitSha && <Text style={styles.sha}>{version.commitSha.slice(0, 7)}</Text>}
                  {latest && <Text style={styles.current}>Live</Text>}
                </View>
                {version.note && <Text style={styles.note}>“{version.note}”</Text>}
                {(version.beforeUrl || version.afterUrl) && (
                  <View style={styles.shots}>
                    {version.beforeUrl && (
                      <Pressable style={styles.shot} onPress={() => setPreview(version.beforeUrl)}>
                        <Image source={{ uri: version.beforeUrl }} style={styles.shotImage} />
                        <Text style={styles.shotLabel}>Your marks</Text>
                      </Pressable>
                    )}
                    {version.afterUrl && (
                      <Pressable style={styles.shot} onPress={() => setPreview(version.afterUrl)}>
                        <Image source={{ uri: version.afterUrl }} style={styles.shotImage} />
                        <Text style={styles.shotLabel}>After</Text>
                      </Pressable>
                    )}
                  </View>
                )}
                <View style={styles.summaryRow}>
                  <SymbolView name="sparkles" size={14} tintColor={colors.accent} />
                  <Text style={styles.summary} selectable>{version.summary}</Text>
                </View>
                {!latest && (
                  <Pressable onPress={() => revert(version._id, version.number)} style={styles.revert}>
                    <SymbolView name="arrow.uturn.backward" size={12} tintColor={colors.inkSoft} weight="semibold" />
                    <Text style={styles.revertText}>Ask agent to roll back here</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
      <Modal visible={preview !== null} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.lightbox} onPress={() => setPreview(null)}>
          {preview && <Image source={{ uri: preview }} style={styles.lightboxImage} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: 18, paddingTop: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.display, fontSize: 38, color: colors.ink },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft, marginTop: 2, marginBottom: 20 },
  openItem: { gap: 8 },
  openNote: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkSoft, marginHorizontal: 18 },
  version: { backgroundColor: colors.surface, borderRadius: 24, padding: 16, gap: 12 },
  latest: { borderWidth: 2, borderColor: colors.accent },
  versionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { backgroundColor: colors.canvas, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  time: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, flex: 1 },
  sha: { fontFamily: "Menlo", fontSize: 12, color: colors.inkSoft, backgroundColor: colors.canvas, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, overflow: "hidden" },
  current: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accent },
  note: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  shots: { flexDirection: "row", gap: 10 },
  shot: { flex: 1, gap: 6 },
  shotImage: { width: "100%", aspectRatio: 0.62, borderRadius: 14, backgroundColor: colors.canvas },
  shotLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, textAlign: "center" },
  summaryRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  summary: { flex: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
  revert: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6 },
  revertText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.inkSoft },
  lightbox: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", alignItems: "center", justifyContent: "center" },
  lightboxImage: { width: "92%", height: "86%" },
});
