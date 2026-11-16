import { SymbolView } from "expo-symbols";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, space, type } from "../theme";
import { Button, Symbol } from "./Button";

interface Props {
  title: string;
  body?: string;
  icon?: Symbol;
  action?: { label: string; onPress: () => void; icon?: Symbol };
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ title, body, icon = "plus", action, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.blob}>
        <SymbolView name={icon} size={22} tintColor={colors.accent} weight="semibold" />
      </View>
      <Text style={styles.title}>{title}</Text>
      {body && <Text style={styles.body}>{body}</Text>}
      {action && <Button label={action.label} icon={action.icon} size="sm" onPress={action.onPress} style={styles.action} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: space[8], paddingHorizontal: space[6], gap: space[2] },
  blob: {
    width: 64,
    height: 58,
    marginBottom: space[1],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 26,
    borderBottomRightRadius: 32,
    borderBottomLeftRadius: 24,
  },
  title: { ...type.heading, textAlign: "center" },
  body: { ...type.callout, textAlign: "center", maxWidth: 300 },
  action: { alignSelf: "center", marginTop: space[2] },
});
