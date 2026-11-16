export const NODE_TYPES = [
  "screen",
  "header",
  "heading",
  "text",
  "button",
  "card",
  "section",
  "progress",
  "habit",
  "statGroup",
  "stat",
  "badge",
  "grid",
  "row",
  "shape",
  "clock",
  "page",
  "image",
  "input",
  "divider",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const STYLE_PROPS = [
  "color",
  "backgroundColor",
  "accentColor",
  "fontSize",
  "fontWeight",
  "padding",
  "gap",
  "borderRadius",
  "height",
  "width",
  "textAlign",
] as const;

export type StyleProp = (typeof STYLE_PROPS)[number];

export type StyleValue = string | number;
export type StyleMap = Partial<Record<StyleProp, StyleValue>>;

export type NodeAction = "completeAll" | "startFocus";

export interface AppNode {
  id: string;
  type: NodeType;
  name: string;
  text?: string;
  subtext?: string;
  icon?: string;
  done?: boolean;
  action?: NodeAction;
  target?: string;
  src?: string;
  style: StyleMap;
  children?: AppNode[];
}

export interface AppDoc {
  schemaVersion: 1;
  root: AppNode;
}

export const LOOK_STYLE_PROPS: StyleProp[] = ["color", "backgroundColor", "accentColor", "fontSize", "fontWeight", "padding", "gap", "borderRadius"];

export const TYPE_LABELS: Record<NodeType, string> = {
  screen: "Background",
  header: "Header",
  heading: "Heading",
  text: "Text",
  button: "Button",
  card: "Card",
  section: "Section",
  progress: "Progress bar",
  habit: "List item",
  statGroup: "Stats row",
  stat: "Stat",
  badge: "Tag",
  grid: "Grid",
  row: "Row",
  shape: "Shape",
  clock: "Clock",
  page: "Page",
  image: "Photo",
  input: "Input",
  divider: "Divider",
};

export const PLURAL_LABELS: Record<NodeType, string> = {
  screen: "backgrounds",
  header: "headers",
  heading: "headings",
  text: "texts",
  button: "buttons",
  card: "cards",
  section: "sections",
  progress: "progress bars",
  habit: "list items",
  statGroup: "stats rows",
  stat: "stats",
  badge: "tags",
  grid: "grids",
  row: "rows",
  shape: "shapes",
  clock: "clocks",
  page: "pages",
  image: "photos",
  input: "inputs",
  divider: "dividers",
};

export const CONTAINER_TYPES: NodeType[] = ["screen", "header", "card", "section", "statGroup", "grid", "row", "shape", "page"];

export const TEXT_TYPES: NodeType[] = ["heading", "text", "button", "habit", "stat", "badge", "clock", "page", "input"];

export const BOXED_TYPES: NodeType[] = ["card", "button", "habit", "stat", "badge", "progress", "shape", "image", "input"];

export const LINKABLE_TYPES: NodeType[] = ["button", "card", "habit", "row", "image"];

export const SIZED_TYPES: NodeType[] = ["progress", "shape", "image", "divider"];

export const DEFAULT_STYLE: Record<NodeType, StyleMap> = {
  screen: { backgroundColor: "#FBF8F3", color: "#1B1A17", padding: 20, gap: 18 },
  header: { padding: 0, gap: 4 },
  heading: { fontSize: 22, fontWeight: 700 },
  text: { fontSize: 15, fontWeight: 400 },
  button: {
    backgroundColor: "#1B1A17",
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: 600,
    padding: 16,
    borderRadius: 16,
    textAlign: "center",
  },
  card: { backgroundColor: "#FFFFFF", color: "#1B1A17", padding: 18, gap: 12, borderRadius: 20 },
  section: { padding: 0, gap: 10 },
  progress: { accentColor: "#1B1A17", backgroundColor: "#ECE7DF", height: 10, borderRadius: 999 },
  habit: {
    backgroundColor: "#FFFFFF",
    color: "#1B1A17",
    accentColor: "#22A06B",
    fontSize: 16,
    fontWeight: 500,
    padding: 14,
    borderRadius: 16,
  },
  statGroup: { gap: 10, padding: 0 },
  stat: { backgroundColor: "#FFFFFF", color: "#1B1A17", fontSize: 24, fontWeight: 700, padding: 14, borderRadius: 16 },
  badge: {
    backgroundColor: "#EFE9FF",
    color: "#5B3FD1",
    fontSize: 12,
    fontWeight: 600,
    padding: 6,
    borderRadius: 999,
  },
  grid: { gap: 12, padding: 0 },
  row: { gap: 14, padding: 0 },
  shape: { backgroundColor: "#635BFF", color: "#FFFFFF", width: 120, height: 120, borderRadius: 32, padding: 0 },
  clock: { fontSize: 88, fontWeight: 600, textAlign: "center" },
  page: { padding: 0, gap: 18 },
  image: { height: 180, borderRadius: 18, backgroundColor: "#E9E4DA" },
  input: { backgroundColor: "#FFFFFF", color: "#1B1A17", fontSize: 15, padding: 14, borderRadius: 14 },
  divider: { backgroundColor: "#E6E0D6", height: 1 },
};

export function pagesOf(root: AppNode): AppNode[] {
  return (root.children ?? []).filter((child) => child.type === "page");
}

export function imageSources(root: AppNode): string[] {
  const sources = new Set<string>();
  walkNodes(root, (node) => {
    if (node.type === "image" && node.src) sources.add(node.src);
  });
  return [...sources];
}

export function effectiveStyle(node: AppNode): StyleMap {
  return { ...DEFAULT_STYLE[node.type], ...node.style };
}

export function findNode(root: AppNode, id: string): AppNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findParent(root: AppNode, id: string): AppNode | null {
  for (const child of root.children ?? []) {
    if (child.id === id) return root;
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
}

export function ancestorsOf(root: AppNode, id: string): AppNode[] {
  const path: AppNode[] = [];
  const walk = (node: AppNode): boolean => {
    if (node.id === id) return true;
    for (const child of node.children ?? []) {
      if (walk(child)) {
        path.push(node);
        return true;
      }
    }
    return false;
  };
  walk(root);
  return path;
}

export function walkNodes(root: AppNode, visit: (node: AppNode) => void) {
  visit(root);
  for (const child of root.children ?? []) walkNodes(child, visit);
}

export function allNodes(root: AppNode): AppNode[] {
  const nodes: AppNode[] = [];
  walkNodes(root, (node) => nodes.push(node));
  return nodes;
}

export function siblingsLike(root: AppNode, id: string): AppNode[] {
  const node = findNode(root, id);
  const parent = findParent(root, id);
  if (!node || !parent) return [];
  return (parent.children ?? []).filter((child) => child.type === node.type);
}

export function allLike(root: AppNode, id: string): AppNode[] {
  const node = findNode(root, id);
  return node ? allNodes(root).filter((other) => other.type === node.type) : [];
}

export function describeSelection(root: AppNode, ids: string[]): string {
  const nodes = ids.map((id) => findNode(root, id)).filter((node): node is AppNode => Boolean(node));
  if (nodes.length === 0) return "Nothing selected";
  const types = new Set(nodes.map((node) => node.type));
  if (nodes.length === 1) return TYPE_LABELS[nodes[0].type];
  return types.size === 1 ? `${nodes.length} ${PLURAL_LABELS[nodes[0].type]}` : `${nodes.length} things`;
}
