import { ComponentType, Ref, forwardRef, useImperativeHandle, useRef } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { WebView, WebViewMessageEvent } from "./WebView";
import type { IOSWebViewProps } from "react-native-webview/lib/WebViewTypes";

const IOSWebView = WebView as unknown as ComponentType<IOSWebViewProps & { ref?: Ref<WebView> }>;

export interface Point {
  x: number;
  y: number;
}

export interface ElementInfo {
  selector: string;
  tag: string;
  text: string;
  styles: Record<string, string>;
}

export interface Probe {
  kind: "point" | "area";
  points: Point[];
}

export interface Viewport {
  width: number;
  height: number;
  scrollY: number;
  url: string;
}

export interface LiveAppHandle {
  hitTest(probes: Probe[]): Promise<ElementInfo[][]>;
  viewport(): Promise<Viewport>;
  reload(): void;
}

const HIT_TEST_SCRIPT = String.raw`
(function(){
  if (window.__direct) return;
  var STYLE_KEYS = ['color','background-color','font-size','font-weight','font-family','padding','margin','border-radius','display','width','height','text-align','gap'];
  function selectorFor(el){
    if (el.id) return '#' + CSS.escape(el.id);
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body && parts.length < 5) {
      if (el.id) { parts.unshift('#' + CSS.escape(el.id)); break; }
      var part = el.tagName.toLowerCase();
      var cls = Array.prototype.slice.call(el.classList, 0, 2).map(function(c){ return '.' + CSS.escape(c); }).join('');
      part += cls;
      var parent = el.parentElement;
      if (parent) {
        var same = Array.prototype.filter.call(parent.children, function(s){ return s.tagName === el.tagName; });
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(el) + 1) + ')';
      }
      parts.unshift(part);
      el = parent;
    }
    return parts.join(' > ');
  }
  function describe(el){
    var cs = getComputedStyle(el), styles = {};
    STYLE_KEYS.forEach(function(k){ var v = cs.getPropertyValue(k); if (v) styles[k] = v.slice(0, 120); });
    return { selector: selectorFor(el).slice(0, 300), tag: el.tagName.toLowerCase(), text: (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 200), styles: styles };
  }
  function meaningful(el){
    while (el && (el === document.documentElement || el === document.body)) return null;
    return el;
  }
  function atPoint(p){ return meaningful(document.elementFromPoint(p.x, p.y)); }
  function inArea(points){
    var xs = points.map(function(p){ return p.x; }), ys = points.map(function(p){ return p.y; });
    var box = { l: Math.min.apply(null, xs), r: Math.max.apply(null, xs), t: Math.min.apply(null, ys), b: Math.max.apply(null, ys) };
    var found = [];
    var all = document.body.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var r = all[i].getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      var inside = r.left >= box.l - 12 && r.right <= box.r + 12 && r.top >= box.t - 12 && r.bottom <= box.b + 12;
      if (inside && !found.some(function(f){ return f.contains(all[i]); })) found.push(all[i]);
    }
    if (!found.length) { var c = atPoint({ x: (box.l + box.r) / 2, y: (box.t + box.b) / 2 }); if (c) found.push(c); }
    return found.slice(0, 5);
  }
  function hit(probe){
    var els = probe.kind === 'area' ? inArea(probe.points) : probe.points.map(atPoint).filter(Boolean);
    var unique = [];
    els.forEach(function(el){ if (unique.indexOf(el) < 0) unique.push(el); });
    return unique.slice(0, 5).map(describe);
  }
  window.__direct = {
    hitTest: function(id, probes){
      var result = probes.map(hit);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'hit', id: id, result: result }));
    },
    viewport: function(id){
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'viewport', id: id, result: { width: window.innerWidth, height: window.innerHeight, scrollY: window.scrollY, url: location.href } }));
    }
  };
})();
true;
`;

interface Props {
  url: string;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  onLoadEnd?: () => void;
}

export const LiveApp = forwardRef<LiveAppHandle, Props>(function LiveApp({ url, interactive = true, style, onLoadEnd }, ref) {
  const web = useRef<WebView>(null);
  const pending = useRef(new Map<number, (value: any) => void>());
  const nextId = useRef(1);

  const call = <T,>(method: string, arg?: unknown): Promise<T> =>
    new Promise((resolve) => {
      const id = nextId.current++;
      pending.current.set(id, resolve);
      const args = arg === undefined ? String(id) : `${id}, ${JSON.stringify(arg)}`;
      web.current?.injectJavaScript(`${HIT_TEST_SCRIPT}; window.__direct.${method}(${args}); true;`);
      setTimeout(() => {
        if (pending.current.delete(id)) resolve((method === "hitTest" ? [] : null) as T);
      }, 1500);
    });

  useImperativeHandle(ref, () => ({
    hitTest: (probes) => call<ElementInfo[][]>("hitTest", probes),
    viewport: () => call<Viewport>("viewport"),
    reload: () => web.current?.reload(),
  }));

  const onMessage = (event: WebViewMessageEvent) => {
    let message: { id?: number; result?: unknown };
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    const resolve = message.id !== undefined ? pending.current.get(message.id) : undefined;
    if (!resolve) return;
    pending.current.delete(message.id!);
    resolve(message.result);
  };

  return (
    <IOSWebView
      ref={web}
      testID="live-app"
      source={{ uri: url }}
      injectedJavaScript={HIT_TEST_SCRIPT}
      onMessage={onMessage}
      onLoadEnd={onLoadEnd}
      scrollEnabled={interactive}
      pointerEvents={interactive ? "auto" : "none"}
      allowsBackForwardNavigationGestures={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      style={[{ backgroundColor: "#fff" }, style]}
    />
  );
});
