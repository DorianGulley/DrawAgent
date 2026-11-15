import { KindSpec } from "./kinds";
import { AppDoc, AppNode } from "./model";

function line(node: AppNode, depth: number): string {
  const style = Object.entries(node.style)
    .map(([prop, value]) => `${prop}=${value}`)
    .join(" ");
  const text = node.text ? ` "${node.text}"` : "";
  const sub = node.subtext ? ` (sub: "${node.subtext}")` : "";
  return `${"  ".repeat(depth)}- ${node.id} [${node.type}] ${node.name}${text}${sub}${style ? ` {${style}}` : ""}`;
}

export function outline(doc: AppDoc, maxLines = 120): string {
  const lines: string[] = [];
  const walk = (node: AppNode, depth: number) => {
    if (lines.length >= maxLines) return;
    lines.push(line(node, depth));
    for (const child of node.children ?? []) walk(child, depth + 1);
  };
  walk(doc.root, 0);
  return lines.join("\n");
}

export function kindRules(kind: KindSpec): string {
  return [
    `Kind: ${kind.name}. Canvas ${kind.canvas.width}x${kind.canvas.height ?? "auto"}, layout "${kind.canvas.layout}".`,
    `Allowed style props: ${kind.ops.styles.join(", ")}.`,
    kind.ops.structure ? "Adding and removing parts is allowed." : "Adding and removing parts is not allowed.",
  ].join(" ");
}
