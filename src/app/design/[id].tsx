import { useMutation, useQuery } from "convex/react";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { requestPermissionsAsync, saveToLibraryAsync } from "expo-media-library/legacy";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { ComponentRef, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { interpret, interpretProject } from "../../../shared/interpreter";
import { kindOf } from "../../../shared/kinds";
import { AppDoc, PLURAL_LABELS, allLike, describeSelection, findNode, siblingsLike } from "../../../shared/model";
import { EditError, Operation, applyOperations } from "../../../shared/operations";
import { Profile } from "../../../shared/style";
import { Annotator, Mark } from "../../components/Annotator";
import { CanvasHandle, DesignCanvas, Picked } from "../../components/DesignCanvas";
import { MakeSheet, Scope } from "../../components/MakeSheet";
import { deviceKey } from "../../device";
import { colors, fonts, timeAgo } from "../../theme";

type CommitScope = "one" | "many" | "everything" | "example";
interface Offer { targets: string[]; operations: Operation[]; noun: string }
interface Preview { doc: AppDoc; operations: Operation[]; summary: string; instruction: string; changedIds: string[] }

export default function DesignScreen() {
  const { id, component } = useLocalSearchParams<{ id: string; component?: string }>();
  return <DesignEditor designId={id as Id<"designs">} componentId={component ? (component as Id<"components">) : undefined} />;
}

export function DesignEditor({ designId, componentId, base }: { designId: Id<"designs">; componentId?: Id<"components">; base?: number }) {
  const key = deviceKey();
  const part = useQuery(api.workspaces.component, componentId ? { deviceKey: key, componentId } : "skip");
  const versions = useQuery(api.designs.versions, base !== undefined ? { deviceKey: key, designId } : "skip");
  const generateUploadUrl = useMutation(api.feedback.generateUploadUrl);
  const iterate = useMutation(api.clay.iterate);
  const frame = useRef<ComponentRef<typeof View>>(null);
  const canvasHandle = useRef<CanvasHandle>(null);
  const [annotating, setAnnotating] = useState<{ frameUri: string; baseNumber: number } | null>(null);
  const [markBase, setMarkBase] = useState<number | null>(base ?? null);
  const [dismissedRun, setDismissedRun] = useState<string | null>(null);
  const seenRun = useRef<string | null>(null);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const design = useQuery(api.designs.get, { deviceKey: key, designId });
  const memory = useQuery(api.style.get, { deviceKey: key });
  const commit = useMutation(api.designs.commit).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.designs.get, { deviceKey: key, designId });
    if (!current) return;
    try {
      const result = applyOperations(current.doc as AppDoc, kindOf(current.kind), args.operations as Operation[]);
      store.setQuery(api.designs.get, { deviceKey: key, designId }, { ...current, doc: result.doc, position: current.position + 1 });
    } catch {}
  });
  const undo = useMutation(api.designs.undo);
  const goBack = useMutation(api.designs.goBack);

  const [editMode, setEditMode] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("one");
  const [error, setError] = useState<string | null>(null);
  const [flashIds, setFlashIds] = useState<string[]>([]);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<ComponentRef<typeof View>>(null);

  const latestRun = part?.runs[0] ?? null;
  useEffect(() => {
    if (!latestRun) return;
    const marker = `${latestRun._id}:${latestRun.status}`;
    if (seenRun.current && seenRun.current !== marker && latestRun.status === "done") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setToast({ text: latestRun.summary ?? "Clay made a new version" });
    }
    seenRun.current = marker;
  }, [latestRun?._id, latestRun?.status]);

  useEffect(() => {
    if (base === undefined || !versions) return;
    const timer = setTimeout(() => void startMarkup(base), 900);
    return () => clearTimeout(timer);
  }, [versions === undefined]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  if (design === undefined) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={colors.inkSoft} />
      </View>
    );
  }
  if (design === null) {
    router.back();
    return null;
  }

  const kind = kindOf(design.kind);
  const markDoc = markBase !== null ? versions?.find((version) => version.number === markBase)?.doc : undefined;
  const doc = (markDoc ?? preview?.doc ?? design.doc) as AppDoc;
  const profile: Profile = memory?.profile ?? {};
  const history = design.history.filter((entry) => entry.number <= design.position && entry.scope !== "start");
  const canUndo = Boolean(preview) || design.position > 0;
  const sheetOpen = editMode && (selection.length > 0 || scope === "all");
  const selectionLabel = scope === "all" ? "" : selection.length > 1 ? `${describeSelection(doc.root, selection)} selected` : "";

  const closeSheet = () => {
    setSelection([]);
    setScope("one");
    setError(null);
    setOffer(null);
  };

  const run = async (operations: Operation[], summary: string, commitScope: CommitScope, instruction?: string) => {
    setError(null);
    try {
      applyOperations(design.doc as AppDoc, kind, operations);
    } catch (problem) {
      setError(problem instanceof EditError ? problem.message : "That change didn't work.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return null;
    }
    const result = await commit({ deviceKey: key, designId, operations, summary, scope: commitScope, instruction });
    if (!result.ok) {
      setError(result.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return null;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFlashIds(result.changedIds);
    setToast({ text: summary });
    return result;
  };

  const maybeOffer = (operations: Operation[]) => {
    if (selection.length !== 1 || scope !== "one") return setOffer(null);
    const styleOps = operations.filter((operation) => operation.op === "setStyle" && operation.targets.includes(selection[0]));
    if (styleOps.length === 0) return setOffer(null);
    const node = findNode(doc.root, selection[0]);
    const others = siblingsLike(doc.root, selection[0]).filter((other) => other.id !== selection[0]);
    if (!node || others.length === 0) return setOffer(null);
    setOffer({
      targets: others.map((other) => other.id),
      operations: styleOps.map((operation) => ({ ...operation, targets: others.map((other) => other.id) })),
      noun: others.length === 1 ? "other one" : `other ${others.length} ${PLURAL_LABELS[node.type]}`,
    });
  };

  const applyInstruction = async (instruction: string) => {
    const context = { kind, profile, history };
    if (scope === "all") {
      const plan = interpretProject(doc, instruction, context);
      if (!plan.ok) return setError(plan.message);
      try {
        const result = applyOperations(doc, kind, plan.operations);
        setError(null);
        setPreview({ doc: result.doc, operations: result.operations, summary: plan.summary, instruction, changedIds: result.changedIds });
        setFlashIds(result.changedIds);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (problem) {
        setError(problem instanceof EditError ? problem.message : "That change didn't work.");
      }
      return;
    }
    const plan = interpret(doc, selection, instruction, context);
    if (!plan.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return setError(plan.message);
    }
    const result = await run(plan.operations, plan.summary, selection.length > 1 ? "many" : "one", instruction);
    if (result) maybeOffer(plan.operations);
  };

  const applyOperationsFromSheet = async (operations: Operation[], summary: string) => {
    const result = await run(operations, summary, selection.length > 1 ? "many" : "one");
    if (result) maybeOffer(operations);
  };

  const acceptOffer = async () => {
    if (!offer) return;
    const current = offer;
    setOffer(null);
    const result = await run(current.operations, `Applied the same change to the ${current.noun}`, "example");
    if (result) setSelection([selection[0], ...current.targets]);
  };

  const keepPreview = async () => {
    if (!preview) return;
    const current = preview;
    const result = await run(current.operations, current.summary, "everything", current.instruction);
    if (result) {
      setPreview(null);
      closeSheet();
    }
  };

  const discardPreview = () => {
    if (!preview) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlashIds(preview.changedIds);
    setPreview(null);
  };

  const runUndo = async () => {
    if (preview) return discardPreview();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setToast(null);
    setOffer(null);
    const result = await undo({ deviceKey: key, designId });
    if (result) {
      setFlashIds(result.changedIds);
      setToast({ text: `Undid: ${result.summary.charAt(0).toLowerCase()}${result.summary.slice(1)}` });
    }
  };

  const onTap = (picked: Picked) => {
    if (preview) return;
    setError(null);
    setOffer(null);
    setAnchor(picked.id);
    if (selection.length === 0 || scope !== "one") {
      setScope("one");
      setSelection([picked.id]);
      return;
    }
    const next = selection.includes(picked.id) ? selection.filter((other) => other !== picked.id) : [...selection, picked.id];
    setSelection(next);
  };

  const onLongPress = (picked: Picked) => {
    if (preview) return;
    const like = siblingsLike(doc.root, picked.id).map((node) => node.id);
    setAnchor(picked.id);
    setScope("like");
    setSelection(like.length ? like : [picked.id]);
    setOffer(null);
    setToast({ text: `Selected all like this: ${describeSelection(doc.root, like.length ? like : [picked.id]).toLowerCase()}` });
  };

  const changeScope = (next: Scope) => {
    setError(null);
    setOffer(null);
    const focus = anchor ?? selection[0];
    if (next === "like" && focus) {
      const like = allLike(doc.root, focus).map((node) => node.id);
      setSelection(like.length ? like : selection);
    }
    if (next === "one" && focus) setSelection([focus]);
    setScope(next);
  };

  const useMyStyle = () => applyInstruction("use my style");

  const save = async () => {
    if (!kind.export) return;
    const permission = await requestPermissionsAsync(true);
    if (!permission.granted) return setToast({ text: "Allow Photos access in Settings to save.", error: true });
    setExporting(true);
  };

  const capture = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 450));
      const uri = await captureRef(exportRef, { format: "png", quality: 1, result: "tmpfile" });
      await saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setToast({ text: `Saved ${design.name} to Photos` });
    } catch (problem) {
      console.warn("Saving to Photos failed", problem);
      setToast({ text: `Couldn't save to Photos: ${problem instanceof Error ? problem.message : String(problem)}`, error: true });
    } finally {
      setExporting(false);
    }
  };

  async function startMarkup(baseNumber: number) {
    setEditMode(false);
    closeSheet();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const frameUri = await captureRef(frame, { format: "png", quality: 1, result: "tmpfile" });
    setAnnotating({ frameUri, baseNumber });
  }

  const submitMarkup = async ({ note, marks, imageUri }: { note: string; marks: Mark[]; imageUri: string }) => {
    if (!componentId || !annotating) return;
    const uploadUrl = await generateUploadUrl();
    const image = await (await fetch(imageUri)).blob();
    const upload = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "image/png" }, body: image });
    if (!upload.ok) throw new Error("Upload failed. Check your connection.");
    const { storageId } = (await upload.json()) as { storageId: Id<"_storage"> };
    await iterate({
      deviceKey: key,
      componentId,
      note,
      marks: marks.map((mark) => ({ tag: mark.tag, text: mark.text, ids: mark.elements.map((element) => element.selector) })),
      imageId: storageId,
      baseNumber: annotating.baseNumber,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAnnotating(null);
    setMarkBase(null);
  };

  const toggleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditMode((on) => !on);
    closeSheet();
  };

  const startEverything = () => {
    setEditMode(true);
    setScope("all");
    setError(null);
  };

  const topBar = 52;
  const canvasBottom = sheetOpen ? sheetHeight : insets.bottom + 100;
  const exportWidth = Math.min(kind.canvas.width, windowWidth);
  const exportHeight = kind.canvas.height ? (exportWidth * kind.canvas.height) / kind.canvas.width : 0;

  return (
    <View style={styles.fill}>
      {exporting && (
        <View ref={exportRef} collapsable={false} pointerEvents="none" style={[styles.exportFrame, { width: exportWidth, height: exportHeight }]}>
          <DesignCanvas testID="export-canvas" doc={design.doc as AppDoc} kind={kind} exporting interactive={false} onReady={capture} style={{ flex: 1 }} />
        </View>
      )}
      <View ref={frame} collapsable={false} style={StyleSheet.absoluteFill}>
      <DesignCanvas
        handle={canvasHandle}
        doc={doc}
        kind={kind}
        changedIds={flashIds}
        editMode={editMode && !preview}
        selection={scope === "all" ? [] : selection}
        selectionLabel={selectionLabel}
        focusId={anchor}
        insetTop={insets.top + topBar}
        insetBottom={canvasBottom}
        onTap={onTap}
        onLongPress={onLongPress}
        style={StyleSheet.absoluteFill}
      />
      </View>

      <View pointerEvents="box-none" style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="back-button" accessibilityLabel="Back home" onPress={() => router.back()}>
          <BlurView intensity={60} tint="light" style={styles.circle}>
            <SymbolView name="chevron.left" size={16} tintColor={colors.ink} weight="semibold" />
          </BlurView>
        </Pressable>
        <Pressable testID="history-button" accessibilityLabel="Your changes" onPress={() => setHistoryOpen(true)}>
          <BlurView intensity={60} tint="light" style={styles.titlePill}>
            {editMode && <View style={styles.editDot} />}
            <Text style={styles.titleText}>{design.name}</Text>
            <Text style={styles.kindText}>{kind.name}</Text>
            <SymbolView name="chevron.down" size={11} tintColor={colors.muted} weight="semibold" />
          </BlurView>
        </Pressable>
        {componentId ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable testID="scrub-button" accessibilityLabel="Scroll through versions" onPress={() => router.push({ pathname: "/history/[id]", params: { id: componentId } })}>
              <BlurView intensity={60} tint="light" style={styles.circle}>
                <SymbolView name="clock.arrow.trianglehead.counterclockwise.rotate.90" size={16} tintColor={colors.ink} weight="semibold" />
              </BlurView>
            </Pressable>
            {kind.export && (
              <Pressable testID="export-button" accessibilityLabel={kind.export.label} onPress={save}>
                <BlurView intensity={60} tint="light" style={styles.circle}>
                  {exporting ? <ActivityIndicator color={colors.ink} /> : <SymbolView name="square.and.arrow.down" size={16} tintColor={colors.ink} weight="semibold" />}
                </BlurView>
              </Pressable>
            )}
          </View>
        ) : kind.export ? (
          <Pressable testID="export-button" accessibilityLabel={kind.export.label} onPress={save}>
            <BlurView intensity={60} tint="light" style={styles.circle}>
              {exporting ? <ActivityIndicator color={colors.ink} /> : <SymbolView name="square.and.arrow.down" size={16} tintColor={colors.ink} weight="semibold" />}
            </BlurView>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <KeyboardAvoidingView behavior="padding" pointerEvents="box-none" style={styles.bottom}>
        {latestRun && latestRun.status !== "done" && latestRun._id !== dismissedRun && !preview && (
          <Animated.View entering={FadeInDown.duration(220)} style={styles.bannerWrap}>
            <Pressable testID="run-banner" onPress={() => latestRun.status === "failed" && setDismissedRun(latestRun._id)} style={[styles.banner, styles.offer]}>
              {latestRun.status === "failed" ? (
                <SymbolView name="exclamationmark.triangle.fill" size={18} tintColor="#FFB4A8" />
              ) : (
                <ActivityIndicator color="#B8B2FF" />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.offerText}>{latestRun.status === "failed" ? "Clay got stuck" : `Clay is shaping version ${design.versionCount + 1}`}</Text>
                <Text numberOfLines={3} style={styles.runText}>{latestRun.message}</Text>
              </View>
            </Pressable>
          </Animated.View>
        )}
        {preview && (
          <Animated.View entering={FadeInDown.springify().damping(18)} exiting={FadeOut.duration(160)} style={styles.bannerWrap}>
            <View testID="preview-banner" style={styles.banner}>
              <Text style={styles.bannerKicker}>Preview</Text>
              <Text style={styles.bannerText}>{preview.summary}</Text>
              <View style={styles.bannerRow}>
                <Pressable testID="preview-discard" onPress={discardPreview} style={[styles.bannerButton, styles.bannerGhost]}>
                  <Text style={styles.bannerGhostText}>Discard</Text>
                </Pressable>
                <Pressable testID="preview-keep" onPress={keepPreview} style={styles.bannerButton}>
                  <Text style={styles.bannerButtonText}>Keep it</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        )}
        {offer && !preview && (
          <Animated.View entering={FadeInDown.springify().damping(18)} exiting={FadeOut.duration(160)} style={styles.bannerWrap}>
            <View testID="offer-banner" style={[styles.banner, styles.offer]}>
              <Text style={styles.offerText}>Apply to the {offer.noun}?</Text>
              <Pressable testID="offer-dismiss" onPress={() => setOffer(null)} style={[styles.bannerButton, styles.bannerGhost, styles.small]}>
                <Text style={styles.bannerGhostText}>No</Text>
              </Pressable>
              <Pressable testID="offer-accept" onPress={acceptOffer} style={[styles.bannerButton, styles.small]}>
                <Text style={styles.bannerButtonText}>Apply</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
        {toast && !preview && !offer && (
          <Animated.View key={toast.text} entering={FadeIn.duration(200)} style={styles.bannerWrap}>
            <View testID="edit-toast" style={styles.toast}>
              <View style={[styles.toastCheck, toast.error && { backgroundColor: colors.danger }]}>
                <SymbolView name={toast.error ? "exclamationmark" : "checkmark"} size={11} tintColor="#fff" weight="bold" />
              </View>
              <Text numberOfLines={2} style={styles.toastText}>{toast.text}</Text>
            </View>
          </Animated.View>
        )}

        {sheetOpen && !preview ? (
          <MakeSheet
            doc={doc}
            kind={kind}
            selection={selection}
            scope={scope}
            profile={profile}
            error={error}
            canUndo={canUndo}
            bottomInset={insets.bottom}
            onScope={changeScope}
            onInstruction={applyInstruction}
            onOperations={applyOperationsFromSheet}
            onUseMyStyle={useMyStyle}
            onUndo={runUndo}
            onClose={closeSheet}
            onHeight={setSheetHeight}
          />
        ) : (
          !preview && (
            <Animated.View key={editMode ? "edit" : "use"} entering={FadeInUp.duration(260)} exiting={FadeOutDown.duration(160)} style={[styles.dock, { paddingBottom: insets.bottom + 14 }]}>
              <View style={styles.dockRow}>
                {canUndo && (
                  <Pressable testID="undo-button" accessibilityLabel="Undo" onPress={runUndo} style={styles.dockCircle}>
                    <SymbolView name="arrow.uturn.backward" size={16} tintColor={colors.ink} weight="semibold" />
                  </Pressable>
                )}
                {editMode ? (
                  <>
                    <Pressable testID="everything-button" onPress={startEverything} style={styles.hintPill}>
                      <SymbolView name="sparkles" size={16} tintColor="#fff" />
                      <Text style={styles.hintText}>Change everything</Text>
                    </Pressable>
                    <Pressable testID="edit-done" accessibilityLabel="Done editing" onPress={toggleEdit} style={styles.doneButton}>
                      <Text style={styles.doneText}>Done</Text>
                    </Pressable>
                  </>
                ) : componentId ? (
                  <>
                    <Pressable testID="markup-button" accessibilityLabel="Mark it up" onPress={() => startMarkup(design.position)} style={({ pressed }) => [styles.editButton, pressed && { transform: [{ scale: 0.97 }] }]}>
                      <SymbolView name="pencil.tip.crop.circle" size={19} tintColor="#fff" weight="semibold" />
                      <Text style={styles.editText}>Mark it up</Text>
                    </Pressable>
                    <Pressable testID="edit-toggle" accessibilityLabel="Quick edit" onPress={toggleEdit} style={styles.dockCircle}>
                      <SymbolView name="slider.horizontal.3" size={17} tintColor={colors.ink} weight="semibold" />
                    </Pressable>
                  </>
                ) : (
                  <Pressable testID="edit-toggle" accessibilityLabel="Edit" onPress={toggleEdit} style={({ pressed }) => [styles.editButton, pressed && { transform: [{ scale: 0.97 }] }]}>
                    <SymbolView name="wand.and.stars" size={18} tintColor="#fff" weight="semibold" />
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                )}
              </View>
              {editMode && <Text style={styles.dockHint}>Tap a thing to change it. Press and hold to pick all like it.</Text>}
            </Animated.View>
          )
        )}
      </KeyboardAvoidingView>

      {annotating && (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
          <Annotator
            frameUri={annotating.frameUri}
            agentName="Clay"
            subject={`your ${kind.name.toLowerCase()}`}
            heading={annotating.baseNumber !== design.position ? `Marking up version ${annotating.baseNumber}` : undefined}
            hitTest={(probes) => canvasHandle.current?.hitTest(probes) ?? Promise.resolve(probes.map(() => []))}
            onCancel={() => {
              setAnnotating(null);
              setMarkBase(null);
            }}
            onSubmit={submitMarkup}
          />
        </Animated.View>
      )}

      <Modal visible={historyOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setHistoryOpen(false)}>
        <View style={styles.historySheet}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Your changes</Text>
            <Pressable testID="history-close" onPress={() => setHistoryOpen(false)} style={styles.iconButton}>
              <SymbolView name="xmark" size={13} tintColor={colors.ink} weight="bold" />
            </Pressable>
          </View>
          <Text style={styles.historySub}>Tap any moment to go back to it. Nothing is lost until you make a new change from there.</Text>
          <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 40 }}>
            {design.history.map((entry) => {
              const current = entry.number === design.position;
              return (
                <Pressable
                  key={entry._id}
                  testID={`history-${entry.number}`}
                  onPress={async () => {
                    setHistoryOpen(false);
                    setPreview(null);
                    setFlashIds(entry.changedIds);
                    await goBack({ deviceKey: key, designId, number: entry.number });
                  }}
                  style={[styles.historyRow, current && styles.historyRowOn, entry.number > design.position && { opacity: 0.5 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyText}>{entry.summary}</Text>
                    <Text style={styles.historyMeta}>
                      {entry.scope === "everything" ? "Whole design · " : entry.changedIds.length > 1 ? `${entry.changedIds.length} things · ` : ""}
                      {timeAgo(entry.createdAt)}
                    </Text>
                  </View>
                  {current ? <Text style={styles.nowChip}>Now</Text> : <Text style={styles.goBack}>Go back</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.canvas },
  center: { alignItems: "center", justifyContent: "center" },
  exportFrame: { position: "absolute", left: 0, top: 0, backgroundColor: "transparent" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 },
  circle: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
  titlePill: { flexDirection: "row", alignItems: "center", gap: 7, height: 40, paddingHorizontal: 16, borderRadius: 20, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.6)" },
  editDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  titleText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  kindText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0 },
  dock: { alignItems: "center", paddingHorizontal: 16, gap: 10 },
  dockRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dockHint: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft, backgroundColor: "rgba(255,255,255,0.8)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, overflow: "hidden" },
  dockCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  hintPill: { flexDirection: "row", alignItems: "center", gap: 8, height: 52, paddingHorizontal: 18, borderRadius: 26, backgroundColor: colors.ink },
  hintText: { fontFamily: fonts.semibold, fontSize: 15, color: "#fff" },
  doneButton: { height: 52, paddingHorizontal: 20, borderRadius: 26, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  doneText: { fontFamily: fonts.semibold, fontSize: 15, color: "#fff" },
  editButton: { flexDirection: "row", alignItems: "center", gap: 10, height: 58, paddingHorizontal: 30, borderRadius: 29, backgroundColor: colors.ink, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  editText: { fontFamily: fonts.semibold, fontSize: 17, color: "#fff" },
  bannerWrap: { alignItems: "center", marginBottom: 12, paddingHorizontal: 16 },
  banner: { width: "100%", backgroundColor: colors.ink, borderRadius: 22, padding: 16, gap: 6, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  bannerKicker: { fontFamily: fonts.semibold, fontSize: 12, color: "#B8B2FF", textTransform: "uppercase", letterSpacing: 1 },
  bannerText: { fontFamily: fonts.semibold, fontSize: 16, color: "#fff" },
  bannerRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  bannerButton: { flex: 1, height: 44, borderRadius: 14, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  bannerButtonText: { fontFamily: fonts.semibold, fontSize: 15, color: "#fff" },
  bannerGhost: { backgroundColor: "rgba(255,255,255,0.12)" },
  bannerGhostText: { fontFamily: fonts.semibold, fontSize: 15, color: "#fff" },
  offer: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  offerText: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: "#fff" },
  runText: { fontFamily: fonts.regular, fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  small: { flex: 0, paddingHorizontal: 16, height: 38 },
  toast: { flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "stretch", backgroundColor: colors.ink, borderRadius: 18, paddingVertical: 11, paddingLeft: 12, paddingRight: 14 },
  toastCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  toastText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14, color: "#fff" },
  iconButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  historySheet: { flex: 1, backgroundColor: colors.surface, padding: 20 },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyTitle: { fontFamily: fonts.display, fontSize: 32, color: colors.ink },
  historySub: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft, marginTop: 6, marginBottom: 16, lineHeight: 20 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.canvas },
  historyRowOn: { borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.accentSoft },
  historyText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  historyMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginTop: 3 },
  nowChip: { fontFamily: fonts.semibold, fontSize: 12, color: "#fff", backgroundColor: colors.accent, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9, overflow: "hidden" },
  goBack: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accent },
});
