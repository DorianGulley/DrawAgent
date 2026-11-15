import {
  AppDoc,
  AppNode,
  STYLE_PROPS,
  StyleProp,
  StyleValue,
  TEXT_TYPES,
  findNode,
  findParent,
} from "./model";

export type Operation =
  | { op: "setText"; id: string; field: "text" | "subtext"; value: string }
  | { op: "setStyle"; id: string; prop: StyleProp; value: StyleValue }
  | { op: "move"; id: string; index: number };

export class EditError extends Error {}

const NUMERIC_RANGES: Partial<Record<StyleProp, [number, number]>> = {
  fontSize: [10, 72],
  padding: [0, 64],
  gap: [0, 48],
  borderRadius: [0, 999],
  height: [4, 40],
};

const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800, 900];
const TEXT_ALIGNS = ["left", "center", "right"];
const COLOR_PROPS: StyleProp[] = ["color", "backgroundColor", "accentColor"];
const MAX_TEXT_LENGTH = 80;

export function validateOperation(doc: AppDoc, operation: Operation): Operation {
  const node = findNode(doc.root, operation.id);
  if (!node) throw new EditError(`Unknown element ${operation.id}`);

  switch (operation.op) {
    case "setText": {
      if (!TEXT_TYPES.includes(node.type)) throw new EditError(`A ${node.type} has no text to change`);
      if (operation.field === "subtext" && node.subtext === undefined)
        throw new EditError("This element has no secondary label");
      const value = operation.value.replace(/\s+/g, " ").trim();
      if (!value) throw new EditError("Text cannot be empty");
      if (value.length > MAX_TEXT_LENGTH) throw new EditError(`Text is limited to ${MAX_TEXT_LENGTH} characters`);
      return { ...operation, value };
    }
    case "setStyle": {
      if (!STYLE_PROPS.includes(operation.prop)) throw new EditError(`Style ${operation.prop} is not editable`);
      const { prop, value } = operation;
      if (COLOR_PROPS.includes(prop)) {
        if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value))
          throw new EditError(`${value} is not a valid color`);
        return { ...operation, value: value.toUpperCase() };
      }
      if (prop === "fontWeight") {
        if (typeof value !== "number" || !FONT_WEIGHTS.includes(value))
          throw new EditError(`${value} is not a valid font weight`);
        return operation;
      }
      if (prop === "textAlign") {
        if (typeof value !== "string" || !TEXT_ALIGNS.includes(value))
          throw new EditError(`${value} is not a valid alignment`);
        return operation;
      }
      const range = NUMERIC_RANGES[prop];
      if (!range || typeof value !== "number" || !Number.isFinite(value))
        throw new EditError(`${value} is not valid for ${prop}`);
      return { ...operation, value: Math.round(Math.min(range[1], Math.max(range[0], value))) };
    }
    case "move": {
      const parent = findParent(doc.root, operation.id);
      if (!parent?.children) throw new EditError("This element cannot be moved");
      if (!Number.isInteger(operation.index)) throw new EditError("Invalid position");
      return { ...operation, index: Math.min(parent.children.length - 1, Math.max(0, operation.index)) };
    }
  }
}

function applyOne(root: AppNode, operation: Operation) {
  const node = findNode(root, operation.id)!;
  switch (operation.op) {
    case "setText":
      node[operation.field] = operation.value;
      return;
    case "setStyle":
      node.style = { ...node.style, [operation.prop]: operation.value };
      return;
    case "move": {
      const siblings = findParent(root, operation.id)!.children!;
      siblings.splice(siblings.indexOf(node), 1);
      siblings.splice(operation.index, 0, node);
      return;
    }
  }
}

export function applyOperations(
  doc: AppDoc,
  operations: Operation[],
): { doc: AppDoc; operations: Operation[]; changedIds: string[] } {
  if (operations.length === 0) throw new EditError("No changes to apply");
  const next: AppDoc = JSON.parse(JSON.stringify(doc));
  const applied = operations.map((operation) => {
    const valid = validateOperation(next, operation);
    applyOne(next.root, valid);
    return valid;
  });
  return { doc: next, operations: applied, changedIds: [...new Set(applied.map((operation) => operation.id))] };
}
