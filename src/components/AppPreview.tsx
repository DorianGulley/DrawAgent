import * as Haptics from "expo-haptics";
import { ComponentType, Ref, forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import type { IOSWebViewProps } from "react-native-webview/lib/WebViewTypes";
import { AppDoc, NodeType } from "../../shared/model";
import { buildPreviewHtml } from "../../shared/preview";
import { renderBody } from "../../shared/render";

const IOSWebView = WebView as unknown as ComponentType<IOSWebViewProps & { ref: Ref<WebView> }>;

export interface Selection {
  id: string;
  nodeType: NodeType;
  label: string;
  text: string;
}

export interface PreviewHandle {
  select(id: string | null): void;
}

interface Props {
  doc: AppDoc;
  changedIds?: string[];
  insetTop?: number;
  insetBottom?: number;
  editMode?: boolean;
  interactive?: boolean;
  onSelect?: (selection: Selection | null) => void;
  style?: StyleProp<ViewStyle>;
}

export const AppPreview = forwardRef<PreviewHandle, Props>(function AppPreview(
  { doc, changedIds = [], insetTop = 0, insetBottom = 0, editMode = false, interactive = true, onSelect, style },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const [html] = useState(() => buildPreviewHtml(doc, { insetTop, insetBottom }));
  const ready = useRef(false);
  const latest = useRef({ doc, editMode });
  latest.current = { doc, editMode };

  const run = (script: string) => webRef.current?.injectJavaScript(`${script};true;`);
  const render = (next: AppDoc, changed: string[]) =>
    run(`window.__direct.render(${JSON.stringify(renderBody(next))}, ${JSON.stringify(changed)})`);

  useImperativeHandle(ref, () => ({ select: (id) => run(`window.__direct.select(${JSON.stringify(id)})`) }));

  useEffect(() => {
    if (ready.current) render(doc, changedIds);
  }, [doc]);

  useEffect(() => {
    if (ready.current) run(`window.__direct.setEditMode(${editMode})`);
  }, [editMode]);

  const onMessage = (event: WebViewMessageEvent) => {
    const message = JSON.parse(event.nativeEvent.data);
    if (message.type === "ready") {
      ready.current = true;
      render(latest.current.doc, []);
      run(`window.__direct.setEditMode(${latest.current.editMode})`);
    } else if (message.type === "select") {
      Haptics.selectionAsync();
      onSelect?.({ id: message.id, nodeType: message.nodeType, label: message.label, text: message.text });
    } else if (message.type === "deselect") {
      onSelect?.(null);
    } else if (message.type === "haptic") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <IOSWebView
      ref={webRef}
      testID="app-preview"
      originWhitelist={["*"]}
      source={{ html, baseUrl: "https://preview.direct.app/" }}
      onMessage={onMessage}
      onShouldStartLoadWithRequest={(request) => request.url.startsWith("https://preview.direct.app/") || request.url === "about:blank"}
      onContentProcessDidTerminate={() => webRef.current?.reload()}
      scrollEnabled={interactive}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      hideKeyboardAccessoryView
      style={[{ backgroundColor: "transparent" }, style]}
    />
  );
});
