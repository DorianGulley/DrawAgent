import type { RefObject } from "react";
import { toPng } from "html-to-image";

export async function captureRef(ref: RefObject<unknown> | unknown, _options?: unknown): Promise<string> {
  const node = ref && typeof ref === "object" && "current" in ref ? ref.current : ref;
  if (!(node instanceof HTMLElement)) throw new Error("The preview isn't ready yet. Try again in a moment.");
  for (const iframe of node.querySelectorAll("iframe")) {
    try {
      if (!iframe.contentDocument?.body) throw new Error("unavailable");
    } catch {
      throw new Error("External websites can only be drawn on in the mobile app. Apps created in Clay support browser drawing.");
    }
  }
  await document.fonts.ready;
  return toPng(node, { pixelRatio: Math.min(window.devicePixelRatio || 1, 2), cacheBust: false, skipFonts: true });
}
