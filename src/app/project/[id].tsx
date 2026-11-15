import { useMutation, useQuery } from "convex/react";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { AppDoc } from "../../../shared/model";
import { AppPreview, PreviewHandle, Selection } from "../../components/AppPreview";
import { EditSheet } from "../../components/EditSheet";
import { HistorySheet } from "../../components/HistorySheet";
import { colors, fonts } from "../../theme";

const MIN_WORKING_MS = 1300;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id as Id<"projects">;
  const insets = useSafeAreaInsets();
  const project = useQuery(api.projects.get, { projectId });
  const submitEdit = useMutation(api.edits.submit);
  const undo = useMutation(api.versions.undo);
  const checkout = useMutation(api.versions.checkout);

  const preview = useRef<PreviewHandle>(null);
  const [editMode, setEditMode] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [working, setWorking] = useState(false);
  const [frozenDoc, setFrozenDoc] = useState<AppDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flashIds, setFlashIds] = useState<string[]>([]);
  const [toast, setToast] = useState<{ summary: string; number: number } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(timer);
  }, [toast]);

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

  const doc = (frozenDoc ?? project.doc) as AppDoc;
  const canUndo = Boolean(project.current?.parentId);
  const versionNumber = project.current?.number ?? 1;

  const toggleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditMode((on) => !on);
    setSelection(null);
    setError(null);
  };

  const submit = async (instruction: string) => {
    if (!selection) return;
    setError(null);
    setWorking(true);
    setFrozenDoc(project.doc as AppDoc);
    const started = Date.now();
    try {
      const result = await submitEdit({ projectId, elementId: selection.id, instruction });
      await wait(Math.max(0, MIN_WORKING_MS - (Date.now() - started)));
      if (result.ok) {
        setFlashIds(result.changedIds);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setToast({ summary: result.summary, number: result.number });
        setTimeout(() => preview.current?.select(result.targetId), 120);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setError(result.message);
      }
    } catch {
      setError("Couldn't reach Direct. Check your connection and try again.");
    } finally {
      setFrozenDoc(null);
      setWorking(false);
    }
  };

  const runUndo = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setToast(null);
    const result = await undo({ projectId });
    if (result) setFlashIds(result.changedIds);
  };

  const restore = async (versionId: Id<"versions">, changedIds: string[]) => {
    setHistoryOpen(false);
    setFlashIds(changedIds);
    await checkout({ projectId, versionId });
  };

  const topBarHeight = 52;

  return (
    <View style={styles.fill}>
      <AppPreview
        ref={preview}
        doc={doc}
        changedIds={flashIds}
        editMode={editMode}
        insetTop={insets.top + topBarHeight}
        insetBottom={insets.bottom + 110}
        onSelect={(next) => {
          setSelection(next);
          setError(null);
        }}
        style={styles.fill}
      />

      <View pointerEvents="box-none" style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="back-button" accessibilityLabel="Back to projects" onPress={() => router.back()}>
          <BlurView intensity={60} tint="light" style={styles.circle}>
            <SymbolView name="chevron.left" size={16} tintColor={colors.ink} weight="semibold" />
          </BlurView>
        </Pressable>
        <BlurView intensity={60} tint="light" style={styles.titlePill}>
          {editMode && <View style={styles.editDot} />}
          <Text style={styles.titleText}>{project.name}</Text>
          <Text testID="version-label" style={styles.versionText}>v{versionNumber}</Text>
        </BlurView>
        <Pressable testID="history-button" accessibilityLabel="Version history" onPress={() => setHistoryOpen(true)}>
          <BlurView intensity={60} tint="light" style={styles.circle}>
            <SymbolView name="clock.arrow.circlepath" size={16} tintColor={colors.ink} weight="semibold" />
          </BlurView>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior="padding" pointerEvents="box-none" style={styles.bottom}>
        {toast && (
          <Animated.View entering={FadeInDown.springify().damping(18)} exiting={FadeOut.duration(180)} style={styles.toastWrap}>
            <View testID="edit-toast" style={styles.toast}>
              <View style={styles.toastCheck}>
                <SymbolView name="checkmark" size={11} tintColor="#fff" weight="bold" />
              </View>
              <Text numberOfLines={1} style={styles.toastText}>{toast.summary}</Text>
              <Text style={styles.toastVersion}>v{toast.number}</Text>
            </View>
          </Animated.View>
        )}

        {editMode && selection ? (
          <EditSheet
            key={selection.id}
            selection={selection}
            working={working}
            error={error}
            canUndo={canUndo}
            bottomInset={insets.bottom}
            onSubmit={submit}
            onUndo={runUndo}
            onClose={() => preview.current?.select(null)}
          />
        ) : (
          <Animated.View key={editMode ? "edit" : "use"} entering={FadeInUp.duration(260)} exiting={FadeOutDown.duration(160)} style={[styles.dock, { paddingBottom: insets.bottom + 14 }]}>
            {editMode ? (
              <View style={styles.dockRow}>
                {canUndo && (
                  <Pressable testID="undo-button" accessibilityLabel="Undo" onPress={runUndo} style={styles.dockCircle}>
                    <SymbolView name="arrow.uturn.backward" size={16} tintColor={colors.ink} weight="semibold" />
                  </Pressable>
                )}
                <View style={styles.hintPill}>
                  <SymbolView name="hand.tap" size={16} tintColor="#fff" />
                  <Text style={styles.hintText}>Tap anything to change it</Text>
                </View>
                <Pressable testID="edit-done" accessibilityLabel="Done editing" onPress={toggleEdit} style={styles.doneButton}>
                  <Text style={styles.doneText}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable testID="edit-toggle" accessibilityLabel="Edit" onPress={toggleEdit} style={({ pressed }) => [styles.editButton, pressed && { transform: [{ scale: 0.97 }] }]}>
                <SymbolView name="wand.and.stars" size={18} tintColor="#fff" weight="semibold" />
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            )}
          </Animated.View>
        )}
      </KeyboardAvoidingView>

      {working && <Animated.View entering={FadeIn} exiting={FadeOut} pointerEvents="none" style={styles.workingVeil} />}

      <HistorySheet
        projectId={projectId}
        currentVersionId={project.currentVersionId}
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onCheckout={restore}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.canvas },
  center: { alignItems: "center", justifyContent: "center" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 },
  circle: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.55)" },
  titlePill: { flexDirection: "row", alignItems: "center", gap: 7, height: 40, paddingHorizontal: 16, borderRadius: 20, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.55)" },
  editDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  titleText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  versionText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0 },
  dock: { alignItems: "center", paddingHorizontal: 16 },
  dockRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dockCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  hintPill: { flexDirection: "row", alignItems: "center", gap: 8, height: 52, paddingHorizontal: 18, borderRadius: 26, backgroundColor: colors.ink },
  hintText: { fontFamily: fonts.semibold, fontSize: 15, color: "#fff" },
  doneButton: { height: 52, paddingHorizontal: 20, borderRadius: 26, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  doneText: { fontFamily: fonts.semibold, fontSize: 15, color: "#fff" },
  editButton: { flexDirection: "row", alignItems: "center", gap: 10, height: 58, paddingHorizontal: 30, borderRadius: 29, backgroundColor: colors.ink, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  editText: { fontFamily: fonts.semibold, fontSize: 17, color: "#fff" },
  toastWrap: { alignItems: "center", marginBottom: 12, paddingHorizontal: 20 },
  toast: { flexDirection: "row", alignItems: "center", gap: 10, maxWidth: "100%", backgroundColor: colors.ink, borderRadius: 18, paddingVertical: 11, paddingLeft: 12, paddingRight: 14, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  toastCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  toastText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14, color: "#fff" },
  toastVersion: { fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,255,255,0.55)" },
  workingVeil: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(99,91,255,0.04)" },
});
