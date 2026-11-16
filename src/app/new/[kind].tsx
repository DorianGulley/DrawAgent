import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "../../symbols";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { kindOf } from "../../../shared/kinds";
import { DesignThumb } from "../../components/DesignThumb";
import { deviceKey } from "../../device";
import { colors, fonts } from "../../theme";

export default function TemplateGallery() {
  const { kind: kindId } = useLocalSearchParams<{ kind: string }>();
  const kind = kindOf(kindId);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const create = useMutation(api.designs.create);
  const memory = useQuery(api.style.get, { deviceKey: deviceKey() });
  const [busy, setBusy] = useState<string | null>(null);
  const cardWidth = (width - 54) / 2;
  const thumbHeight = kind.canvas.height ? Math.min(300, cardWidth * (kind.canvas.height / kind.canvas.width)) : 300;

  const start = async (templateId: string) => {
    if (busy) return;
    setBusy(templateId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { designId } = await create({ deviceKey: deviceKey(), kind: kind.id, templateId });
      router.dismissAll();
      router.push({ pathname: "/design/[id]", params: { id: designId } });
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView style={styles.fill} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}>
      <Pressable testID="gallery-back" accessibilityLabel="Back" onPress={() => router.back()} style={styles.close}>
        <SymbolView name="chevron.left" size={15} tintColor={colors.ink} weight="bold" />
      </Pressable>
      <Text style={styles.title}>Pick {/^[aeiou]/i.test(kind.name) ? "an" : "a"} {kind.name.toLowerCase()} to start from</Text>
      <Text style={styles.sub}>
        {memory?.entries.length ? "It opens with your style already applied." : "You can change every part of it after."}
      </Text>
      <View style={styles.grid}>
        {kind.templates.map((template, index) => (
          <Animated.View key={template.id} entering={FadeInDown.delay(80 + index * 70).duration(400)}>
            <Pressable testID={`template-${template.id}`} onPress={() => start(template.id)} style={({ pressed }) => [styles.card, { width: cardWidth }, pressed && { transform: [{ scale: 0.98 }] }]}>
              <DesignThumb doc={template.doc} kind={kind} width={cardWidth} height={thumbHeight} style={styles.thumb} />
              <View style={styles.footer}>
                <Text style={styles.cardTitle}>{template.emoji} {template.name}</Text>
                <Text style={styles.cardText}>{template.tagline}</Text>
              </View>
              {busy === template.id && (
                <View style={styles.busy}>
                  <ActivityIndicator color={colors.ink} />
                </View>
              )}
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.canvas },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  title: { fontFamily: fonts.display, fontSize: 36, color: colors.ink, letterSpacing: -0.4, lineHeight: 40 },
  sub: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft, marginTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 22 },
  card: { borderRadius: 22, backgroundColor: colors.surface, overflow: "hidden" },
  thumb: { backgroundColor: "#ECE8E0" },
  footer: { padding: 12 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  cardText: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  busy: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(255,255,255,0.6)", alignItems: "center", justifyContent: "center" },
});
