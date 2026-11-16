import { contrast, nearestColorName, readableOn } from "./colors";
import { KindSpec } from "./kinds";
import { AppDoc, AppNode, NodeType, StyleProp, effectiveStyle, findNode, allNodes } from "./model";
import { Operation, mergeOperations } from "./operations";

export const STYLE_CATEGORIES = ["radius", "padding", "gap", "weight", "accent", "surface"] as const;
export type StyleCategory = (typeof STYLE_CATEGORIES)[number];
export type StyleValue = number | string;
export type Tallies = Partial<Record<StyleCategory, StyleValue[]>>;
export type Profile = Partial<Record<StyleCategory, StyleValue>>;

export interface StyleMemory {
  tallies: Tallies;
  overrides: Profile;
}

export const EMPTY_MEMORY: StyleMemory = { tallies: {}, overrides: {} };

const MAX_TALLY = 40;
const RADIUS_TYPES: NodeType[] = ["card", "button", "habit", "stat", "shape"];
const PADDED_TYPES: NodeType[] = ["card", "habit", "stat"];
const GAP_TYPES: NodeType[] = ["screen", "section", "grid", "row", "card", "statGroup"];
const WEIGHT_TYPES: NodeType[] = ["heading", "clock"];
const SURFACE_TYPES: NodeType[] = ["card", "habit", "stat"];
const NUMERIC: StyleCategory[] = ["radius", "padding", "gap", "weight"];

export const CATEGORY_LABELS: Record<StyleCategory, string> = {
  radius: "Corners",
  padding: "Padding inside cards",
  gap: "Space between things",
  weight: "Heading weight",
  accent: "Accent color",
  surface: "Card color",
};

export const CATEGORY_CHOICES: Record<StyleCategory, StyleValue[]> = {
  radius: [0, 8, 16, 24, 32, 999],
  padding: [8, 12, 16, 20, 24, 32],
  gap: [6, 10, 14, 18, 24, 32],
  weight: [400, 500, 600, 700, 800, 900],
  accent: ["#635BFF", "#16A34A", "#F97316", "#EF4444", "#0EA5E9", "#EC4899", "#111111", "#C9A227"],
  surface: ["#FFFFFF", "#FFF8EC", "#FFE7D6", "#E8F1FF", "#EAF7EF", "#F3EEFF", "#1F2A44", "#111111"],
};

function categoryOf(node: AppNode, prop: StyleProp): StyleCategory | null {
  if (prop === "borderRadius" && RADIUS_TYPES.includes(node.type)) return "radius";
  if (prop === "padding" && PADDED_TYPES.includes(node.type)) return "padding";
  if (prop === "gap" && GAP_TYPES.includes(node.type)) return "gap";
  if (prop === "fontWeight" && WEIGHT_TYPES.includes(node.type)) return "weight";
  if (prop === "accentColor" && node.type !== "screen") return "accent";
  if (prop === "backgroundColor" && ["button", "shape", "badge"].includes(node.type)) return "accent";
  if (prop === "backgroundColor" && SURFACE_TYPES.includes(node.type)) return "surface";
  return null;
}

export function tallyOperations(memory: StyleMemory, doc: AppDoc, operations: Operation[]): StyleMemory {
  const tallies: Tallies = { ...memory.tallies };
  for (const operation of operations) {
    if (operation.op !== "setStyle") continue;
    const node = operation.targets.map((id) => findNode(doc.root, id)).find(Boolean);
    const category = node && categoryOf(node, operation.prop);
    if (!category) continue;
    const value = operation.value;
    if (typeof value === "string" && value.length === 9 && value.endsWith("00")) continue;
    tallies[category] = [...(tallies[category] ?? []), value].slice(-MAX_TALLY);
  }
  return { ...memory, tallies };
}

export function untallyOperations(memory: StyleMemory, doc: AppDoc, operations: Operation[]): StyleMemory {
  const tallies: Tallies = { ...memory.tallies };
  for (const operation of operations) {
    if (operation.op !== "setStyle") continue;
    const node = operation.targets.map((id) => findNode(doc.root, id)).find(Boolean);
    const category = node && categoryOf(node, operation.prop);
    const values = category ? tallies[category] : undefined;
    if (!category || !values) continue;
    const index = values.lastIndexOf(operation.value);
    if (index === -1) continue;
    tallies[category] = [...values.slice(0, index), ...values.slice(index + 1)];
    if (tallies[category]!.length === 0) delete tallies[category];
  }
  return { ...memory, tallies };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function mode(values: StyleValue[]): StyleValue {
  const counts = new Map<StyleValue, number>();
  let best = values[values.length - 1];
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  for (let i = values.length - 1; i >= 0; i--) if (counts.get(values[i])! > counts.get(best)!) best = values[i];
  return best;
}

export function profileOf(memory: StyleMemory): Profile {
  const profile: Profile = {};
  for (const category of STYLE_CATEGORIES) {
    const override = memory.overrides[category];
    const values = memory.tallies[category] ?? [];
    if (override !== undefined) profile[category] = override;
    else if (values.length > 0)
      profile[category] = category === "weight" ? mode(values) : NUMERIC.includes(category) ? median(values as number[]) : mode(values);
  }
  return profile;
}

export function describePreference(category: StyleCategory, value: StyleValue): string {
  const n = Number(value);
  switch (category) {
    case "radius":
      if (n >= 999) return "Pill-shaped corners";
      if (n === 0) return "Square corners";
      return `${n <= 10 ? "Slightly rounded" : n <= 24 ? "Rounded" : "Very rounded"} corners (about ${n})`;
    case "padding":
      return `${n <= 10 ? "Snug" : n <= 18 ? "Comfortable" : "Roomy"} padding inside cards (${n})`;
    case "gap":
      return `${n <= 8 ? "Tight" : n <= 16 ? "Comfortable" : "Airy"} spacing between things (${n})`;
    case "weight":
      return n >= 800 ? "Extra bold headings" : n >= 700 ? "Bold headings" : n >= 500 ? "Medium-weight headings" : "Light, regular headings";
    case "accent":
      return `${capitalize(nearestColorName(String(value)))} as your accent color`;
    case "surface":
      return `${capitalize(nearestColorName(String(value)))} cards`;
  }
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export function evidenceCount(memory: StyleMemory, category: StyleCategory): number {
  return memory.tallies[category]?.length ?? 0;
}

export function applyProfile(doc: AppDoc, kind: KindSpec, profile: Profile, scope?: string[]): Operation[] {
  const nodes = scope ? scope.map((id) => findNode(doc.root, id)).filter((node): node is AppNode => Boolean(node)) : allNodes(doc.root);
  const operations: Operation[] = [];
  const set = (node: AppNode, prop: StyleProp, value: StyleValue) => {
    if (!kind.ops.styles.includes(prop)) return;
    if (effectiveStyle(node)[prop] === value) return;
    operations.push({ op: "setStyle", targets: [node.id], prop, value });
  };
  for (const node of nodes) {
    const style = effectiveStyle(node);
    if (profile.radius !== undefined && RADIUS_TYPES.includes(node.type) && !(node.type === "shape" && style.borderRadius === 999)) set(node, "borderRadius", profile.radius);
    if (profile.padding !== undefined && PADDED_TYPES.includes(node.type)) set(node, "padding", profile.padding);
    if (profile.gap !== undefined && GAP_TYPES.includes(node.type) && (node.children?.length ?? 0) > 1) set(node, "gap", profile.gap);
    if (profile.weight !== undefined && WEIGHT_TYPES.includes(node.type)) set(node, "fontWeight", profile.weight);
    if (profile.accent !== undefined) {
      const accent = String(profile.accent);
      if (["button", "shape"].includes(node.type)) {
        set(node, "backgroundColor", accent);
        if (contrast(accent, String(style.color ?? "#1B1A17")) < 3) set(node, "color", readableOn(accent));
      }
      if (["progress", "habit"].includes(node.type)) set(node, "accentColor", accent);
    }
    if (profile.surface !== undefined && SURFACE_TYPES.includes(node.type)) {
      const surface = String(profile.surface);
      set(node, "backgroundColor", surface);
      if (contrast(surface, String(style.color ?? "#1B1A17")) < 3) set(node, "color", readableOn(surface));
    }
  }
  return mergeOperations(operations);
}
