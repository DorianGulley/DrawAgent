import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View } from "react-native";
import type { WebViewMessageEvent, WebViewProps } from "react-native-webview";
export type { WebViewMessageEvent } from "react-native-webview";

export const WebView = forwardRef(function BrowserWebView({ source, style, onMessage, onLoadEnd, pointerEvents, testID, injectedJavaScript }: WebViewProps, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const messageHandler = useRef(onMessage);
  useEffect(() => { messageHandler.current = onMessage; }, [onMessage]);
  const html = source && "html" in source ? source.html : undefined;
  const uri = source && "uri" in source ? source.uri : undefined;
  const srcDoc = useMemo(() => html?.replace("<head>", `<head><script>window.ReactNativeWebView={postMessage:function(data){window.parent.postMessage({clayPreview:true,data:data},'*')}};</script>`), [html]);

  const injectJavaScript = (script: string) => {
    try {
      const doc = frame.current?.contentDocument;
      if (!doc?.body) return;
      const element = doc.createElement("script"); element.textContent = script; doc.body.appendChild(element); element.remove();
    } catch { /* Cross-origin connected websites are view-only in browsers. */ }
  };
  useImperativeHandle(ref, () => ({ injectJavaScript, reload: () => { if (frame.current) frame.current.src = frame.current.src; } }));
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.clayPreview !== true || typeof event.data.data !== "string") return;
      messageHandler.current?.({ nativeEvent: { data: event.data.data } } as WebViewMessageEvent);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  return (
    <View testID={testID} style={[{ overflow: "hidden" }, style]} pointerEvents={pointerEvents}>
      <iframe ref={frame} title="App preview" srcDoc={srcDoc} src={srcDoc ? undefined : uri} sandbox="allow-scripts allow-same-origin allow-forms" referrerPolicy="no-referrer" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, background: "transparent", pointerEvents: pointerEvents === "none" ? "none" : "auto" }} onLoad={() => { if (injectedJavaScript) injectJavaScript(injectedJavaScript); onLoadEnd?.({ nativeEvent: {} } as Parameters<NonNullable<WebViewProps["onLoadEnd"]>>[0]); }} />
    </View>
  );
});
