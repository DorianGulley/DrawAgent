import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
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
  const keys = useQuery(api.keys.list, { deviceKey: key });
  const projects = useQuery(api.projects.list);
  const create = useMutation(api.workspaces.create);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const [keyId, setKeyId] = useState<Id<"apiKeys"> | null>(null);
  const [source, setSource] = useState<"template" | "connected">("template");
  const [appTemplate, setAppTemplate] = useState<string | null>("habits");
  const [projectId, setProjectId] = useState<Id<"projects"> | null>(null);
  const [logo, setLogo] = useState<string | null>("sprout");
  const [icon, setIcon] = useState<string | null>("glyph");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (keys?.length && keyId === null) setKeyId(keys[0]._id);
  }, [keys?.length]);

  const ready = name.trim().length > 0 && (source === "template" ? appTemplate !== null : projectId !== null);

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const workspaceId = await create({
        deviceKey: key,
        name: name.trim(),
        emoji,
        keyId: keyId ?? undefined,
        appProjectId: source === "connected" ? projectId! : undefined,
        appTemplateId: source === "template" ? appTemplate! : undefined,
        logoTemplateId: logo ?? undefined,
        iconTemplateId: icon ?? undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: "/workspace/[id]", params: { id: workspaceId } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120, paddingHorizontal: 20 }}>
        <Pressable testID="new-workspace-close" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
          <SymbolView name="xmark" size={14} tintColor={colors.ink} weight="bold" />
        </Pressable>
        <Text style={styles.title}>New workspace</Text>
        <Text style={styles.hint}>One app and the pieces that belong to it. Clay keeps every version of each.</Text>

        <View style={styles.nameRow}>
          <View style={styles.emojiWell}>
            <Text style={{ fontSize: 26 }}>{emoji}</Text>
          </View>
          <TextInput testID="workspace-name" value={name} onChangeText={setName} placeholder="Name it" placeholderTextColor={colors.muted} style={styles.nameInput} autoFocus maxLength={40} />
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
            {(["template", "connected"] as const).map((item) => (
              <Pressable key={item} testID={`source-${item}`} onPress={() => setSource(item)} style={[styles.segmentItem, source === item && styles.segmentOn]}>
                <Text style={[styles.segmentText, source === item && styles.segmentTextOn]}>{item === "template" ? "Start from a design" : "A connected app"}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ marginTop: 12 }}>
            {source === "template" ? (
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

        <Section title="Model key" hint="Clay uses this key when you mark up a logo or icon in this workspace.">
          {keys === undefined ? (
            <ActivityIndicator color={colors.inkSoft} />
          ) : (
            <View style={{ gap: 8 }}>
              {keys.map((item) => (
                <Pressable key={item._id} testID={`pick-key-${item.provider}`} onPress={() => setKeyId(item._id)} style={[styles.row, keyId === item._id && styles.tileOn]}>
                  <View style={styles.providerBadge}>
                    <Text style={styles.providerLetter}>{item.provider === "openai" ? "O" : "A"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.label}</Text>
                    <Text style={styles.rowMeta}>•••• {item.last4} · {item.model}</Text>
                  </View>
                  {keyId === item._id && <SymbolView name="checkmark.circle.fill" size={20} tintColor={colors.accent} />}
                </Pressable>
              ))}
              <Pressable testID="add-key" onPress={() => router.push("/settings")} style={styles.row}>
                <SymbolView name="key" size={16} tintColor={colors.ink} />
                <Text style={[styles.rowTitle, { flex: 1 }]}>{keys.length ? "Add another key" : "Add an OpenAI or Anthropic key"}</Text>
                <SymbolView name="chevron.right" size={12} tintColor={colors.muted} weight="semibold" />
              </Pressable>
            </View>
          )}
        </Section>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable testID="create-workspace" onPress={submit} style={[styles.create, (!ready || busy) && { opacity: 0.4 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.createText}>Create workspace</Text>}
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
  providerBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  providerLetter: { fontFamily: fonts.bold, fontSize: 15, color: "#fff" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.canvas },
  create: { height: 54, borderRadius: 27, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  createText: { fontFamily: fonts.semibold, fontSize: 16, color: "#fff" },
});
