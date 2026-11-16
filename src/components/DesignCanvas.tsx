import { useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { ComponentType, Ref, RefObject, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import type { IOSWebViewProps } from "react-native-webview/lib/WebViewTypes";
import { KindSpec } from "../../shared/kinds";
import { api } from "../../convex/_generated/api";
import { AppDoc, NodeType, imageSources } from "../../shared/model";
import { buildPreviewHtml } from "../../shared/preview";
import { AssetUrls, renderBody } from "../../shared/render";
import { deviceKey } from "../device";
import type { ElementInfo, Probe } from "./LiveApp";

export interface CanvasHandle {
  hitTest(probes: Probe[]): Promise<ElementInfo[][]>;
}

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
  handle?: Ref<CanvasHandle>;
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
  handle,
  testID = "design-canvas",
  style,
}: Props) {
  const ownRef = useRef<WebView>(null);
  const webRef = viewRef ?? ownRef;
  const sources = imageSources(doc.root);
  const urls = useQuery(api.assets.urls, sources.length ? { deviceKey: deviceKey(), ids: sources } : "skip");
  const assets = useRef<AssetUrls>({});
  assets.current = urls ?? assets.current;
  const [html] = useState(() => buildPreviewHtml(doc, { insetTop, insetBottom, canvas: kind.canvas, exporting, assets: assets.current }));
  const ready = useRef(false);
  const latest = useRef({ doc, editMode, selection, selectionLabel, insetTop, insetBottom });
  useEffect(() => {
    latest.current = { doc, editMode, selection, selectionLabel, insetTop, insetBottom };
  });

  const pending = useRef(new Map<number, (result: ElementInfo[][]) => void>());
  const nextId = useRef(1);
  useImperativeHandle(handle, () => ({
    hitTest: (probes) =>
      new Promise((resolve) => {
        const requestId = nextId.current++;
        pending.current.set(requestId, resolve);
        webRef.current?.injectJavaScript(`window.__direct.hitTest(${requestId}, ${JSON.stringify(probes)});true;`);
        setTimeout(() => {
          if (pending.current.delete(requestId)) resolve(probes.map(() => []));
        }, 1500);
      }),
  }));

  const run = (script: string) => webRef.current?.injectJavaScript(`${script};true;`);
  const render = (next: AppDoc, changed: string[]) => run(`window.__direct.render(${JSON.stringify(renderBody(next, assets.current))}, ${JSON.stringify(changed)})`);
  const select = (ids: string[], label: string, focus: string | null) =>
    run(`window.__direct.setSelection(${JSON.stringify(ids)}, ${JSON.stringify(label)}, ${JSON.stringify(focus)})`);

  useEffect(() => {
    if (ready.current) render(doc, changedIds);
  }, [doc]);

  useEffect(() => {
    if (ready.current && urls) render(latest.current.doc, []);
  }, [JSON.stringify(urls ?? {})]);

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
    } else if (message.type === "hit") {
      const resolve = pending.current.get(message.requestId);
      pending.current.delete(message.requestId);
      resolve?.(message.result);
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
