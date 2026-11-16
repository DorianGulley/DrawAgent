import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../theme";

export default function Settings() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.fill} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}>
      <Pressable testID="settings-back" accessibilityLabel="Back" onPress={() => router.back()} style={styles.close}>
        <SymbolView name="chevron.left" size={15} tintColor={colors.ink} weight="bold" />
      </Pressable>
      <Text style={styles.title}>Settings</Text>

      <Pressable testID="settings-style" onPress={() => router.push("/style")} style={styles.link}>
        <SymbolView name="paintpalette" size={16} tintColor={colors.ink} />
        <Text style={styles.linkText}>Your style</Text>
        <SymbolView name="chevron.right" size={12} tintColor={colors.muted} weight="semibold" />
      </Pressable>

      <View style={styles.about}>
        <Text style={styles.section}>About</Text>
        <Text style={styles.sub}>Clay shapes your apps, logos, and icons with OpenAI models. There's nothing to set up: no account and no API key.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.canvas },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  title: { fontFamily: fonts.display, fontSize: 44, color: colors.ink, letterSpacing: -0.4 },
  section: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, textTransform: "uppercase", letterSpacing: 1.1 },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft, marginTop: 6, lineHeight: 20 },
  link: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 22, padding: 16, borderRadius: 18, backgroundColor: colors.surface },
  linkText: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  about: { marginTop: 28 },
});
