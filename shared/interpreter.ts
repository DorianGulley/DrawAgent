import { COLOR_NAMES, contrast, namedColor, normalizeHex, readableOn, shade, tint } from "./colors";
import {
  AppDoc,
  AppNode,
  CONTAINER_TYPES,
  NodeType,
  StyleProp,
  TEXT_TYPES,
  TYPE_LABELS,
  ancestorsOf,
  effectiveStyle,
  findNode,
  findParent,
  walkNodes,
} from "./model";
import { Operation } from "./operations";

export type Interpretation =
  | { ok: true; targetId: string; operations: Operation[]; summary: string }
  | { ok: false; message: string };

const SUBJECT_WORDS: Record<string, NodeType> = {
  card: "card",
  section: "section",
  list: "section",
  button: "button",
  heading: "heading",
  title: "heading",
  header: "header",
  stats: "statGroup",
  progress: "progress",
  badge: "badge",
  screen: "screen",
  page: "screen",
};

const BOXED_TYPES: NodeType[] = ["card", "button", "habit", "stat", "badge", "progress", "screen"];
const STOPWORDS = new Set(["the", "a", "an", "this", "that", "it", "my", "of", "to", "and", "section", "card", "please"]);

const QUOTED = /"([^"]+)"|“([^”]+)”|‘([^’]+)’|(?:^|\s)'([^']+)'(?=[\s.,!?]|$)/;
const COLOR_TOKEN = new RegExp(`#[0-9a-f]{6}\\b|#[0-9a-f]{3}\\b|\\b(?:${COLOR_NAMES.join("|")})\\b`, "gi");
const STYLE_HINT = new RegExp(
  `\\b(?:${COLOR_NAMES.join("|")}|bigger|smaller|larger|bold|rounded|round|padding|spacing|gap|radius|weight|align|color|colour|size|corners?)\\b|#[0-9a-f]{3,6}`,
  "i",
);

function num(style: Record<string, unknown>, prop: StyleProp): number {
  const value = style[prop];
  return typeof value === "number" ? value : 0;
}

function tokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function resolveTarget(root: AppNode, phrase: string, exclude: string): AppNode | null {
  const wanted = tokens(phrase).filter((word) => !STOPWORDS.has(word));
  if (wanted.length === 0) return null;
  let best: { node: AppNode; score: number } | null = null;
  walkNodes(root, (node) => {
    if (node.id === exclude || node.type === "screen") return;
    const haystack = new Set(tokens(`${node.name} ${TYPE_LABELS[node.type]} ${node.text ?? ""}`));
    const score = wanted.filter((word) => haystack.has(word) || haystack.has(word.replace(/s$/, ""))).length;
    if (score > 0 && (!best || score > best.score)) best = { node, score };
  });
  return best ? (best as { node: AppNode }).node : null;
}

function siblingPair(root: AppNode, subjectId: string, targetId: string): { moving: AppNode; anchor: AppNode; parent: AppNode } | null {
  const subjectChain = [findNode(root, subjectId)!, ...ancestorsOf(root, subjectId)];
  const targetChain = [findNode(root, targetId)!, ...ancestorsOf(root, targetId)];
  for (const moving of subjectChain) {
    const parent = findParent(root, moving.id);
    if (!parent) continue;
    const anchor = targetChain.find((node) => node.id !== moving.id && findParent(root, node.id)?.id === parent.id);
    if (anchor) return { moving, anchor, parent };
  }
  return null;
}

function joinPhrases(phrases: string[]): string {
  if (phrases.length <= 1) return phrases.join("");
  return `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
}

export function interpret(doc: AppDoc, selectedId: string, instruction: string): Interpretation {
  const selected = findNode(doc.root, selectedId);
  if (!selected) return { ok: false, message: "That element no longer exists. Tap it again to reselect." };
  const raw = instruction.trim();
  if (!raw) return { ok: false, message: "Describe the change you want." };

  const operations: Operation[] = [];
  const phrases: string[] = [];
  let rest = raw.toLowerCase();

  let newText: string | undefined;
  const quoted = raw.match(QUOTED);
  if (quoted) {
    newText = quoted.slice(1).find(Boolean);
    rest = rest.replace(quoted[0].toLowerCase(), " ");
  } else {
    const unquoted =
      raw.match(/\b(?:change|rename|set|update|replace|switch)\b.*?\bto\s+(.+)$/i) ??
      raw.match(/\b(?:say|says|read|reads|call it|label it|titled|named)\s+(.+)$/i);
    if (unquoted && !STYLE_HINT.test(unquoted[0]) && !/^\d+\s*(?:px|pt)?$/.test(unquoted[1].trim())) {
      newText = unquoted[1].replace(/[.!]+$/, "").replace(/^['"“‘](.*)['"”’]$/, "$1");
      rest = rest.replace(unquoted[0].toLowerCase(), " ");
    }
  }

  let moveClause: { kind: "up" | "down" | "top" | "bottom" | "before" | "after"; phrase?: string } | null = null;
  const moveVerb = /\b(?:move|put|place|bring|shift|reorder|push)\b/.test(rest);
  if (moveVerb) {
    const relative = rest.match(/\b(above|before|over|on top of|ahead of|below|after|under|beneath|underneath)\s+(.+?)(?=\s+and\s+|[.,;]|$)/);
    if (relative) {
      const before = ["above", "before", "over", "on top of", "ahead of"].includes(relative[1]);
      moveClause = { kind: before ? "before" : "after", phrase: relative[2] };
      rest = rest.replace(relative[0], " ");
    } else if (/\b(to the top|to top|first|top of)\b/.test(rest)) moveClause = { kind: "top" };
    else if (/\b(to the bottom|to bottom|last|to the end|bottom of)\b/.test(rest)) moveClause = { kind: "bottom" };
    else if (/\b(up|higher|earlier)\b/.test(rest)) moveClause = { kind: "up" };
    else if (/\b(down|lower|later)\b/.test(rest)) moveClause = { kind: "down" };
  }

  let target = selected;
  const subjectWord = rest.match(/\b(?:this|the|whole|entire)\s+(?:whole\s+|entire\s+)?(card|section|list|button|heading|title|header|stats|progress|badge|screen|page)\b/);
  if (subjectWord) {
    const wantedType = SUBJECT_WORDS[subjectWord[1]];
    if (wantedType !== selected.type) {
      const ancestor = ancestorsOf(doc.root, selected.id).find((node) => node.type === wantedType);
      if (ancestor) target = ancestor;
    }
  }
  const style = effectiveStyle(target);
  const label = TYPE_LABELS[target.type].toLowerCase();
  const setStyle = (node: AppNode, prop: StyleProp, value: string | number) =>
    operations.push({ op: "setStyle", id: node.id, prop, value });

  if (newText !== undefined) {
    let textNode: AppNode | null = TEXT_TYPES.includes(target.type) ? target : null;
    if (!textNode) walkNodes(target, (node) => {
      if (!textNode && (node.type === "heading" || node.type === "text")) textNode = node;
    });
    if (!textNode) return { ok: false, message: `This ${label} has no text to change. Tap a heading, label, or button.` };
    const node: AppNode = textNode;
    const field = node.subtext !== undefined && /\b(label|caption|subtitle|subtext|description)\b/i.test(raw) ? "subtext" : "text";
    operations.push({ op: "setText", id: node.id, field, value: newText });
    phrases.push(`renamed it to “${newText.trim()}”`);
  }

  if (moveClause) {
    const parent = findParent(doc.root, target.id);
    if (moveClause.phrase) {
      const anchorNode = resolveTarget(doc.root, moveClause.phrase, target.id);
      const pair = anchorNode && siblingPair(doc.root, target.id, anchorNode.id);
      if (!anchorNode || !pair) return { ok: false, message: `I couldn't find “${moveClause.phrase}” next to this ${label}.` };
      const siblings = pair.parent.children!.filter((node) => node.id !== pair.moving.id);
      const anchorIndex = siblings.findIndex((node) => node.id === pair.anchor.id);
      operations.push({ op: "move", id: pair.moving.id, index: moveClause.kind === "before" ? anchorIndex : anchorIndex + 1 });
      phrases.push(`moved ${pair.moving.name} ${moveClause.kind === "before" ? "above" : "below"} ${pair.anchor.name}`);
    } else if (parent?.children) {
      const index = parent.children.indexOf(target);
      const last = parent.children.length - 1;
      const destination = { up: index - 1, down: index + 1, top: 0, bottom: last }[moveClause.kind as "up"];
      operations.push({ op: "move", id: target.id, index: Math.max(0, Math.min(last, destination)) });
      phrases.push(`moved it ${{ up: "up", down: "down", top: "to the top", bottom: "to the bottom" }[moveClause.kind as "up"]}`);
    } else {
      return { ok: false, message: "The screen itself can't be moved. Tap a section or card." };
    }
  }

  let explicitTextColor = false;
  const colorMatches = [...rest.matchAll(COLOR_TOKEN)];
  const pendingBackground: { node: AppNode; value: string }[] = [];
  for (const match of colorMatches) {
    const word = match[0].toLowerCase();
    const before = rest.slice(Math.max(0, match.index! - 28), match.index!);
    const after = rest.slice(match.index! + word.length, match.index! + word.length + 22);
    const base = word.startsWith("#") ? normalizeHex(word) : namedColor(word)!;
    const lighter = /\b(light|pale|soft|pastel|subtle)\s*$/.test(before);
    const darker = /\b(dark|deep|rich)\s*$/.test(before);
    const vivid = /\b(bright|vivid|solid|strong|saturated|dark|deep)\b/.test(before);

    let prop: StyleProp;
    if (/^\s*(text|font|label|title|letters|words|writing|copy)\b/.test(after) || /\b(text|font|label)\s+(colou?r\s+)?(to\s+)?$/.test(before)) prop = "color";
    else if (/^\s*(background|bg|fill)\b/.test(after) || /\b(background|bg|fill)\s+(colou?r\s+)?(to\s+)?$/.test(before)) prop = "backgroundColor";
    else if (/^\s*(bar|check|checkmark|accent)\b/.test(after) || /\b(accent|bar|check)\s+(colou?r\s+)?(to\s+)?$/.test(before)) prop = "accentColor";
    else if (["progress", "habit"].includes(target.type)) prop = "accentColor";
    else if (["heading", "text", "stat", "header"].includes(target.type)) prop = "color";
    else prop = "backgroundColor";

    let value = darker ? shade(base) : lighter ? tint(base) : base;
    const container = !["button", "badge"].includes(target.type);
    if (prop === "backgroundColor" && container && !vivid && !lighter && !word.startsWith("#") && !["white", "black", "cream", "beige", "charcoal"].includes(word)) {
      value = tint(base);
    }
    if (prop === "color") explicitTextColor = true;
    if (prop === "backgroundColor") pendingBackground.push({ node: target, value });
    setStyle(target, prop, value);
    const where = prop === "color" ? "text" : prop === "accentColor" ? "accent" : target.type === "button" ? "fill" : "background";
    phrases.push(`made the ${where} ${lighter ? "light " : darker ? "dark " : ""}${word}`);
  }
  if (!explicitTextColor) {
    for (const { node, value } of pendingBackground) {
      const current = effectiveStyle(node).color;
      const textColor = typeof current === "string" ? current : "#1B1A17";
      if (node.type !== "progress" && contrast(value, textColor) < 3) setStyle(node, "color", readableOn(value));
    }
  }

  const spacingUp = /\b(more|extra|bigger|larger|increase|add)\b[^.]{0,24}\b(padding|space|spacing|room|whitespace|gap|gaps)\b|\b(roomier|spacious|airy|airier|less cramped|breathing room)\b/.test(rest);
  const spacingDown = /\b(less|reduce|smaller|decrease|remove|tighten)\b[^.]{0,24}\b(padding|space|spacing|room|gap|gaps)\b|\b(tighter|compact|denser)\b/.test(rest);
  if (spacingUp || spacingDown) {
    const direction = spacingUp ? 1 : -1;
    const onlyGap = /\bbetween\b/.test(rest);
    const spaced = CONTAINER_TYPES.includes(target.type) || BOXED_TYPES.includes(target.type) ? target : findParent(doc.root, target.id)!;
    const spacedStyle = effectiveStyle(spaced);
    if (spaced.children?.length) setStyle(spaced, "gap", num(spacedStyle, "gap") + 6 * direction);
    if (!onlyGap || !spaced.children?.length) {
      const step = CONTAINER_TYPES.includes(spaced.type) ? 8 : 4;
      setStyle(spaced, "padding", num(spacedStyle, "padding") + step * direction);
    }
    phrases.push(direction > 0 ? "added breathing room" : "tightened the spacing");
  }

  const explicitRadius = rest.match(/\b(?:radius|corners?)\s*(?:of|to)?\s*(\d{1,3})\b/) ?? rest.match(/\b(\d{1,3})\s*(?:px|pt)?\s*(?:radius|corners?|rounded)\b/);
  const radiusNode = BOXED_TYPES.includes(target.type) ? target : ancestorsOf(doc.root, target.id).find((node) => BOXED_TYPES.includes(node.type));
  const currentRadius = radiusNode ? num(effectiveStyle(radiusNode), "borderRadius") : 0;
  let radius: number | undefined;
  if (explicitRadius) radius = Number(explicitRadius[1]);
  else if (/\b(pill|capsule|fully rounded|circular)\b/.test(rest)) radius = 999;
  else if (/\bless rounded\b/.test(rest)) radius = Math.max(0, Math.min(currentRadius, 40) - 10);
  else if (/\b(square|squared|sharp|straight corners|no rounded|not rounded|no corners)\b/.test(rest)) radius = 0;
  else if (/\b(round|rounded|rounder|curved|soft corners|softer corners|rounding)\b/.test(rest))
    radius = /\b(more|rounder|extra|very|super)\b/.test(rest) || currentRadius >= 20 ? Math.min(currentRadius, 40) + 10 : 24;
  if (radius !== undefined) {
    if (!radiusNode) return { ok: false, message: `This ${label} has no corners to round. Tap a card or button.` };
    setStyle(radiusNode, "borderRadius", radius);
    phrases.push(radius === 0 ? "squared the corners" : radius >= 999 ? "made it a pill" : "rounded the corners");
  }

  const explicitSize = rest.match(/\b(\d{1,2})\s*(?:px|pt|points?)\b(?!\s*(?:radius|corners?|rounded|padding))/) ?? rest.match(/\b(?:font size|text size|size)\s*(?:to|of)?\s*(\d{1,2})\b/);
  const sizeUp = /\b(bigger|larger|large|big|increase|enlarge|grow|taller|huge|giant|massive|more prominent|stand out)\b/.test(rest);
  const sizeDown = /\b(smaller|small|shrink|tiny|decrease|reduce|less prominent|subtler|shorter)\b/.test(rest);
  if (explicitSize && TEXT_TYPES.includes(target.type)) {
    setStyle(target, "fontSize", Number(explicitSize[1]));
    phrases.push(`set the text to ${explicitSize[1]}pt`);
  } else if ((sizeUp || sizeDown) && !(spacingUp || spacingDown)) {
    const strong = /\b(much|way|a lot|huge|giant|massive|really|very|double|twice)\b/.test(rest);
    const gentle = /\b(slightly|a bit|a little|a tad|somewhat)\b/.test(rest);
    const magnitude = strong ? 0.5 : gentle ? 0.12 : 0.25;
    const factor = sizeUp ? 1 + magnitude : 1 / (1 + magnitude);
    if (target.type === "progress") setStyle(target, "height", Math.round(num(style, "height") * factor) + (sizeUp ? 2 : -2));
    else if (TEXT_TYPES.includes(target.type)) {
      setStyle(target, "fontSize", Math.round(num(style, "fontSize") * factor));
      if (target.type === "button") setStyle(target, "padding", Math.round(num(style, "padding") * factor));
    } else setStyle(target, "padding", num(style, "padding") + (sizeUp ? 8 : -8));
    phrases.push(`made it ${sizeUp ? "bigger" : "smaller"}`);
  }

  if (TEXT_TYPES.includes(target.type)) {
    const currentWeight = num(style, "fontWeight") || 400;
    let weight: number | undefined;
    if (/\b(not bold|unbold|regular weight|normal weight|thinner|lighter weight|light weight|less bold)\b/.test(rest)) weight = 400;
    else if (/\b(semibold|semi-bold|medium weight)\b/.test(rest)) weight = 600;
    else if (/\b(extra bold|very bold|super bold|black weight|heaviest)\b/.test(rest)) weight = 900;
    else if (/\b(bold|bolder|heavier|thicker|stronger)\b/.test(rest)) weight = Math.min(900, Math.max(700, currentWeight + 200));
    if (weight !== undefined) {
      setStyle(target, "fontWeight", weight);
      phrases.push(weight >= 700 ? "made it bolder" : "lightened the weight");
    }

    const align = /\b(center|centre|centered|centred|middle)\b/.test(rest)
      ? "center"
      : /\b(left[- ]align(?:ed)?|align(?: it| this)?(?: to the)? left)\b/.test(rest)
        ? "left"
        : /\b(right[- ]align(?:ed)?|align(?: it| this)?(?: to the)? right)\b/.test(rest)
          ? "right"
          : undefined;
    if (align) {
      setStyle(target, "textAlign", align);
      phrases.push(`aligned it ${align}`);
    }
  }

  if (operations.length === 0) {
    return {
      ok: false,
      message: "I couldn't turn that into an edit yet. Try changing its text, color, size, spacing, corners, or position.",
    };
  }

  const summary = joinPhrases(phrases);
  return { ok: true, targetId: target.id, operations, summary: summary.charAt(0).toUpperCase() + summary.slice(1) };
}
