import { StyleProp } from "./model";
import { TEMPLATES, Template } from "./templates";

export interface KindSpec {
  id: string;
  name: string;
  plural: string;
  icon: string;
  blurb: string;
  canvas: { width: number; height: number | null; background: string; scrolls: boolean; layout: "flow" | "split" | "center" };
  chrome: "phone" | "artboard";
  ops: { text: boolean; move: boolean; structure: boolean; styles: StyleProp[] };
  templates: Template[];
  export: { label: string; transparent: boolean } | null;
}

const ALL_STYLES: StyleProp[] = ["color", "backgroundColor", "accentColor", "fontSize", "fontWeight", "padding", "gap", "borderRadius", "height", "width", "textAlign"];

export const KINDS: Record<string, KindSpec> = {
  app: {
    id: "app",
    name: "App",
    plural: "Apps",
    icon: "iphone",
    blurb: "A working phone app you can tap through.",
    canvas: { width: 390, height: null, background: "#FBF8F3", scrolls: true, layout: "flow" },
    chrome: "phone",
    ops: { text: true, move: true, structure: true, styles: ALL_STYLES.filter((p) => p !== "width") },
    templates: [TEMPLATES.habits, TEMPLATES.wanderlist, TEMPLATES.dashboard],
    export: null,
  },
  logo: {
    id: "logo",
    name: "Logo",
    plural: "Logos",
    icon: "seal",
    blurb: "A mark and wordmark on a clear background.",
    canvas: { width: 512, height: 512, background: "transparent", scrolls: false, layout: "center" },
    chrome: "artboard",
    ops: { text: true, move: true, structure: true, styles: ["color", "backgroundColor", "fontSize", "fontWeight", "gap", "borderRadius", "width", "height"] },
    templates: [TEMPLATES.sprout, TEMPLATES.monogram],
    export: { label: "Save as PNG", transparent: true },
  },
  icon: {
    id: "icon",
    name: "App icon",
    plural: "App icons",
    icon: "app.badge",
    blurb: "The square icon on the home screen.",
    canvas: { width: 512, height: 512, background: "#FFFFFF", scrolls: false, layout: "center" },
    chrome: "artboard",
    ops: { text: true, move: true, structure: true, styles: ["color", "backgroundColor", "accentColor", "fontSize", "fontWeight", "gap", "borderRadius", "width", "height"] },
    templates: [TEMPLATES.badge, TEMPLATES.glyph],
    export: { label: "Save as PNG", transparent: false },
  },
};

export const KIND_ORDER = ["app", "logo", "icon"];

export function kindOf(id: string): KindSpec {
  const kind = KINDS[id];
  if (!kind) throw new Error(`Unknown kind ${id}`);
  return kind;
}

export function findTemplate(kindId: string, templateId: string): Template {
  const template = kindOf(kindId).templates.find((t) => t.id === templateId);
  if (!template) throw new Error(`Unknown template ${templateId}`);
  return template;
}
