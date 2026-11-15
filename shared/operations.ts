import { KindSpec } from "./kinds";
import { AppDoc, AppNode, STYLE_PROPS, StyleProp, StyleValue, TEXT_TYPES, findNode, findParent } from "./model";

export type Operation =
  | { op: "setText"; targets: string[]; field: "text" | "subtext"; value: string }
  | { op: "setStyle"; targets: string[]; prop: StyleProp; value: StyleValue }
  | { op: "move"; targets: string[]; index: number };

export class EditError extends Error {}

const NUMERIC_RANGES: Partial<Record<StyleProp, [number, number]>> = {
  fontSize: [10, 160],
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

function eligible(node: AppNode, operation: Operation, root: AppNode): boolean {
  if (operation.op === "setText") return TEXT_TYPES.includes(node.type) && (operation.field === "text" || node.subtext !== undefined);
  if (operation.op === "move") return Boolean(findParent(root, node.id)?.children);
  if (operation.prop === "height" || operation.prop === "width") return ["progress", "shape"].includes(node.type);
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
  }
}

export function validateOperation(doc: AppDoc, kind: KindSpec, operation: Operation): Operation {
  if (!operation || !Array.isArray(operation.targets) || operation.targets.length === 0) throw new EditError("Pick something to change");
  if (operation.targets.length > MAX_TARGETS) throw new EditError("That's too many things at once");
  if (operation.op === "setText" && !kind.ops.text) throw new EditError(`A ${kind.name.toLowerCase()} can't change words`);
  if (operation.op === "move" && !kind.ops.move) throw new EditError(`Things in a ${kind.name.toLowerCase()} can't be moved`);
  if (operation.op === "setStyle" && !kind.ops.styles.includes(operation.prop)) throw new EditError(`A ${kind.name.toLowerCase()} can't change that`);
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
  return { ...valid, targets };
}

function applyOne(root: AppNode, operation: Operation) {
  for (const id of operation.targets) {
    const node = findNode(root, id)!;
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
  return { doc: next, operations: applied, changedIds: [...new Set(applied.flatMap((operation) => operation.targets))] };
}

export function mergeOperations(operations: Operation[]): Operation[] {
  const merged: Operation[] = [];
  for (const operation of operations) {
    const same = merged.find(
      (other) =>
        operation.op !== "move" &&
        other.op === operation.op &&
        JSON.stringify({ ...other, targets: [] }) === JSON.stringify({ ...operation, targets: [] }),
    );
    if (same) same.targets = [...new Set([...same.targets, ...operation.targets])];
    else merged.push({ ...operation, targets: [...operation.targets] });
  }
  return merged;
}
