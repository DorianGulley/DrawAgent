import * as Haptics from "expo-haptics";
import { ComponentType, Ref, RefObject, useEffect, useRef, useState } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import type { IOSWebViewProps } from "react-native-webview/lib/WebViewTypes";
import { KindSpec } from "../../shared/kinds";
import { AppDoc, NodeType } from "../../shared/model";
import { buildPreviewHtml } from "../../shared/preview";
import { renderBody } from "../../shared/render";

const IOSWebView = WebView as unknown as ComponentType<IOSWebViewProps & { ref: Ref<WebView> }>;

export interface Picked {
  id: string;
  nodeType: NodeType;
  label: string;
  text: string;
}

interface Props {
  doc: AppDoc;
  kind: KindSpec;
  changedIds?: string[];
  editMode?: boolean;
  selection?: string[];
  selectionLabel?: string;
  focusId?: string | null;
  insetTop?: number;
  insetBottom?: number;
  interactive?: boolean;
  exporting?: boolean;
  onTap?: (picked: Picked) => void;
  onLongPress?: (picked: Picked) => void;
  onReady?: () => void;
  viewRef?: RefObject<WebView | null>;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function DesignCanvas({
  doc,
  kind,
  changedIds = [],
  editMode = false,
  selection = [],
  selectionLabel = "",
  focusId = null,
  insetTop = 0,
  insetBottom = 0,
  interactive = true,
  exporting = false,
  onTap,
  onLongPress,
  onReady,
  viewRef,
  testID = "design-canvas",
  style,
}: Props) {
  const ownRef = useRef<WebView>(null);
  const webRef = viewRef ?? ownRef;
  const [html] = useState(() => buildPreviewHtml(doc, { insetTop, insetBottom, canvas: kind.canvas, exporting }));
  const ready = useRef(false);
  const latest = useRef({ doc, editMode, selection, selectionLabel, insetTop, insetBottom });
  useEffect(() => {
    latest.current = { doc, editMode, selection, selectionLabel, insetTop, insetBottom };
  });

  const run = (script: string) => webRef.current?.injectJavaScript(`${script};true;`);
  const render = (next: AppDoc, changed: string[]) => run(`window.__direct.render(${JSON.stringify(renderBody(next))}, ${JSON.stringify(changed)})`);
  const select = (ids: string[], label: string, focus: string | null) =>
    run(`window.__direct.setSelection(${JSON.stringify(ids)}, ${JSON.stringify(label)}, ${JSON.stringify(focus)})`);

  useEffect(() => {
    if (ready.current) render(doc, changedIds);
  }, [doc]);

  useEffect(() => {
    if (ready.current) run(`window.__direct.setEditMode(${editMode})`);
  }, [editMode]);

  useEffect(() => {
    if (ready.current) select(selection, selectionLabel, focusId);
  }, [selection.join("|"), selectionLabel]);

  useEffect(() => {
    if (ready.current) run(`window.__direct.setFrame(${insetTop}, ${insetBottom})`);
  }, [insetTop, insetBottom]);

  const onMessage = (event: WebViewMessageEvent) => {
    const message = JSON.parse(event.nativeEvent.data);
    const picked = { id: message.id, nodeType: message.nodeType, label: message.label, text: message.text };
    if (message.type === "ready") {
      ready.current = true;
      const current = latest.current;
      render(current.doc, []);
      run(`window.__direct.setFrame(${current.insetTop}, ${current.insetBottom})`);
      run(`window.__direct.setEditMode(${current.editMode})`);
      select(current.selection, current.selectionLabel, null);
      onReady?.();
    } else if (message.type === "tap") {
      Haptics.selectionAsync();
      onTap?.(picked);
    } else if (message.type === "longpress") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      onLongPress?.(picked);
    } else if (message.type === "haptic") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <IOSWebView
      ref={webRef}
      testID={testID}
      originWhitelist={["*"]}
      source={{ html, baseUrl: "https://preview.direct.app/" }}
      onMessage={onMessage}
      onShouldStartLoadWithRequest={(request) => request.url.startsWith("https://preview.direct.app/") || request.url === "about:blank"}
      onContentProcessDidTerminate={() => webRef.current?.reload()}
      scrollEnabled={interactive && kind.canvas.scrolls}
      pointerEvents={interactive ? "auto" : "none"}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      hideKeyboardAccessoryView
      style={[{ backgroundColor: "transparent" }, style]}
    />
  );
}
