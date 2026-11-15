import { useMutation, useQuery } from "convex/react";
import { SymbolView } from "expo-symbols";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { colors, fonts, timeAgo } from "../theme";

interface Props {
  projectId: Id<"projects">;
  currentVersionId?: Id<"versions">;
  visible: boolean;
  onClose: () => void;
  onCheckout: (versionId: Id<"versions">, changedIds: string[]) => void;
}

export function HistorySheet({ projectId, currentVersionId, visible, onClose, onCheckout }: Props) {
  const versions = useQuery(api.versions.list, visible ? { projectId } : "skip");
  const reset = useMutation(api.versions.resetToOriginal);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
          <Pressable accessibilityLabel="Close history" onPress={onClose} style={styles.close}>
            <SymbolView name="xmark" size={13} tintColor={colors.ink} weight="bold" />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>Every change is saved. Tap a version to bring it back.</Text>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {(versions ?? []).map((version, index) => {
            const current = version._id === currentVersionId;
            return (
              <Pressable
                key={version._id}
                onPress={() => onCheckout(version._id, version.changedIds)}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.canvas }]}
              >
                <View style={styles.rail}>
                  <View style={[styles.dot, current && styles.dotCurrent]}>
                    <Text style={[styles.dotText, current && { color: "#fff" }]}>{version.number}</Text>
                  </View>
                  {index < (versions?.length ?? 0) - 1 && <View style={styles.line} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 22 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={styles.summary} numberOfLines={2}>{version.summary}</Text>
                    {current && <Text style={styles.currentTag}>Current</Text>}
                  </View>
                  {version.instruction && <Text style={styles.instruction}>“{version.instruction}”</Text>}
                  <Text style={styles.time}>{timeAgo(version.createdAt)}</Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable onPress={() => reset({ projectId }).then(onClose)} style={styles.reset}>
            <SymbolView name="arrow.counterclockwise" size={14} tintColor={colors.inkSoft} weight="semibold" />
            <Text style={styles.resetText}>Reset to original</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 22, paddingTop: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.display, fontSize: 36, color: colors.ink },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft, marginTop: 4, marginBottom: 24 },
  row: { flexDirection: "row", gap: 14, borderRadius: 14 },
  rail: { alignItems: "center", width: 30 },
  dot: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  dotCurrent: { backgroundColor: colors.accent },
  dotText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.inkSoft },
  line: { flex: 1, width: 2, backgroundColor: colors.line, marginVertical: 4 },
  summary: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, marginTop: 4 },
  currentTag: { fontFamily: fonts.semibold, fontSize: 11, color: colors.accent, backgroundColor: colors.accentSoft, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, overflow: "hidden", marginTop: 4 },
  instruction: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft, marginTop: 4 },
  time: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginTop: 6 },
  reset: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.line },
  resetText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.inkSoft },
});
