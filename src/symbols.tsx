import { SymbolView as ExpoSymbolView, type SymbolViewProps } from "expo-symbols";

export type { SymbolViewProps, SFSymbol } from "expo-symbols";
type AndroidSymbol = NonNullable<Exclude<SymbolViewProps["name"], string>["web"]>;

const names: Record<string, AndroidSymbol> = {
  "chevron.left": "chevron_left", "chevron.right": "chevron_right", "chevron.down": "expand_more",
  "arrow.up.right": "north_east", "arrow.right": "arrow_forward", "arrow.up": "arrow_upward",
  "arrow.uturn.backward": "undo", "square.and.arrow.up": "ios_share", "square.and.arrow.down": "download",
  "clock.arrow.trianglehead.counterclockwise.rotate.90": "history", "gearshape.fill": "settings", globe: "language",
  paintpalette: "palette", plus: "add", minus: "remove", xmark: "close", checkmark: "check",
  "checkmark.circle.fill": "check_circle", "exclamationmark.triangle.fill": "warning",
  "pencil.tip.crop.circle": "draw", "slider.horizontal.3": "tune", sparkles: "auto_awesome", "wand.and.stars": "auto_fix_high",
  "photo.badge.plus": "add_photo_alternate", "paperplane.fill": "send", "list.bullet": "format_list_bulleted",
  ellipsis: "more_horiz", trash: "delete", pencil: "edit", circle: "circle", arrowshape: "arrow_forward",
  scribble: "gesture", "circle.dashed": "radio_button_unchecked", textformat: "text_fields",
  iphone: "smartphone", seal: "verified", "app.badge": "apps",
};

export function SymbolView({ name, ...props }: SymbolViewProps) {
  const resolved = typeof name === "string" ? { ios: name, web: names[name] ?? "circle", android: names[name] ?? "circle" } : name;
  return <ExpoSymbolView {...props} name={resolved} />;
}
