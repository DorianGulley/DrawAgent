import { AppDoc, AppNode, SIZED_TYPES, StyleMap, TYPE_LABELS, effectiveStyle } from "./model";

export type AssetUrls = Record<string, string>;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function css(node: AppNode, style: StyleMap): string {
  const rules: string[] = [];
  const px = (value: unknown) => `${value}px`;
  if (style.color) rules.push(`color:${style.color}`);
  if (style.accentColor) rules.push(`--accent:${style.accentColor}`);
  if (style.fontSize) rules.push(`font-size:${px(style.fontSize)}`);
  if (style.fontWeight) rules.push(`font-weight:${style.fontWeight}`);
  if (style.textAlign) rules.push(`text-align:${style.textAlign}`);
  if (style.gap !== undefined) rules.push(`gap:${px(style.gap)}`);
  if (style.borderRadius !== undefined) rules.push(`border-radius:${px(style.borderRadius)}`);
  if (node.type === "progress") {
    if (style.backgroundColor) rules.push(`--track:${style.backgroundColor}`);
    if (style.height) rules.push(`--height:${px(style.height)}`);
    return rules.join(";");
  }
  if (node.type === "screen" && style.accentColor && style.backgroundColor)
    rules.push(`background:linear-gradient(180deg,${style.backgroundColor} 0%,${style.accentColor} 100%)`);
  else if (style.backgroundColor) rules.push(`background:${style.backgroundColor}`);
  if (node.type === "shape" && style.width) rules.push(`width:${px(style.width)}`);
  if (SIZED_TYPES.includes(node.type) && style.height) rules.push(`height:${px(style.height)}`);
  const padding = Number(style.padding ?? 0);
  if (node.type === "screen") rules.push(`--pad:${px(padding)}`);
  else if (node.type === "button") rules.push(`padding:${px(padding)} ${px(Math.round(padding * 1.4))}`);
  else if (node.type === "badge") rules.push(`padding:${px(padding)} ${px(Math.round(padding * 1.8))}`);
  else if (style.padding !== undefined) rules.push(`padding:${px(padding)}`);
  return rules.join(";");
}

function renderNode(node: AppNode, assets: AssetUrls): string {
  const style = effectiveStyle(node);
  const link = node.target ? ` data-target="${escapeHtml(node.target)}"` : "";
  const attrs = `data-direct-id="${escapeHtml(node.id)}" data-direct-type="${node.type}" data-direct-label="${TYPE_LABELS[node.type]}" class="d-${node.type}${node.target ? " d-link" : ""}" style="${css(node, style)}"${link}`;
  const text = escapeHtml(node.text ?? "");
  const children = (node.children ?? []).map((child) => renderNode(child, assets)).join("");
  switch (node.type) {
    case "heading":
      return `<h2 ${attrs}>${text}</h2>`;
    case "text":
      return `<p ${attrs}>${text}</p>`;
    case "badge":
      return `<span ${attrs}>${text}</span>`;
    case "button":
      return `<button ${attrs} data-action="${node.action ?? ""}">${text}</button>`;
    case "progress":
      return `<div ${attrs}><div class="d-track"><div class="d-fill"></div></div><div class="d-progress-meta"><span class="d-count"></span><span class="d-percent"></span></div></div>`;
    case "habit":
      return `<div ${attrs} data-done="${node.done ? "1" : "0"}"><div class="d-check"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></div><div class="d-icon">${escapeHtml(node.icon ?? "")}</div><div class="d-habit-body"><div class="d-habit-name">${text}</div><div class="d-habit-sub">${escapeHtml(node.subtext ?? "")}</div></div></div>`;
    case "stat":
      return `<div ${attrs}><div class="d-stat-value">${text}</div><div class="d-stat-label">${escapeHtml(node.subtext ?? "")}</div></div>`;
    case "clock":
      return `<div ${attrs}>${text}</div>`;
    case "page":
      return `<section ${attrs}>${children}</section>`;
    case "image": {
      const url = node.src ? assets[node.src] : undefined;
      return url && /^https:\/\//.test(url)
        ? `<div ${attrs}><img src="${escapeHtml(url)}" alt="" draggable="false"></div>`
        : `<div ${attrs}><span class="d-image-empty">${node.src ? "Loading photo" : "Photo"}</span></div>`;
    }
    case "input":
      return `<div ${attrs}><span class="d-input-text">${text}</span></div>`;
    case "divider":
      return `<div ${attrs}></div>`;
    case "screen": {
      const pages = (node.children ?? []).filter((child) => child.type === "page");
      if (pages.length === 0) return `<main ${attrs}>${children}</main>`;
      const tabs = pages
        .map((page) => `<button class="d-tab" data-go="${escapeHtml(page.id)}"><span class="d-tab-icon">${escapeHtml(page.icon ?? "•")}</span><span class="d-tab-label">${escapeHtml(page.text || page.name)}</span></button>`)
        .join("");
      return `<main ${attrs} data-pages="1">${children}<nav class="d-tabs">${tabs}</nav></main>`;
    }
    default:
      return `<div ${attrs}>${children}</div>`;
  }
}

export function renderBody(doc: AppDoc, assets: AssetUrls = {}): string {
  return renderNode(doc.root, assets);
}
