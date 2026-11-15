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
  style: StyleMap;
  children?: AppNode[];
}

export interface AppDoc {
  schemaVersion: 1;
  root: AppNode;
}

export const TYPE_LABELS: Record<NodeType, string> = {
  screen: "Screen",
  header: "Header",
  heading: "Heading",
  text: "Text",
  button: "Button",
  card: "Card",
  section: "Section",
  progress: "Progress Bar",
  habit: "List Item",
  statGroup: "Stats Row",
  stat: "Stat",
  badge: "Badge",
};

export const CONTAINER_TYPES: NodeType[] = ["screen", "header", "card", "section", "statGroup"];

export const TEXT_TYPES: NodeType[] = ["heading", "text", "button", "habit", "stat", "badge"];

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
};

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
