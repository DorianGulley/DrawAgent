import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { KINDS } from "../../../shared/kinds";
import { DesignThumb } from "../../components/DesignThumb";
import { deviceKey } from "../../device";
import { colors, fonts } from "../../theme";

const EMOJI = ["🏺", "🌱", "🧭", "☀️", "🍋", "🪐", "🎧", "📚"];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 26 }}>
      <Text style={styles.section}>{title}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  );
}

function TemplateRow({ kindId, value, onChange, optional }: { kindId: string; value: string | null; onChange: (id: string | null) => void; optional?: boolean }) {
  const kind = KINDS[kindId];
  const size = kind.canvas.layout === "flow" ? { width: 110, height: 170 } : { width: 110, height: 110 };
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}>
      {optional && (
        <Pressable testID={`${kindId}-none`} onPress={() => onChange(null)} style={[styles.tile, { width: size.width }, value === null && styles.tileOn]}>
          <View style={[styles.none, size]}>
            <SymbolView name="minus" size={18} tintColor={colors.muted} />
          </View>
          <Text style={styles.tileName}>Skip</Text>
        </Pressable>
      )}
      {kind.templates.map((template) => (
        <Pressable key={template.id} testID={`${kindId}-${template.id}`} onPress={() => onChange(template.id)} style={[styles.tile, { width: size.width }, value === template.id && styles.tileOn]}>
          <DesignThumb doc={template.doc} kind={kind} width={size.width} height={size.height} style={{ backgroundColor: "#ECE8E0", borderRadius: 14 }} />
          <Text numberOfLines={1} style={styles.tileName}>{template.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default function NewWorkspace() {
  const insets = useSafeAreaInsets();
  const key = deviceKey();
  const projects = useQuery(api.projects.list);
  const create = useMutation(api.workspaces.create);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const [source, setSource] = useState<"prompt" | "template" | "connected">("prompt");
  const [prompt, setPrompt] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [appTemplate, setAppTemplate] = useState<string | null>("habits");
  const [projectId, setProjectId] = useState<Id<"projects"> | null>(null);
  const [logo, setLogo] = useState<string | null>("sprout");
  const [icon, setIcon] = useState<string | null>("glyph");
  const [busy, setBusy] = useState(false);

  const ready =
    name.trim().length > 0 &&
    (source === "prompt" ? prompt.trim().length >= 8 : source === "template" ? appTemplate !== null : projectId !== null);

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const workspaceId = await create({
        deviceKey: key,
        name: name.trim(),
        emoji,
        appProjectId: source === "connected" ? projectId! : undefined,
        appTemplateId: source === "template" ? appTemplate! : undefined,
        appPrompt: source === "prompt" ? prompt.trim() : undefined,
        logoTemplateId: logo ?? undefined,
        iconTemplateId: icon ?? undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: "/workspace/[id]", params: { id: workspaceId } });
    } catch (error) {
      setProblem(error instanceof Error ? error.message.replace(/^.*Uncaught Error: /s, "").split("\n")[0] : "Couldn't create the workspace");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120, paddingHorizontal: 20 }}>
        <Pressable testID="new-workspace-close" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
          <SymbolView name="xmark" size={14} tintColor={colors.ink} weight="bold" />
        </Pressable>
        <Text style={styles.title}>New workspace</Text>
        <Text style={styles.hint}>One app and the pieces that belong to it. Clay keeps every version of each.</Text>

        <View style={styles.nameRow}>
          <View style={styles.emojiWell}>
            <Text style={{ fontSize: 26 }}>{emoji}</Text>
          </View>
          <TextInput testID="workspace-name" value={name} onChangeText={setName} placeholder="Name it" placeholderTextColor={colors.muted} style={styles.nameInput} autoFocus maxLength={40} returnKeyType="done" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginTop: 12 }}>
          {EMOJI.map((item) => (
            <Pressable key={item} onPress={() => setEmoji(item)} style={[styles.emojiChip, emoji === item && styles.tileOn]}>
              <Text style={{ fontSize: 20 }}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Section title="The app">
          <View style={styles.segment}>
            {(["prompt", "template", "connected"] as const).map((item) => (
              <Pressable key={item} testID={`source-${item}`} onPress={() => setSource(item)} style={[styles.segmentItem, source === item && styles.segmentOn]}>
                <Text style={[styles.segmentText, source === item && styles.segmentTextOn]}>{item === "prompt" ? "Describe it" : item === "template" ? "A template" : "Connected"}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ marginTop: 12 }}>
            {source === "prompt" ? (
              <View>
                <TextInput
                  testID="app-prompt"
                  value={prompt}
                  onChangeText={setPrompt}
                  placeholder="A habit tracker for runners with weekly goals, a training plan, and a page to compare streaks with friends"
                  placeholderTextColor={colors.muted}
                  multiline
                  maxLength={1200}
                  returnKeyType="done"
                  submitBehavior="blurAndSubmit"
                  style={styles.prompt}
                />
                <Text style={styles.hint}>Clay designs a multipage app from this. Then mark it up to change anything.</Text>
              </View>
            ) : source === "template" ? (
              <TemplateRow kindId="app" value={appTemplate} onChange={setAppTemplate} />
            ) : projects === undefined ? (
              <ActivityIndicator color={colors.inkSoft} />
            ) : projects.length === 0 ? (
              <Text style={styles.hint}>No connected apps yet. Run direct init in your project, then come back.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {projects.map((project) => (
                  <Pressable key={project._id} testID={`connect-${project.name}`} onPress={() => setProjectId(project._id)} style={[styles.row, projectId === project._id && styles.tileOn]}>
                    <Text style={{ fontSize: 20 }}>{project.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{project.name}</Text>
                      <Text numberOfLines={1} style={styles.rowMeta}>{project.url.replace(/^https?:\/\//, "")}</Text>
                    </View>
                    {projectId === project._id && <SymbolView name="checkmark.circle.fill" size={20} tintColor={colors.accent} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </Section>

        <Section title="Logo">
          <TemplateRow kindId="logo" value={logo} onChange={setLogo} optional />
        </Section>

        <Section title="App icon">
          <TemplateRow kindId="icon" value={icon} onChange={setIcon} optional />
        </Section>

      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {problem && <Text style={styles.problem}>{problem}</Text>}
        <Pressable testID="create-workspace" onPress={submit} style={[styles.create, (!ready || busy) && { opacity: 0.4 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.createText}>{source === "prompt" ? "Build it" : "Create workspace"}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  title: { fontFamily: fonts.display, fontSize: 42, color: colors.ink, letterSpacing: -0.4 },
  section: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, textTransform: "uppercase", letterSpacing: 1.1 },
  hint: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft, marginTop: 6, lineHeight: 20 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 22 },
  emojiWell: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  nameInput: { flex: 1, fontFamily: fonts.display, fontSize: 32, color: colors.ink, paddingVertical: 6 },
  emojiChip: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  tile: { gap: 6, padding: 4, borderRadius: 18, borderWidth: 2, borderColor: "transparent" },
  tileOn: { borderColor: colors.accent },
  tileName: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, paddingHorizontal: 4, paddingBottom: 2 },
  none: { borderRadius: 14, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  segment: { flexDirection: "row", backgroundColor: colors.line, borderRadius: 14, padding: 3 },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 11 },
  segmentOn: { backgroundColor: colors.surface },
  segmentText: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkSoft },
  segmentTextOn: { fontFamily: fonts.semibold, color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 2, borderColor: "transparent" },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  rowMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginTop: 2 },
  prompt: { minHeight: 120, backgroundColor: colors.surface, borderRadius: 18, padding: 14, paddingTop: 14, fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.ink, textAlignVertical: "top" },
  problem: { fontFamily: fonts.medium, fontSize: 13, color: colors.danger, marginBottom: 8, textAlign: "center" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.canvas },
  create: { height: 54, borderRadius: 27, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  createText: { fontFamily: fonts.semibold, fontSize: 16, color: "#fff" },
});
