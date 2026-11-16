import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { CATEGORY_CHOICES, StyleCategory } from "../../shared/style";
import { deviceKey } from "../device";
import { colors, fonts } from "../theme";

export default function YourStyle() {
  const insets = useSafeAreaInsets();
  const key = deviceKey();
  const data = useQuery(api.style.get, { deviceKey: key });
  const setPreference = useMutation(api.style.setPreference);
  const remove = useMutation(api.style.remove);
  const reset = useMutation(api.style.reset);
  const [editing, setEditing] = useState<StyleCategory | null>(null);

  const confirmReset = () =>
    Alert.alert("Start fresh?", "Clay forgets everything it learned about your style.", [
      { text: "Cancel", style: "cancel" },
      { text: "Forget it all", style: "destructive", onPress: () => reset({ deviceKey: key }) },
    ]);

  return (
    <ScrollView style={styles.fill} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}>
      <Pressable testID="style-back" accessibilityLabel="Back" onPress={() => router.back()} style={styles.close}>
        <SymbolView name="chevron.left" size={15} tintColor={colors.ink} weight="bold" />
      </Pressable>
      <Text style={styles.title}>Your style</Text>
      <Text style={styles.sub}>
        Clay learns from the changes you keep. New designs start this way, and “Use my style” applies it in one tap. Anything you ask for directly always wins.
      </Text>

      {!data ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.inkSoft} />
      ) : data.entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing learned yet</Text>
          <Text style={styles.emptyText}>Round some corners, pick a color, or change the spacing in any design. Your preferences show up here.</Text>
        </View>
      ) : (
        <View style={{ gap: 12, marginTop: 22 }}>
          {data.entries.map((entry, index) => (
            <Animated.View key={entry.category} entering={FadeInDown.delay(index * 50).duration(300)} layout={LinearTransition}>
              <View testID={`pref-${entry.category}`} style={styles.card}>
                <View style={styles.cardRow}>
                  {typeof entry.value === "string" && <View style={[styles.dot, { backgroundColor: entry.value }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardLabel}>{entry.label}</Text>
                    <Text testID={`pref-${entry.category}-text`} style={styles.cardText}>{entry.description}</Text>
                    <Text style={styles.cardMeta}>{entry.chosen ? "You chose this" : `Learned from ${entry.evidence} change${entry.evidence === 1 ? "" : "s"}`}</Text>
                  </View>
                  <Pressable testID={`pref-${entry.category}-edit`} accessibilityLabel={`Change ${entry.label}`} onPress={() => setEditing(editing === entry.category ? null : entry.category)} style={styles.iconButton}>
                    <SymbolView name="slider.horizontal.3" size={14} tintColor={colors.ink} />
                  </Pressable>
                  <Pressable
                    testID={`pref-${entry.category}-delete`}
                    accessibilityLabel={`Forget ${entry.label}`}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      remove({ deviceKey: key, category: entry.category });
                    }}
                    style={styles.iconButton}
                  >
                    <SymbolView name="trash" size={14} tintColor={colors.danger} />
                  </Pressable>
                </View>
                {editing === entry.category && (
                  <Animated.View entering={FadeIn.duration(160)} style={styles.choices}>
                    {CATEGORY_CHOICES[entry.category].map((choice) => (
                      <Pressable
                        key={String(choice)}
                        testID={`pref-${entry.category}-choice-${choice}`}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setPreference({ deviceKey: key, category: entry.category, value: choice });
                        }}
                        style={[
                          typeof choice === "string" ? [styles.swatch, { backgroundColor: choice }] : styles.choice,
                          choice === entry.value && styles.choiceOn,
                        ]}
                      >
                        {typeof choice === "number" && <Text style={styles.choiceText}>{choice === 999 ? "Pill" : String(choice)}</Text>}
                      </Pressable>
                    ))}
                  </Animated.View>
                )}
              </View>
            </Animated.View>
          ))}
          <Pressable testID="style-reset" onPress={confirmReset} style={styles.reset}>
            <Text style={styles.resetText}>Forget my style and start fresh</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.canvas },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  title: { fontFamily: fonts.display, fontSize: 44, color: colors.ink, letterSpacing: -0.4 },
  sub: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft, marginTop: 8, lineHeight: 21 },
  empty: { marginTop: 24, padding: 20, borderRadius: 22, backgroundColor: colors.surface, gap: 6 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  emptyText: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft, lineHeight: 21 },
  card: { padding: 16, borderRadius: 20, backgroundColor: colors.surface, gap: 12 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  cardLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  cardText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, marginTop: 2 },
  cardMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 3 },
  iconButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.canvas, borderWidth: 2, borderColor: "transparent" },
  choiceOn: { borderColor: colors.accent, borderWidth: 2 },
  choiceText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.line },
  reset: { alignItems: "center", padding: 16, marginTop: 8 },
  resetText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger },
});
