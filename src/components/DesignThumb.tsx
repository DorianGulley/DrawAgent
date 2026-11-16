import { StyleProp, View, ViewStyle } from "react-native";
import { KindSpec } from "../../shared/kinds";
import { AppDoc } from "../../shared/model";
import { DesignCanvas } from "./DesignCanvas";

export function DesignThumb({ doc, kind, width, height, style }: { doc: AppDoc; kind: KindSpec; width: number; height: number; style?: StyleProp<ViewStyle> }) {
  if (kind.canvas.layout !== "flow") {
    return (
      <View pointerEvents="none" style={[{ width, height, overflow: "hidden" }, style]}>
        <DesignCanvas doc={doc} kind={kind} interactive={false} style={{ flex: 1 }} />
      </View>
    );
  }
  const scale = width / kind.canvas.width;
  return (
    <View pointerEvents="none" style={[{ width, height, overflow: "hidden" }, style]}>
      <View style={{ width: kind.canvas.width, height: height / scale, transform: [{ scale }], transformOrigin: "top left" }}>
        <DesignCanvas doc={doc} kind={kind} interactive={false} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
