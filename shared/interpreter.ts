import { COLOR_NAMES, contrast, isTransparent, mix, namedColor, nearestColorName, normalizeHex, readableOn, shade, tint } from "./colors";
import { KindSpec } from "./kinds";
import {
  AppDoc,
  AppNode,
  CONTAINER_TYPES,
  NodeType,
  StyleProp,
  TEXT_TYPES,
  TYPE_LABELS,
  PLURAL_LABELS,
  allNodes,
  ancestorsOf,
  describeSelection,
  effectiveStyle,
  findNode,
  findParent,
  walkNodes,
} from "./model";
import { COLOR_PROPS, Operation, mergeOperations } from "./operations";
import { Profile, applyProfile } from "./style";

export type Interpretation =
  | { ok: true; operations: Operation[]; summary: string; focusIds: string[] }
  | { ok: false; message: string };

export interface InterpretContext {
  kind: KindSpec;
  profile: Profile;
  history: { summary: string; operations: Operation[] }[];
}

type Single = { ok: true; targetId: string; operations: Operation[]; summary: string } | { ok: false; message: string };

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
  tag: "badge",
  screen: "screen",
  page: "screen",
  wallpaper: "screen",
  grid: "grid",
  row: "row",
  widgets: "row",
  shape: "shape",
  mark: "shape",
  clock: "clock",
  time: "clock",
};

const BOXED_TYPES: NodeType[] = ["card", "button", "habit", "stat", "badge", "progress", "shape", "screen"];
const STOPWORDS = new Set(["the", "a", "an", "this", "that", "it", "these", "those", "them", "my", "of", "to", "and", "all", "other", "others", "please", "one", "ones", "color", "colour", "style", "look"]);

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

function resolveTarget(root: AppNode, phrase: string, exclude: string | string[]): AppNode | null {
  const excluded = new Set(Array.isArray(exclude) ? exclude : [exclude]);
  const wanted = tokens(phrase).filter((word) => !STOPWORDS.has(word));
  if (wanted.length === 0) return null;
  let best: { node: AppNode; score: number } | null = null;
  walkNodes(root, (node) => {
    if (excluded.has(node.id) || node.type === "screen") return;
    const haystack = new Set(tokens(`${node.name} ${TYPE_LABELS[node.type]} ${PLURAL_LABELS[node.type]} ${node.type} ${node.text ?? ""}`));
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

function interpretOne(doc: AppDoc, selectedId: string, instruction: string, profile: Profile): Single {
  const selected = findNode(doc.root, selectedId);
  if (!selected) return { ok: false, message: "That thing is gone. Tap it again to pick it." };
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
  const subjectWord = rest.match(/\b(?:this|the|whole|entire)\s+(?:whole\s+|entire\s+)?(card|section|list|button|heading|title|header|stats|progress|badge|tag|screen|page|wallpaper|grid|row|widgets|shape|mark|clock|time)\b/);
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
    operations.push({ op: "setStyle", targets: [node.id], prop, value });

  if (newText !== undefined) {
    let textNode: AppNode | null = TEXT_TYPES.includes(target.type) ? target : null;
    if (!textNode) walkNodes(target, (node) => {
      if (!textNode && (node.type === "heading" || node.type === "text")) textNode = node;
    });
    if (!textNode) return { ok: false, message: `This ${label} has no text to change. Tap a heading, label, or button.` };
    const node: AppNode = textNode;
    const field = node.subtext !== undefined && /\b(label|caption|subtitle|subtext|description)\b/i.test(raw) ? "subtext" : "text";
    operations.push({ op: "setText", targets: [node.id], field, value: newText });
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
      operations.push({ op: "move", targets: [pair.moving.id], index: moveClause.kind === "before" ? anchorIndex : anchorIndex + 1 });
      phrases.push(`moved ${pair.moving.name} ${moveClause.kind === "before" ? "above" : "below"} ${pair.anchor.name}`);
    } else if (parent?.children) {
      const index = parent.children.indexOf(target);
      const last = parent.children.length - 1;
      const destination = { up: index - 1, down: index + 1, top: 0, bottom: last }[moveClause.kind as "up"];
      operations.push({ op: "move", targets: [target.id], index: Math.max(0, Math.min(last, destination)) });
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
    else if (["heading", "text", "stat", "header", "clock"].includes(target.type)) prop = "color";
    else prop = "backgroundColor";

    let value = darker ? shade(base) : lighter ? tint(base) : base;
    const container = !["button", "badge", "shape"].includes(target.type);
    if (prop === "backgroundColor" && container && !vivid && !lighter && !word.startsWith("#") && !["white", "black", "cream", "beige", "charcoal"].includes(word)) {
      value = tint(base);
    }
    if (prop === "color") explicitTextColor = true;
    if (prop === "backgroundColor") pendingBackground.push({ node: target, value });
    setStyle(target, prop, value);
    const where = prop === "color" ? "text" : prop === "accentColor" ? "accent" : ["button", "shape", "badge"].includes(target.type) ? "fill" : "background";
    phrases.push(`made the ${where} ${lighter ? "light " : darker ? "dark " : ""}${word.startsWith("#") ? nearestColorName(base) : word}`);
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
      const current = num(spacedStyle, "padding");
      const preferred = typeof profile.padding === "number" && !CONTAINER_TYPES.includes(spaced.type) ? profile.padding : undefined;
      const usePreferred = preferred !== undefined && (direction > 0 ? preferred > current : preferred < current);
      setStyle(spaced, "padding", usePreferred ? preferred : current + step * direction);
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
    radius =
      typeof profile.radius === "number" && profile.radius > currentRadius
        ? profile.radius
        : /\b(more|rounder|extra|very|super)\b/.test(rest) || currentRadius >= 20
          ? Math.min(currentRadius, 40) + 10
          : 24;
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
    if (target.type === "shape") {
      setStyle(target, "width", Math.round(num(style, "width") * factor));
      setStyle(target, "height", Math.round(num(style, "height") * factor));
    } else if (target.type === "progress") setStyle(target, "height", Math.round(num(style, "height") * factor) + (sizeUp ? 2 : -2));
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
    else if (/\b(bold|bolder|heavier|thicker|stronger)\b/.test(rest))
      weight = typeof profile.weight === "number" && profile.weight > currentWeight ? profile.weight : Math.min(900, Math.max(700, currentWeight + 200));
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

const LOOK_COPY: StyleProp[] = ["backgroundColor", "color", "accentColor", "borderRadius", "padding", "fontSize", "fontWeight"];
const SHARED_LOOK: StyleProp[] = ["backgroundColor", "color", "accentColor", "borderRadius"];

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function finish(doc: AppDoc, kind: KindSpec, operations: Operation[], summary: string, focusIds: string[]): Interpretation {
  const allowed = operations.filter((operation) => operation.op !== "setStyle" || kind.ops.styles.includes(operation.prop));
  if (allowed.length === 0) return { ok: false, message: `That change doesn't apply to a ${kind.name.toLowerCase()}.` };
  return { ok: true, operations: mergeOperations(allowed), summary: capitalize(summary), focusIds };
}

function colorOf(node: AppNode): string | undefined {
  const style = effectiveStyle(node);
  const candidates = BOXED_TYPES.includes(node.type) && node.type !== "screen"
    ? [node.type === "progress" ? style.accentColor : style.backgroundColor, style.color]
    : [style.color, style.backgroundColor];
  const found = candidates.find((value) => typeof value === "string" && !isTransparent(value));
  return typeof found === "string" ? found.slice(0, 7) : undefined;
}

export function interpret(doc: AppDoc, selectedIds: string[], instruction: string, context: InterpretContext): Interpretation {
  const { kind, profile, history } = context;
  const ids = selectedIds.filter((id) => findNode(doc.root, id));
  if (ids.length === 0) return { ok: false, message: "Pick something first. Tap any part of your design." };
  let raw = instruction.trim().slice(0, 300);
  if (!raw) return { ok: false, message: "Describe the change you want." };
  const lower = raw.toLowerCase();
  const what = describeSelection(doc.root, ids).toLowerCase();
  const onWhat = ids.length > 1 ? ` on ${what}` : "";

  if (/\b(my style|my look|my usual)\b/.test(lower)) {
    if (Object.keys(profile).length === 0) return { ok: false, message: "Your style is still empty. Make a few changes and Direct will learn it." };
    const operations = applyProfile(doc, kind, profile, ids);
    if (operations.length === 0) return { ok: false, message: `The ${what} already match your style.` };
    return finish(doc, kind, operations, `Applied your style${onWhat}`, ids);
  }

  if (/^(do (that|it|the same)( thing)?( again)?|same (thing|again)|again|repeat( that)?|the same)\b/.test(lower) || /\bdo the same\b/.test(lower)) {
    const last = history.find((entry) => entry.operations.some((operation) => operation.op === "setStyle"));
    if (!last) return { ok: false, message: "There's nothing to repeat yet." };
    const operations = last.operations
      .filter((operation): operation is Extract<Operation, { op: "setStyle" }> => operation.op === "setStyle")
      .map((operation) => ({ ...operation, targets: ids }));
    return finish(doc, kind, operations, `Repeated “${last.summary.toLowerCase()}”${onWhat}`, ids);
  }

  const match = lower.match(/\b(?:match(?:es)?|look like|looks like|same (?:style|look) as|copy(?: the look of)?|style it like)\s+(?:the\s+)?(.+?)(?=[.,;!]|\s+and\s+|$)/);
  if (match) {
    const source = resolveTarget(doc.root, match[1], ids);
    if (!source) return { ok: false, message: `I couldn't find “${match[1]}”. Try naming it the way it reads on screen.` };
    const sourceStyle = effectiveStyle(source);
    const operations: Operation[] = [];
    for (const id of ids) {
      const node = findNode(doc.root, id)!;
      const props = node.type === source.type ? LOOK_COPY : SHARED_LOOK;
      for (const prop of props) {
        const value = sourceStyle[prop];
        if (value === undefined || effectiveStyle(node)[prop] === value) continue;
        if (prop === "borderRadius" && !BOXED_TYPES.includes(node.type)) continue;
        operations.push({ op: "setStyle", targets: [id], prop, value });
      }
    }
    if (operations.length === 0) return { ok: false, message: `The ${what} already look like the ${source.name}.` };
    return finish(doc, kind, operations, `Matched the ${source.name}${onWhat}`, ids);
  }

  const sameColor = raw.match(/\b(?:the\s+)?same\s+(?:([a-z]+)\s+)?(?:colou?r\s+)?as\s+(?:the\s+)?(.+?)(?=[.,;!]|\s+and\s+|$)/i);
  if (sameColor) {
    const source = resolveTarget(doc.root, sameColor[2], ids);
    const color = source && colorOf(source);
    if (!source || !color) return { ok: false, message: `I couldn't find a color on “${sameColor[2]}”.` };
    raw = raw.replace(sameColor[0], ` ${color} `);
  }
  if (/\bmy (accent|colou?r)\b/i.test(raw) && typeof profile.accent === "string") raw = raw.replace(/\bmy (accent|colou?r)\b/i, ` ${profile.accent.slice(0, 7)} `);

  const operations: Operation[] = [];
  let summary = "";
  let failure = "";
  const focusIds: string[] = [];
  for (const id of ids) {
    const result = interpretOne(doc, id, raw, profile);
    if (!result.ok) {
      failure ||= result.message;
      continue;
    }
    operations.push(...result.operations);
    summary ||= result.summary;
    focusIds.push(result.targetId);
  }
  if (operations.length === 0) return { ok: false, message: failure };
  const lowered = summary.charAt(0).toLowerCase() + summary.slice(1);
  return finish(doc, kind, operations, ids.length > 1 ? `${capitalize(lowered)}${onWhat}` : summary, [...new Set(focusIds)]);
}

const WARM = { surface: "#FFB27A", accent: "#F97316" };
const COOL = { surface: "#9CC3FF", accent: "#2563EB" };

export function interpretProject(doc: AppDoc, instruction: string, context: InterpretContext): Interpretation {
  const { kind, profile } = context;
  const text = instruction.trim().toLowerCase().slice(0, 300);
  if (!text) return { ok: false, message: "Describe how the whole thing should change." };
  const nodes = allNodes(doc.root);
  const operations: Operation[] = [];
  const phrases: string[] = [];
  const set = (node: AppNode, prop: StyleProp, value: string | number) => {
    if (effectiveStyle(node)[prop] !== value) operations.push({ op: "setStyle", targets: [node.id], prop, value });
  };

  if (/\b(my style|my look|my usual)\b/.test(text)) {
    if (Object.keys(profile).length === 0) return { ok: false, message: "Your style is still empty. Make a few changes and Direct will learn it." };
    operations.push(...applyProfile(doc, kind, profile));
    phrases.push("applied your style everywhere");
  }

  const warmer = /\b(warm|warmer|cozier|cosier|sunnier|toastier)\b/.test(text);
  const cooler = /\b(cool|cooler|colder|calmer|icier|fresher)\b/.test(text);
  if (warmer || cooler) {
    const tone = warmer ? WARM : COOL;
    for (const node of nodes) {
      const style = effectiveStyle(node);
      for (const prop of COLOR_PROPS) {
        const value = node.style[prop] ?? (prop === "backgroundColor" && (node.type === "screen" || BOXED_TYPES.includes(node.type)) ? style[prop] : undefined);
        if (typeof value !== "string" || isTransparent(value) || prop === "color") continue;
        const amount = prop === "accentColor" && node.type !== "screen" ? 0.35 : 0.2;
        set(node, prop, mix(value, prop === "accentColor" && node.type !== "screen" ? tone.accent : tone.surface, amount));
      }
      const background = effectiveStyle(node).backgroundColor;
      const textColor = style.color;
      if (node.style.color === undefined && node.type !== "screen") continue;
      if (typeof background === "string" && typeof textColor === "string" && !isTransparent(background)) {
        const next = operations.filter((o) => o.targets[0] === node.id && o.op === "setStyle" && o.prop === "backgroundColor").pop();
        const bg = next && next.op === "setStyle" ? String(next.value) : background;
        if (contrast(bg.slice(0, 7), textColor.slice(0, 7)) < 3) set(node, "color", readableOn(bg.slice(0, 7)));
      }
    }
    phrases.push(warmer ? "warmed up the colors" : "cooled down the colors");
  }

  const tighter = /\b(tighten|tighter|tight|compact|denser|less space|less spacing|less room)\b/.test(text);
  const looser = /\b(loosen|looser|roomier|airier|airy|spacious|more space|more spacing|more room|breathing room)\b/.test(text);
  if (tighter || looser) {
    const factor = tighter ? 0.7 : 1.35;
    for (const node of nodes) {
      const style = effectiveStyle(node);
      for (const prop of ["gap", "padding"] as StyleProp[]) {
        const value = style[prop];
        if (typeof value !== "number" || value === 0) continue;
        if (prop === "gap" && (node.children?.length ?? 0) < 2) continue;
        set(node, prop, Math.max(2, Math.round(value * factor)));
      }
    }
    phrases.push(tighter ? "tightened all the spacing" : "added breathing room everywhere");
  }

  const rounder = /\b(rounder|more rounded|round(ed)? (everything|corners)|softer)\b/.test(text);
  const sharper = /\b(sharper|square|squarer|less rounded|crisper)\b/.test(text);
  if (rounder || sharper) {
    for (const node of nodes) {
      if (!BOXED_TYPES.includes(node.type) || node.type === "screen" || node.type === "progress") continue;
      const radius = Number(effectiveStyle(node).borderRadius ?? 0);
      if (radius >= 999) continue;
      set(node, "borderRadius", rounder ? Math.min(48, radius + 10) : Math.max(0, radius - 10));
    }
    phrases.push(rounder ? "rounded every corner" : "sharpened every corner");
  }

  const biggerText = /\b(bigger|larger) (text|type|words|fonts?)\b|\b(text|type) bigger\b/.test(text);
  const smallerText = /\b(smaller) (text|type|words|fonts?)\b|\b(text|type) smaller\b/.test(text);
  if (biggerText || smallerText) {
    for (const node of nodes) {
      if (!TEXT_TYPES.includes(node.type)) continue;
      const size = Number(effectiveStyle(node).fontSize ?? 15);
      set(node, "fontSize", Math.round(size * (biggerText ? 1.12 : 0.9)));
    }
    phrases.push(biggerText ? "made all the text bigger" : "made all the text smaller");
  }

  if (/\b(bolder|bold)\b/.test(text)) {
    for (const node of nodes) if (node.type === "heading" || node.type === "clock") set(node, "fontWeight", 800);
    phrases.push("made the headings bolder");
  }

  const accent = text.match(new RegExp(`\\b(${COLOR_NAMES.join("|")})\\b`));
  if (accent && !warmer && !cooler) {
    const color = namedColor(accent[1])!;
    for (const node of nodes) {
      if (["button", "shape"].includes(node.type)) {
        set(node, "backgroundColor", color);
        set(node, "color", readableOn(color));
      }
      if (["progress", "habit"].includes(node.type)) set(node, "accentColor", color);
    }
    phrases.push(`made the accents ${accent[1]}`);
  }

  const allowed = operations.filter((operation) => operation.op !== "setStyle" || kind.ops.styles.includes(operation.prop));
  if (allowed.length === 0) {
    return {
      ok: false,
      message: phrases.length
        ? "That's already how it looks."
        : "Try “make it warmer”, “tighten the spacing”, “rounder corners”, “bigger text”, or “match my style”.",
    };
  }
  const summary = phrases.length > 1 ? `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}` : phrases[0];
  return { ok: true, operations: mergeOperations(allowed), summary: capitalize(summary), focusIds: [] };
}
