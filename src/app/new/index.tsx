import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SymbolView, SFSymbol } from "../../symbols";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KINDS, KIND_ORDER } from "../../../shared/kinds";
import { colors, fonts } from "../../theme";

export default function NewDesign() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.fill} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}>
      <Pressable testID="new-close" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
        <SymbolView name="xmark" size={14} tintColor={colors.ink} weight="bold" />
      </Pressable>
      <Text style={styles.title}>What are you making?</Text>
      <Text style={styles.sub}>Pick one and start from a design you can change any way you like.</Text>
      <View style={{ gap: 14, marginTop: 24 }}>
        {KIND_ORDER.map((id, index) => {
          const kind = KINDS[id];
          return (
            <Animated.View key={id} entering={FadeInDown.delay(80 + index * 70).duration(400)}>
              <Pressable
                testID={`kind-${id}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({ pathname: "/new/[kind]", params: { kind: id } });
                }}
                style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }] }]}
              >
                <View style={styles.icon}>
                  <SymbolView name={kind.icon as SFSymbol} size={26} tintColor={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{kind.name}</Text>
                  <Text style={styles.cardText}>{kind.blurb}</Text>
                </View>
                <SymbolView name="chevron.right" size={14} tintColor={colors.muted} weight="semibold" />
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.canvas },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  title: { fontFamily: fonts.display, fontSize: 40, color: colors.ink, letterSpacing: -0.4 },
  sub: { fontFamily: fonts.regular, fontSize: 16, color: colors.inkSoft, marginTop: 8, lineHeight: 22 },
  card: { flexDirection: "row", alignItems: "center", gap: 16, padding: 18, borderRadius: 24, backgroundColor: colors.surface },
  icon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  cardText: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft, marginTop: 2, lineHeight: 19 },
});
