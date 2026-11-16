import { KindSpec } from "./kinds";
import { AppDoc, AppNode, CONTAINER_TYPES, LINKABLE_TYPES, NODE_TYPES, NodeType, SIZED_TYPES, STYLE_PROPS, StyleMap, StyleProp, StyleValue, TEXT_TYPES, allNodes, findNode, findParent, pagesOf, walkNodes } from "./model";

export type Operation =
  | { op: "setText"; targets: string[]; field: "text" | "subtext"; value: string }
  | { op: "setStyle"; targets: string[]; prop: StyleProp; value: StyleValue }
  | { op: "move"; targets: string[]; index: number }
  | { op: "addNode"; targets: string[]; index: number; node: AppNode }
  | { op: "remove"; targets: string[] }
  | { op: "setLink"; targets: string[]; value: string }
  | { op: "setImage"; targets: string[]; value: string };

export class EditError extends Error {}

const NUMERIC_RANGES: Partial<Record<StyleProp, [number, number]>> = {
  fontSize: [10, 320],
  padding: [0, 64],
  gap: [0, 48],
  borderRadius: [0, 999],
  height: [4, 360],
  width: [24, 360],
};

const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800, 900];
const TEXT_ALIGNS = ["left", "center", "right"];
export const COLOR_PROPS: StyleProp[] = ["color", "backgroundColor", "accentColor"];
const MAX_TEXT_LENGTH = 80;
const MAX_TARGETS = 200;

const MAX_NEW_NODES = 80;
const MAX_DEPTH = 7;
const MAX_NODES = 600;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
const ASSET_PATTERN = /^[a-z0-9]{10,64}$/;

function cleanStyle(style: unknown): StyleMap {
  if (!style || typeof style !== "object") return {};
  const clean: StyleMap = {};
  for (const [prop, value] of Object.entries(style as Record<string, unknown>)) {
    if (!STYLE_PROPS.includes(prop as StyleProp)) continue;
    const valid = validValue({ op: "setStyle", targets: ["x"], prop: prop as StyleProp, value: value as StyleValue });
    if (valid.op === "setStyle") clean[prop as StyleProp] = valid.value;
  }
  return clean;
}

function cleanNode(raw: unknown, taken: Set<string>, depth: number, budget: { left: number }): AppNode {
  if (!raw || typeof raw !== "object") throw new EditError("A new part is missing");
  const input = raw as Record<string, unknown>;
  if (--budget.left < 0) throw new EditError("That adds too many parts at once");
  if (depth > MAX_DEPTH) throw new EditError("That nests too deeply");
  const type = input.type as NodeType;
  if (!NODE_TYPES.includes(type) || type === "screen") throw new EditError(`${String(input.type)} isn't a part Clay can add`);
  const id = typeof input.id === "string" ? input.id : "";
  if (!ID_PATTERN.test(id) || taken.has(id)) throw new EditError(`The new part needs a fresh id (got ${id || "none"})`);
  taken.add(id);
  const text = (field: unknown) => (typeof field === "string" ? field.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH) : undefined);
  const node: AppNode = {
    id,
    type,
    name: text(input.name) || type,
    style: cleanStyle(input.style),
  };
  if (TEXT_TYPES.includes(type)) node.text = text(input.text) ?? "";
  if (type === "habit" || type === "stat") node.subtext = text(input.subtext) ?? "";
  if (type === "habit" || type === "page") node.icon = text(input.icon)?.slice(0, 4);
  if (type === "habit") node.done = input.done === true;
  if (type === "image") node.src = typeof input.src === "string" && ASSET_PATTERN.test(input.src) ? input.src : "";
  if (LINKABLE_TYPES.includes(type) && typeof input.target === "string" && ID_PATTERN.test(input.target)) node.target = input.target;
  if (CONTAINER_TYPES.includes(type)) {
    const children = Array.isArray(input.children) ? input.children : [];
    node.children = children.map((child) => cleanNode(child, taken, depth + 1, budget));
  }
  return node;
}

function eligible(node: AppNode, operation: Operation, root: AppNode): boolean {
  if (operation.op === "addNode") return CONTAINER_TYPES.includes(node.type);
  if (operation.op === "remove") return node.id !== root.id;
  if (operation.op === "setLink") return LINKABLE_TYPES.includes(node.type);
  if (operation.op === "setImage") return node.type === "image";
  if (operation.op === "setText") return TEXT_TYPES.includes(node.type) && (operation.field === "text" || node.subtext !== undefined);
  if (operation.op === "move") return Boolean(findParent(root, node.id)?.children);
  if (operation.prop === "width") return node.type === "shape";
  if (operation.prop === "height") return SIZED_TYPES.includes(node.type);
  return true;
}

function validValue(operation: Operation): Operation {
  switch (operation.op) {
    case "setText": {
      if (typeof operation.value !== "string") throw new EditError("Text must be words");
      const value = operation.value.replace(/\s+/g, " ").trim();
      if (!value) throw new EditError("Text cannot be empty");
      if (value.length > MAX_TEXT_LENGTH) throw new EditError(`Text is limited to ${MAX_TEXT_LENGTH} characters`);
      return { ...operation, field: operation.field === "subtext" ? "subtext" : "text", value };
    }
    case "setStyle": {
      const { prop, value } = operation;
      if (!STYLE_PROPS.includes(prop)) throw new EditError(`${prop} can't be changed`);
      if (COLOR_PROPS.includes(prop)) {
        if (typeof value !== "string" || !/^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) throw new EditError(`${value} is not a color`);
        return { ...operation, value: value.toUpperCase() };
      }
      if (prop === "fontWeight") {
        if (typeof value !== "number" || !FONT_WEIGHTS.includes(value)) throw new EditError(`${value} is not a font weight`);
        return operation;
      }
      if (prop === "textAlign") {
        if (typeof value !== "string" || !TEXT_ALIGNS.includes(value)) throw new EditError(`${value} is not an alignment`);
        return operation;
      }
      const range = NUMERIC_RANGES[prop]!;
      if (typeof value !== "number" || !Number.isFinite(value)) throw new EditError(`${value} doesn't work for ${prop}`);
      return { ...operation, value: Math.round(Math.min(range[1], Math.max(range[0], value))) };
    }
    case "move":
      if (!Number.isInteger(operation.index)) throw new EditError("That position doesn't exist");
      if (operation.targets.length !== 1) throw new EditError("Move one thing at a time");
      return operation;
    case "addNode":
      if (!Number.isInteger(operation.index)) throw new EditError("That position doesn't exist");
      if (operation.targets.length !== 1) throw new EditError("Add into one place at a time");
      return operation;
    case "remove":
      return operation;
    case "setLink":
      if (typeof operation.value !== "string" || (operation.value !== "" && !ID_PATTERN.test(operation.value))) throw new EditError("That link goes nowhere");
      return operation;
    case "setImage":
      if (typeof operation.value !== "string" || !ASSET_PATTERN.test(operation.value)) throw new EditError("That isn't one of your photos");
      return operation;
    default:
      throw new EditError("Clay doesn't know that change");
  }
}

export function validateOperation(doc: AppDoc, kind: KindSpec, operation: Operation): Operation {
  if (!operation || !Array.isArray(operation.targets) || operation.targets.length === 0) throw new EditError("Pick something to change");
  if (operation.targets.length > MAX_TARGETS) throw new EditError("That's too many things at once");
  if (operation.op === "setText" && !kind.ops.text) throw new EditError(`A ${kind.name.toLowerCase()} can't change words`);
  if (operation.op === "move" && !kind.ops.move) throw new EditError(`Things in a ${kind.name.toLowerCase()} can't be moved`);
  if (operation.op === "setStyle" && !kind.ops.styles.includes(operation.prop)) throw new EditError(`A ${kind.name.toLowerCase()} can't change that`);
  if ((operation.op === "addNode" || operation.op === "remove" || operation.op === "setLink" || operation.op === "setImage") && !kind.ops.structure) throw new EditError(`A ${kind.name.toLowerCase()} can't add or remove parts`);
  const valid = validValue(operation);
  const targets = [...new Set(valid.targets)].filter((id) => {
    const node = typeof id === "string" ? findNode(doc.root, id) : null;
    return node && eligible(node, valid, doc.root);
  });
  if (targets.length === 0) throw new EditError("None of the selected things can take that change");
  if (valid.op === "move") {
    const siblings = findParent(doc.root, targets[0])!.children!;
    return { ...valid, targets, index: Math.min(siblings.length - 1, Math.max(0, valid.index)) };
  }
  if (valid.op === "addNode") {
    const taken = new Set(allNodes(doc.root).map((node) => node.id));
    const node = cleanNode(valid.node, taken, 1, { left: MAX_NEW_NODES });
    const parent = findNode(doc.root, targets[0])!;
    if (node.type === "page" && parent.id !== doc.root.id) throw new EditError("Pages go at the top level of the app");
    const siblings = parent.children ?? [];
    if (allNodes(doc.root).length + allNodes(node).length > MAX_NODES) throw new EditError("The design is getting too big");
    return { ...valid, targets, node, index: Math.min(siblings.length, Math.max(0, valid.index)) };
  }
  return { ...valid, targets };
}

function applyOne(root: AppNode, operation: Operation) {
  for (const id of operation.targets) {
    const node = findNode(root, id);
    if (!node) continue;
    switch (operation.op) {
      case "setText":
        node[operation.field] = operation.value;
        break;
      case "setStyle":
        node.style = { ...node.style, [operation.prop]: operation.value };
        break;
      case "move": {
        const siblings = findParent(root, id)!.children!;
        siblings.splice(siblings.indexOf(node), 1);
        siblings.splice(operation.index, 0, node);
        break;
      }
      case "addNode":
        node.children = node.children ?? [];
        node.children.splice(operation.index, 0, JSON.parse(JSON.stringify(operation.node)));
        break;
      case "remove": {
        const parent = findParent(root, id);
        if (parent?.children) parent.children = parent.children.filter((child) => child.id !== id);
        break;
      }
      case "setLink":
        if (operation.value) node.target = operation.value;
        else delete node.target;
        break;
      case "setImage":
        node.src = operation.value;
        break;
    }
  }
}

export function applyOperations(
  doc: AppDoc,
  kind: KindSpec,
  operations: Operation[],
): { doc: AppDoc; operations: Operation[]; changedIds: string[] } {
  if (!Array.isArray(operations) || operations.length === 0) throw new EditError("No changes to apply");
  if (operations.length > 400) throw new EditError("That's too many changes at once");
  const next: AppDoc = JSON.parse(JSON.stringify(doc));
  const applied: Operation[] = [];
  for (const operation of operations) {
    let valid: Operation;
    try {
      valid = validateOperation(next, kind, operation);
    } catch (error) {
      if (operations.length > 1 && error instanceof EditError) continue;
      throw error;
    }
    applyOne(next.root, valid);
    applied.push(valid);
  }
  if (applied.length === 0) throw new EditError("None of the selected things can take that change");
  pruneLinks(next.root);
  return { doc: next, operations: applied, changedIds: [...new Set(applied.flatMap((operation) => (operation.op === "addNode" ? [...operation.targets, operation.node.id] : operation.targets)))] };
}

export function mergeOperations(operations: Operation[]): Operation[] {
  const merged: Operation[] = [];
  for (const operation of operations) {
    const same = merged.find(
      (other) =>
        operation.op !== "move" &&
        operation.op !== "addNode" &&
        other.op === operation.op &&
        JSON.stringify({ ...other, targets: [] }) === JSON.stringify({ ...operation, targets: [] }),
    );
    if (same) same.targets = [...new Set([...same.targets, ...operation.targets])];
    else merged.push({ ...operation, targets: [...operation.targets] });
  }
  return merged;
}

function pruneLinks(root: AppNode) {
  const pages = new Set(pagesOf(root).map((page) => page.id));
  walkNodes(root, (node) => {
    if (node.target && !pages.has(node.target)) delete node.target;
  });
}

export function validateDoc(raw: unknown, kind: KindSpec): AppDoc {
  const input = (raw && typeof raw === "object" && "root" in raw ? (raw as { root: unknown }).root : raw) as Record<string, unknown> | null;
  if (!input || typeof input !== "object") throw new EditError("The app has no screen");
  const children = Array.isArray(input.children) ? input.children : [];
  if (children.length === 0) throw new EditError("The app is empty");
  const taken = new Set<string>(["screen"]);
  const budget = { left: MAX_NODES };
  const root: AppNode = {
    id: "screen",
    type: "screen",
    name: typeof input.name === "string" ? input.name.slice(0, 40) : "Screen",
    style: Object.fromEntries(Object.entries(cleanStyle(input.style)).filter(([prop]) => kind.ops.styles.includes(prop as StyleProp))) as StyleMap,
    children: children.map((child) => cleanNode(child, taken, 1, budget)),
  };
  const nested = allNodes(root).filter((node) => node.type === "page" && !root.children!.includes(node));
  if (nested.length) throw new EditError("Pages go at the top level of the app");
  pruneLinks(root);
  return { schemaVersion: 1, root };
}
