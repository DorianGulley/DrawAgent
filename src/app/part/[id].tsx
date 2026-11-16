import { useQuery } from "convex/react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { deviceKey } from "../../device";
import { colors } from "../../theme";
import { DesignEditor } from "../design/[id]";

export default function PartScreen() {
  const { id, base } = useLocalSearchParams<{ id: string; base?: string }>();
  const part = useQuery(api.workspaces.component, { deviceKey: deviceKey(), componentId: id as Id<"components"> });
  if (part === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
        <ActivityIndicator color={colors.inkSoft} />
      </View>
    );
  }
  if (part === null) return <Redirect href="/" />;
  if (part.project) return <Redirect href={{ pathname: "/project/[id]", params: { id: part.project._id, ...(base ? { base } : {}) } }} />;
  return <DesignEditor key={base ?? "live"} designId={part.design!._id} componentId={part._id} base={base !== undefined ? Number(base) : undefined} />;
}
