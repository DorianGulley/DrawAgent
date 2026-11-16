import { useMutation, useQuery } from "convex/react";
import { FunctionReturnType } from "convex/server";
import * as Haptics from "expo-haptics";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { ActivityIndicator, ActionSheetIOS, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { KINDS } from "../../../shared/kinds";
import { DesignThumb } from "../../components/DesignThumb";
import { LiveApp } from "../../components/LiveApp";
import { deviceKey } from "../../device";
import { choosePhotoSource, problemText, usePhotoUpload } from "../../photos";
import { colors, fonts, timeAgo } from "../../theme";

type Workspace = NonNullable<FunctionReturnType<typeof api.workspaces.get>>;
type Part = Workspace["components"][number];

const ROLE_LABEL: Record<Part["role"], string> = { app: "App", logo: "Logo", icon: "App icon" };

function PartPreview({ part, width, height }: { part: Part; width: number; height: number }) {
  if (part.design) {
    return <DesignThumb key={part.design.updatedAt} doc={part.design.doc} kind={KINDS[part.design.kind]} width={width} height={height} style={{ backgroundColor: "#ECE8E0" }} />;
  }
  if (part.project?.afterUrl) return <Image source={{ uri: part.project.afterUrl }} resizeMode="cover" style={{ width, height, backgroundColor: "#ECE8E0" }} />;
  if (part.project) {
    const scale = 0.5;
    return (
      <View pointerEvents="none" style={{ width, height, overflow: "hidden", backgroundColor: "#fff" }}>
        <View style={{ width: width / scale, height: height / scale, transform: [{ scale }], transformOrigin: "top left" }}>
          <LiveApp url={part.project.url} interactive={false} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }
  return <View style={{ width, height, backgroundColor: "#ECE8E0" }} />;
}

function PartCard({ part, index }: { part: Part; index: number }) {
  const key = deviceKey();
  const updateComponent = useMutation(api.workspaces.updateComponent);
  const removeComponent = useMutation(api.workspaces.removeComponent);
  const [usage, setUsage] = useState(part.usage);
  const isApp = part.role === "app";
  const versions = part.design ? part.design.position : (part.project?.versionCount ?? 0);
  const updatedAt = part.design?.updatedAt ?? part.project?.updatedAt ?? part._creationTime;
  const running = part.run?.status === "thinking";

  const open = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: "/part/[id]", params: { id: part._id } });
  };
  const history = () => {
    Haptics.selectionAsync();
    if (part.project) router.push({ pathname: "/history/[id]", params: { id: part.project._id, type: "project" } });
    else router.push({ pathname: "/history/[id]", params: { id: part._id } });
  };
  const remove = () =>
    Alert.alert(`Remove ${part.name}?`, "Its versions stay saved, but it leaves this workspace.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeComponent({ deviceKey: key, componentId: part._id }) },
    ]);

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 70).duration(420)}>
      <View testID={`part-${part.role}`} style={styles.card}>
        <Pressable onPress={open} onLongPress={isApp ? undefined : remove} style={styles.cardTop}>
          <View style={[styles.preview, isApp ? { width: 104, height: 168 } : { width: 104, height: 104 }]}>
            <PartPreview part={part} width={104} height={isApp ? 168 : 104} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.role}>{ROLE_LABEL[part.role]}{part.project ? " · live" : ""}</Text>
            <Text style={styles.partName}>{part.name}</Text>
            <Text style={styles.meta}>{versions ? `v${versions}` : "Original"} · {timeAgo(updatedAt)}</Text>
            {running ? (
              <View style={styles.runRow}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text numberOfLines={2} style={styles.runText}>{part.run!.message}</Text>
              </View>
            ) : part.run?.status === "failed" ? (
              <Text numberOfLines={2} style={[styles.runText, { color: colors.danger }]}>{part.run.message}</Text>
            ) : part.run?.summary ? (
              <Text numberOfLines={2} style={styles.runText}>Clay: {part.run.summary}</Text>
            ) : part.project?.latestSummary ? (
              <Text numberOfLines={2} style={styles.runText}>{part.project.latestSummary}</Text>
            ) : null}
          </View>
        </Pressable>
        <View style={styles.usageWrap}>
          <Text style={styles.usageLabel}>How it's used</Text>
          <TextInput
            testID={`usage-${part.role}`}
            value={usage}
            onChangeText={setUsage}
            onEndEditing={() => usage !== part.usage && updateComponent({ deviceKey: key, componentId: part._id, usage })}
            multiline
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            placeholder="Where this part shows up, so Clay keeps everything consistent"
            placeholderTextColor={colors.muted}
            style={styles.usage}
          />
        </View>
        <View style={styles.cardActions}>
          <Pressable testID={`open-${part.role}`} onPress={open} style={[styles.pill, styles.pillDark]}>
            <SymbolView name="pencil.tip.crop.circle" size={15} tintColor="#fff" />
            <Text style={[styles.pillText, { color: "#fff" }]}>{part.project ? "Open and mark up" : "Open"}</Text>
          </Pressable>
          <Pressable testID={`history-${part.role}`} onPress={history} style={styles.pill}>
            <SymbolView name="clock.arrow.trianglehead.counterclockwise.rotate.90" size={15} tintColor={colors.ink} />
            <Text style={styles.pillText}>Versions</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function PhotoShelf({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const key = deviceKey();
  const photos = useQuery(api.assets.list, { deviceKey: key, workspaceId });
  const removePhoto = useMutation(api.assets.remove);
  const upload = usePhotoUpload(workspaceId);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const source = await choosePhotoSource();
    if (!source) return;
    setBusy(true);
    try {
      if (await upload(source)) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (problem) {
      Alert.alert("Couldn't add that photo", problemText(problem, "Try another photo."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ marginTop: 26 }}>
      <Text style={styles.shelfTitle}>Photos</Text>
      <Text style={styles.shelfHint}>Add photos here, then ask Clay to use them, like "put the beach photo at the top of Today".</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }} style={{ marginHorizontal: -20, marginTop: 12 }}>
        <Pressable testID="add-photo" onPress={add} disabled={busy} style={[styles.photoTile, styles.photoAdd]}>
          {busy ? <ActivityIndicator color={colors.ink} /> : <SymbolView name="photo.badge.plus" size={22} tintColor={colors.ink} />}
          <Text style={styles.photoAddText}>Add</Text>
        </Pressable>
        {photos?.map((photo) => (
          <Pressable
            key={photo._id}
            testID={`photo-${photo.name}`}
            onLongPress={() =>
              Alert.alert(`Delete ${photo.name}?`, "Parts that use it will show an empty frame.", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => removePhoto({ deviceKey: key, assetId: photo._id }) },
              ])
            }
          >
            {photo.url ? <Image source={{ uri: photo.url }} style={styles.photoTile} /> : <View style={styles.photoTile} />}
            <Text numberOfLines={1} style={styles.photoName}>{photo.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function WorkspaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const key = deviceKey();
  const workspaceId = id as Id<"workspaces">;
  const workspace = useQuery(api.workspaces.get, { deviceKey: key, workspaceId });
  const update = useMutation(api.workspaces.update);
  const addComponent = useMutation(api.workspaces.addComponent);
  const remove = useMutation(api.workspaces.remove);

  if (workspace === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
        <ActivityIndicator color={colors.inkSoft} />
      </View>
    );
  }
  if (workspace === null) return <Redirect href="/" />;

  const missing = (["logo", "icon"] as const).filter((role) => !workspace.components.some((part) => part.role === role));

  const addPart = () => {
    const options = [...missing.map((role) => ROLE_LABEL[role]), "Cancel"];
    ActionSheetIOS.showActionSheetWithOptions({ title: "Add a part", options, cancelButtonIndex: options.length - 1 }, (choice) => {
      if (choice >= missing.length) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      addComponent({ deviceKey: key, workspaceId, role: missing[choice] });
    });
  };

  const more = () =>
    ActionSheetIOS.showActionSheetWithOptions({ options: ["Rename", "Delete workspace", "Cancel"], destructiveButtonIndex: 1, cancelButtonIndex: 2 }, (choice) => {
      if (choice === 0) Alert.prompt("Rename workspace", undefined, (name) => name.trim() && update({ deviceKey: key, workspaceId, name }), "plain-text", workspace.name);
      if (choice === 1)
        Alert.alert(`Delete ${workspace.name}?`, "The workspace goes away. Connected apps stay connected.", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await remove({ deviceKey: key, workspaceId });
              router.back();
            },
          },
        ]);
    });

  return (
    <ScrollView keyboardDismissMode="interactive" style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}>
      <View style={styles.topRow}>
        <Pressable testID="workspace-back" accessibilityLabel="Back" onPress={() => router.back()} style={styles.circle}>
          <SymbolView name="chevron.left" size={15} tintColor={colors.ink} weight="bold" />
        </Pressable>
        <Pressable testID="workspace-more" accessibilityLabel="More" onPress={more} style={styles.circle}>
          <SymbolView name="ellipsis" size={15} tintColor={colors.ink} weight="bold" />
        </Pressable>
      </View>

      <Animated.View entering={FadeInDown.duration(420)} style={styles.hero}>
        <View style={styles.emojiWell}>
          <Text style={{ fontSize: 30 }}>{workspace.emoji}</Text>
        </View>
        <Text style={styles.title}>{workspace.name}</Text>
      </Animated.View>

      <View style={{ gap: 16, marginTop: 24 }}>
        {workspace.components.map((part, index) => (
          <PartCard key={part._id} part={part} index={index} />
        ))}
      </View>

      <PhotoShelf workspaceId={workspaceId} />

      {missing.length > 0 && (
        <Pressable testID="add-part" onPress={addPart} style={styles.addPart}>
          <SymbolView name="plus" size={15} tintColor={colors.ink} weight="bold" />
          <Text style={styles.addText}>Add a part</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", justifyContent: "space-between" },
  circle: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  hero: { alignItems: "flex-start", marginTop: 18, gap: 10 },
  emojiWell: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 44, color: colors.ink, letterSpacing: -0.4 },
  card: { backgroundColor: colors.surface, borderRadius: 26, padding: 14, gap: 12, shadowColor: "#1A1408", shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  cardTop: { flexDirection: "row", gap: 14 },
  preview: { borderRadius: 16, overflow: "hidden" },
  role: { fontFamily: fonts.semibold, fontSize: 11, color: colors.accent, textTransform: "uppercase", letterSpacing: 1 },
  partName: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, letterSpacing: -0.2 },
  meta: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  runRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  runText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft, lineHeight: 18, marginTop: 4 },
  usageWrap: { backgroundColor: colors.canvas, borderRadius: 16, padding: 12 },
  usageLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: 1 },
  usage: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink, lineHeight: 20, marginTop: 4, padding: 0 },
  cardActions: { flexDirection: "row", gap: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 7, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.canvas },
  pillDark: { backgroundColor: colors.ink },
  pillText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  shelfTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, textTransform: "uppercase", letterSpacing: 1.1 },
  shelfHint: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft, marginTop: 6, lineHeight: 20 },
  photoTile: { width: 92, height: 92, borderRadius: 18, backgroundColor: colors.surface },
  photoAdd: { alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.muted, backgroundColor: "transparent" },
  photoAddText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  photoName: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft, marginTop: 5, width: 92 },
  addPart: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 26, marginTop: 18, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.muted },
  addText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});
