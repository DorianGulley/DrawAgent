import { useAction, useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { deviceKey } from "../device";
import { colors, fonts } from "../theme";

const PROVIDERS = [
  { id: "openai", name: "OpenAI", hint: "sk-…" },
  { id: "anthropic", name: "Anthropic", hint: "sk-ant-…" },
] as const;

export default function Settings() {
  const insets = useSafeAreaInsets();
  const key = deviceKey();
  const keys = useQuery(api.keys.list, { deviceKey: key });
  const addKey = useAction(api.keys.add);
  const removeKey = useMutation(api.keys.remove);
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!secret.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addKey({ deviceKey: key, provider, apiKey: secret.trim(), label: label.trim() || undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSecret("");
      setLabel("");
    } catch (problem) {
      const message = problem instanceof Error ? problem.message.replace(/^.*Uncaught Error: /s, "").split("\n")[0] : "Couldn't save that key";
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = (id: Parameters<typeof removeKey>[0]["keyId"], name: string) =>
    Alert.alert(`Remove ${name}?`, "Workspaces using it will need another key before Clay can edit their parts.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeKey({ deviceKey: key, keyId: id }) },
    ]);

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.fill}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}>
        <Pressable testID="settings-back" accessibilityLabel="Back" onPress={() => router.back()} style={styles.close}>
          <SymbolView name="chevron.left" size={15} tintColor={colors.ink} weight="bold" />
        </Pressable>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.section}>Model keys</Text>
        <Text style={styles.sub}>Clay uses your own OpenAI or Anthropic key to reshape logos, icons, and other parts. Keys are encrypted on Clay's server and never shown again after you save them.</Text>

        <View style={{ gap: 10, marginTop: 14 }}>
          {keys?.map((item, index) => (
            <Animated.View key={item._id} entering={FadeInDown.delay(index * 40)} layout={LinearTransition}>
              <View testID={`key-${item.provider}`} style={styles.keyRow}>
                <View style={styles.providerBadge}>
                  <Text style={styles.providerLetter}>{item.provider === "openai" ? "O" : "A"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.keyName}>{item.label}</Text>
                  <Text style={styles.keyMeta}>•••• {item.last4} · uses {item.model}</Text>
                </View>
                <Pressable testID={`key-remove-${item.provider}`} accessibilityLabel={`Remove ${item.label}`} onPress={() => confirmRemove(item._id, item.label)} style={styles.iconButton}>
                  <SymbolView name="trash" size={14} tintColor={colors.danger} />
                </Pressable>
              </View>
            </Animated.View>
          ))}
          {keys?.length === 0 && <Text style={styles.empty}>No keys yet.</Text>}
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Add a key</Text>
          <View style={styles.segment}>
            {PROVIDERS.map((item) => (
              <Pressable key={item.id} testID={`provider-${item.id}`} onPress={() => setProvider(item.id)} style={[styles.segmentItem, provider === item.id && styles.segmentOn]}>
                <Text style={[styles.segmentText, provider === item.id && styles.segmentTextOn]}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            testID="key-input"
            value={secret}
            onChangeText={setSecret}
            placeholder={PROVIDERS.find((item) => item.id === provider)!.hint}
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <TextInput testID="key-label" value={label} onChangeText={setLabel} placeholder="Name (optional), e.g. Work" placeholderTextColor={colors.muted} style={styles.input} />
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable testID="key-save" onPress={save} style={[styles.save, (!secret.trim() || busy) && { opacity: 0.4 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Check and save</Text>}
          </Pressable>
        </View>

        <Pressable testID="settings-style" onPress={() => router.push("/style")} style={styles.link}>
          <SymbolView name="paintpalette" size={16} tintColor={colors.ink} />
          <Text style={styles.linkText}>Your style</Text>
          <SymbolView name="chevron.right" size={12} tintColor={colors.muted} weight="semibold" />
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.canvas },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  title: { fontFamily: fonts.display, fontSize: 44, color: colors.ink, letterSpacing: -0.4 },
  section: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, textTransform: "uppercase", letterSpacing: 1.1, marginTop: 22 },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft, marginTop: 6, lineHeight: 20 },
  keyRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.surface },
  providerBadge: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  providerLetter: { fontFamily: fonts.bold, fontSize: 16, color: "#fff" },
  keyName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  keyMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginTop: 2 },
  iconButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  empty: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  form: { marginTop: 18, padding: 16, borderRadius: 22, backgroundColor: colors.surface, gap: 10 },
  formTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  segment: { flexDirection: "row", backgroundColor: colors.canvas, borderRadius: 14, padding: 3 },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 11 },
  segmentOn: { backgroundColor: colors.surface },
  segmentText: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkSoft },
  segmentTextOn: { fontFamily: fonts.semibold, color: colors.ink },
  input: { backgroundColor: colors.canvas, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.danger },
  save: { height: 48, borderRadius: 16, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  saveText: { fontFamily: fonts.semibold, fontSize: 15, color: "#fff" },
  link: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: colors.surface },
  linkText: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});
