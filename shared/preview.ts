import { KindSpec } from "./kinds";
import { AppDoc } from "./model";
import { AssetUrls, renderBody } from "./render";

const STYLES = String.raw`
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0;-webkit-text-size-adjust:100%}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif;-webkit-font-smoothing:antialiased;-webkit-user-select:none;user-select:none}
h2,p{margin:0}
h2{letter-spacing:-0.02em;line-height:1.12}
p{line-height:1.4}
.d-screen{display:flex;flex-direction:column;min-height:100vh;padding:calc(var(--inset-top,0px) + var(--pad)) var(--pad) calc(var(--inset-bottom,0px) + var(--pad))}
body.d-edit.k-flow .d-screen{padding-bottom:calc(var(--sheet,300px) + var(--pad))}
.d-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
.d-row{display:flex;flex-direction:row;align-items:center}
.d-row>.d-card{flex:1;min-width:0;align-self:stretch}
.d-shape{display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}
.d-shape .d-heading{line-height:1}
.d-clock{line-height:1;letter-spacing:-0.045em;font-variant-numeric:tabular-nums}
html.k-fixed{background:#E9E6E0;overflow:hidden;height:100%}
html.k-fixed body{height:100%;overflow:hidden}
.k-fixed #d-root{position:absolute;left:0;top:0;width:var(--cw);height:var(--ch);transform-origin:0 0;border-radius:22px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.08),0 24px 60px rgba(20,16,10,.18)}
.k-fixed .d-screen{min-height:0;height:100%;padding:var(--pad)}
.k-split .d-screen{padding-top:calc(var(--pad) + 64px)}
.k-split .d-header{margin-bottom:auto}
.k-center .d-screen{justify-content:center;align-items:center}
.k-center #d-root{border-radius:14px;background-color:#fff;background-image:linear-gradient(45deg,#EEE 25%,transparent 25%,transparent 75%,#EEE 75%),linear-gradient(45deg,#EEE 25%,transparent 25%,transparent 75%,#EEE 75%);background-size:32px 32px;background-position:0 0,16px 16px}
html.d-export,html.d-export body{background:transparent!important}
.d-export #d-root{border-radius:0!important;box-shadow:none!important;background:transparent!important}
.d-header,.d-card,.d-section{display:flex;flex-direction:column}
.d-card{box-shadow:0 1px 2px rgba(20,16,10,.04),0 8px 24px rgba(20,16,10,.05)}
.d-button{display:block;width:100%;border:0;font-family:inherit;letter-spacing:-0.01em;transition:transform .15s ease,filter .15s ease}
.d-button:active{transform:scale(.98);filter:brightness(.95)}
.d-badge{align-self:flex-start;display:inline-block}
.d-progress .d-track{height:var(--height,10px);background:var(--track,#ECE7DF);border-radius:inherit;overflow:hidden}
.d-progress{border-radius:999px}
.d-fill{height:100%;width:0;background:var(--accent);border-radius:inherit;transition:width .5s cubic-bezier(.2,.8,.2,1)}
.d-progress-meta{display:flex;justify-content:space-between;margin-top:8px;font-size:13px;opacity:.6;font-weight:500}
.d-habit{display:flex;align-items:center;gap:12px;box-shadow:0 1px 2px rgba(20,16,10,.04);transition:transform .15s ease}
.d-habit:active{transform:scale(.985)}
.d-check{width:26px;height:26px;border-radius:50%;border:2px solid rgba(0,0,0,.14);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .25s ease}
.d-check svg{width:16px;height:16px;fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;opacity:0;transform:scale(.6);transition:all .25s ease}
.d-habit[data-done="1"] .d-check{background:var(--accent);border-color:var(--accent)}
.d-habit[data-done="1"] .d-check svg{opacity:1;transform:scale(1)}
.d-habit[data-done="1"] .d-habit-name{opacity:.55;text-decoration:line-through}
.d-icon{font-size:20px;width:28px;text-align:center}
.d-habit-body{flex:1;min-width:0}
.d-habit-sub{font-size:13px;opacity:.55;margin-top:2px;font-weight:400}
.d-statGroup{display:grid;grid-template-columns:repeat(3,1fr)}
.d-stat{display:flex;flex-direction:column;gap:4px;box-shadow:0 1px 2px rgba(20,16,10,.04)}
.d-stat-value{letter-spacing:-0.02em;line-height:1.1}
.d-stat-label{font-size:12px;opacity:.55;font-weight:500}
body.d-edit [data-direct-id]{cursor:pointer}
body.d-edit.d-hint [data-direct-id]:not(.d-screen){outline:1.5px dashed rgba(99,91,255,.45);outline-offset:2px}
.d-sel{position:absolute;pointer-events:none;border:2px solid #635BFF;border-radius:10px;z-index:1000;box-shadow:0 0 0 4px rgba(99,91,255,.16);animation:d-in .18s ease}
.d-sel .tag{position:absolute;left:-2px;top:-30px;background:#635BFF;color:#fff;font:600 12px/1 -apple-system,sans-serif;padding:6px 9px;border-radius:8px;white-space:nowrap;letter-spacing:.01em}
.d-sel.below .tag{top:auto;bottom:-30px}
@keyframes d-in{from{opacity:0}to{opacity:1}}
.d-press{animation:d-press .5s ease}
@keyframes d-press{0%{transform:scale(1)}40%{transform:scale(.97)}100%{transform:scale(1)}}
.d-flash{animation:d-flash 1.8s ease-out}
.d-page{display:none;flex-direction:column}
.d-page.d-on{display:flex;animation:d-page .22s ease}
@keyframes d-page{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.d-screen[data-pages="1"]{padding-bottom:calc(var(--inset-bottom,0px) + var(--pad) + 76px)}
body.d-edit.k-flow .d-screen[data-pages="1"]{padding-bottom:calc(var(--sheet,300px) + var(--pad) + 76px)}
.d-tabs{position:fixed;left:12px;right:12px;bottom:calc(var(--inset-bottom,0px) + 10px);display:flex;gap:4px;padding:6px;border-radius:24px;background:rgba(255,255,255,.86);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);box-shadow:0 1px 2px rgba(0,0,0,.06),0 12px 32px rgba(20,16,10,.14);z-index:500;overflow-x:auto}
body.d-edit .d-tabs{bottom:calc(var(--sheet,300px) + 10px)}
.d-tab{flex:1;min-width:56px;border:0;background:transparent;border-radius:18px;padding:7px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:inherit;color:#1B1A17;opacity:.5;transition:all .2s ease}
.d-tab.d-on{opacity:1;background:var(--tab-accent,rgba(0,0,0,.06))}
.d-tab-icon{font-size:18px;line-height:1.1}
.d-tab-label{font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.d-image{overflow:hidden;display:flex;align-items:center;justify-content:center;width:100%;flex-shrink:0}
.d-image img{width:100%;height:100%;object-fit:cover;display:block;-webkit-user-drag:none}
.d-image-empty{font-size:13px;font-weight:600;opacity:.45}
.d-input{display:flex;align-items:center;border:1px solid rgba(0,0,0,.08)}
.d-input-text{opacity:.45}
.d-divider{width:100%;flex-shrink:0}
.d-link{cursor:pointer}
@keyframes d-flash{0%{box-shadow:0 0 0 0 rgba(99,91,255,.0)}15%{box-shadow:0 0 0 6px rgba(99,91,255,.45)}100%{box-shadow:0 0 0 18px rgba(99,91,255,0)}}
`;

const RUNTIME = String.raw`
(function(){
  var root = document.getElementById('d-root');
  var sels = document.getElementById('d-sels');
  var cfg = window.__cfg;
  var editMode = false, selected = [], selLabel = '', doneState = {}, focus = null, frame = { top: cfg.insetTop, bottom: cfg.insetBottom };
  var press = null, suppressClick = false, page = null;
  function pages(){ return Array.prototype.slice.call(root.querySelectorAll('.d-screen > .d-page')); }
  function showPage(id, animate){
    var all = pages();
    if (!all.length) return;
    var target = all.filter(function(p){ return p.getAttribute('data-direct-id') === id; })[0] || all.filter(function(p){ return p.getAttribute('data-direct-id') === page; })[0] || all[0];
    var changed = page !== target.getAttribute('data-direct-id');
    page = target.getAttribute('data-direct-id');
    all.forEach(function(p){ p.classList.toggle('d-on', p === target); });
    root.querySelectorAll('.d-tab').forEach(function(t){ t.classList.toggle('d-on', t.getAttribute('data-go') === page); });
    if (changed && animate) { window.scrollTo({ top: 0 }); post({ type: 'haptic' }); }
    setTimeout(placeSelection, 30);
  }
  function post(msg){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  function byId(id){ return root.querySelector('[data-direct-id="' + CSS.escape(id) + '"]'); }
  function fit(){
    if (cfg.layout === 'flow') return;
    var w = cfg.width, h = cfg.height, s, left, top;
    if (cfg.exporting) { s = window.innerWidth / w; left = 0; top = 0; }
    else {
      var aw = window.innerWidth - 40, ah = window.innerHeight - frame.top - frame.bottom - 24;
      s = Math.min(aw / w, ah / h, 1.2);
      left = (window.innerWidth - w * s) / 2; top = frame.top + 12 + Math.max(0, (ah - h * s) / 2);
    }
    root.style.transform = 'translate(' + left + 'px,' + top + 'px) scale(' + s + ')';
  }
  function syncBackground(){
    if (cfg.layout !== 'flow') return;
    var screen = root.querySelector('.d-screen');
    if (screen) document.documentElement.style.background = getComputedStyle(screen).backgroundColor;
  }
  function habits(){ return Array.prototype.slice.call(root.querySelectorAll('.d-habit')); }
  function applyDone(){
    habits().forEach(function(el){
      var id = el.getAttribute('data-direct-id');
      if (id in doneState) el.setAttribute('data-done', doneState[id] ? '1' : '0');
    });
    var all = habits(), done = all.filter(function(el){ return el.getAttribute('data-done') === '1'; }).length;
    var pct = all.length ? Math.round(done / all.length * 100) : 0;
    root.querySelectorAll('.d-progress').forEach(function(p){
      p.querySelector('.d-fill').style.width = pct + '%';
      p.querySelector('.d-count').textContent = done + ' of ' + all.length + ' done';
      p.querySelector('.d-percent').textContent = pct + '%';
    });
  }
  function placeSelection(){
    var els = editMode ? selected.map(byId).filter(Boolean) : [];
    while (sels.children.length > els.length) sels.removeChild(sels.lastChild);
    while (sels.children.length < els.length) { var d = document.createElement('div'); d.className = 'd-sel'; d.innerHTML = '<div class="tag"></div>'; sels.appendChild(d); }
    els.forEach(function(el, i){
      var box = sels.children[i], r = el.getBoundingClientRect(), pad = 3;
      box.style.left = (r.left + window.scrollX - pad) + 'px';
      box.style.top = (r.top + window.scrollY - pad) + 'px';
      box.style.width = (r.width + pad * 2) + 'px';
      box.style.height = (r.height + pad * 2) + 'px';
      var tag = box.querySelector('.tag');
      tag.style.display = i === 0 ? '' : 'none';
      tag.textContent = selLabel || el.getAttribute('data-direct-label');
      box.className = 'd-sel' + (r.top < frame.top + 40 ? ' below' : '');
    });
  }
  function reveal(el){
    if (cfg.layout !== 'flow') return;
    var r = el.getBoundingClientRect(), top = frame.top + 12, bottom = window.innerHeight - frame.bottom;
    if (r.bottom > bottom) window.scrollBy({ top: Math.min(r.bottom - bottom, r.top - top), behavior: 'smooth' });
    else if (r.top < top) window.scrollBy({ top: r.top - top, behavior: 'smooth' });
  }
  function describe(el){
    var name = el.matches('.d-habit, .d-stat') ? el.querySelector('.d-habit-name, .d-stat-value') : el.children.length ? el.querySelector('.d-heading') : null;
    return { id: el.getAttribute('data-direct-id'), nodeType: el.getAttribute('data-direct-type'), label: el.getAttribute('data-direct-label'), text: (name || el).textContent.trim().slice(0, 60) };
  }
  document.addEventListener('touchstart', function(e){
    if (!editMode) return;
    var el = e.target.closest('[data-direct-id]');
    if (!el) return;
    var t = e.touches[0];
    press = { el: el, x: t.clientX, y: t.clientY, timer: setTimeout(function(){
      suppressClick = true;
      el.classList.add('d-press');
      setTimeout(function(){ el.classList.remove('d-press'); }, 520);
      var info = describe(el); info.type = 'longpress'; post(info);
      press = null;
    }, 480) };
  }, { passive: true });
  document.addEventListener('touchmove', function(e){
    if (!press) return;
    var t = e.touches[0];
    if (Math.abs(t.clientX - press.x) > 8 || Math.abs(t.clientY - press.y) > 8) { clearTimeout(press.timer); press = null; }
  }, { passive: true });
  document.addEventListener('touchend', function(){ if (press) { clearTimeout(press.timer); press = null; } }, { passive: true });
  document.addEventListener('contextmenu', function(e){ if (editMode) e.preventDefault(); });
  document.addEventListener('click', function(e){
    var tab = e.target.closest('.d-tab');
    if (tab) { e.preventDefault(); e.stopPropagation(); showPage(tab.getAttribute('data-go'), true); return; }
    var el = e.target.closest('[data-direct-id]');
    if (editMode) {
      e.preventDefault(); e.stopPropagation();
      if (suppressClick) { suppressClick = false; return; }
      document.body.classList.remove('d-hint');
      if (!el) return;
      var info = describe(el); info.type = 'tap'; post(info);
      return;
    }
    var linked = e.target.closest('[data-target]');
    if (linked) { showPage(linked.getAttribute('data-target'), true); return; }
    var habit = e.target.closest('.d-habit');
    if (habit) {
      var id = habit.getAttribute('data-direct-id');
      doneState[id] = habit.getAttribute('data-done') !== '1';
      applyDone(); post({ type: 'haptic' });
      return;
    }
    var button = e.target.closest('[data-action]');
    if (!button) return;
    var action = button.getAttribute('data-action');
    if (action === 'completeAll') {
      var all = habits(), allDone = all.every(function(h){ return h.getAttribute('data-done') === '1'; });
      all.forEach(function(h){ doneState[h.getAttribute('data-direct-id')] = !allDone; });
      applyDone(); post({ type: 'haptic' });
    }
    if (action === 'startFocus') toggleFocus(button);
  }, true);
  function toggleFocus(button){
    var card = button.closest('.d-card') || root;
    var timer = Array.prototype.slice.call(card.querySelectorAll('.d-heading')).find(function(h){ return /^\d+:\d\d$/.test(h.textContent.trim()); });
    if (!timer) return;
    if (focus) { clearInterval(focus.interval); focus = null; button.style.opacity = ''; return; }
    var parts = timer.textContent.trim().split(':'), left = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    button.style.opacity = '.7';
    focus = { interval: setInterval(function(){
      left = Math.max(0, left - 1);
      var t = byId(timer.getAttribute('data-direct-id'));
      if (t) t.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
    }, 1000) };
    post({ type: 'haptic' });
  }
  window.addEventListener('scroll', placeSelection, { passive: true });
  window.addEventListener('resize', function(){ fit(); placeSelection(); });
  window.__direct = {
    render: function(html, changed){
      if (focus) { clearInterval(focus.interval); focus = null; }
      root.innerHTML = html;
      syncBackground(); applyDone(); showPage(page, false);
      selected = selected.filter(byId);
      placeSelection();
      (changed || []).forEach(function(id, i){
        var el = byId(id);
        if (!el) return;
        el.classList.add('d-flash');
        if (i === 0) {
          var holder = el.closest('.d-page');
          if (holder && !holder.classList.contains('d-on')) showPage(holder.getAttribute('data-direct-id'), false);
          var r = el.getBoundingClientRect();
          if (r.top < frame.top || r.bottom > window.innerHeight - frame.bottom) reveal(el);
        }
        setTimeout(function(){ el.classList.remove('d-flash'); placeSelection(); }, 1900);
      });
      setTimeout(placeSelection, 350);
    },
    setEditMode: function(on){
      editMode = on;
      document.body.classList.toggle('d-edit', on);
      if (on) { document.body.classList.add('d-hint'); setTimeout(function(){ document.body.classList.remove('d-hint'); }, 1400); }
      else { selected = []; }
      placeSelection();
    },
    setSelection: function(ids, label, focusId){
      selected = (ids || []).slice(); selLabel = label || '';
      placeSelection();
      var first = byId(focusId || selected[0] || '');
      var holder = first && first.closest('.d-page');
      if (holder && !holder.classList.contains('d-on')) showPage(holder.getAttribute('data-direct-id'), false);
      var el = focusId && byId(focusId);
      if (el) reveal(el);
    },
    hitTest: function(requestId, probes){
      var out = probes.map(function(probe){
        var ids = [];
        (probe.points || []).forEach(function(pt){
          var el = document.elementFromPoint(pt.x, pt.y);
          var hit = el && el.closest('[data-direct-id]');
          while (hit && ids.length < 4) {
            var id = hit.getAttribute('data-direct-id');
            if (ids.indexOf(id) === -1) ids.push(id);
            if (probe.kind !== 'area') break;
            hit = hit.parentElement && hit.parentElement.closest('[data-direct-id]');
          }
        });
        return ids.slice(0, 4).map(function(id){
          var el = byId(id);
          return { selector: id, tag: el.getAttribute('data-direct-type'), text: (el.textContent || '').trim().slice(0, 80), styles: {} };
        });
      });
      post({ type: 'hit', requestId: requestId, result: out });
    },
    setFrame: function(top, bottom){
      frame = { top: top, bottom: bottom };
      document.documentElement.style.setProperty('--sheet', bottom + 'px');
      fit(); setTimeout(placeSelection, 260);
    }
  };
  fit(); syncBackground(); applyDone(); showPage(null, false);
  post({ type: 'ready' });
})();
`;

export interface PreviewOptions {
  insetTop: number;
  insetBottom: number;
  canvas: KindSpec["canvas"];
  exporting?: boolean;
  assets?: AssetUrls;
}

export function buildPreviewHtml(doc: AppDoc, { insetTop, insetBottom, canvas, exporting = false, assets = {} }: PreviewOptions): string {
  const fixed = canvas.layout !== "flow";
  const htmlClass = [fixed ? "k-fixed" : "", exporting ? "d-export" : ""].join(" ");
  const cfg = { insetTop, insetBottom, layout: canvas.layout, width: canvas.width, height: canvas.height ?? 0, exporting };
  const size = fixed ? `--cw:${canvas.width}px;--ch:${canvas.height}px;` : "";
  return `<!doctype html><html class="${htmlClass}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><style>${STYLES}:root{--inset-top:${fixed ? 0 : insetTop}px;--inset-bottom:${fixed ? 0 : insetBottom}px;${size}}</style></head><body class="k-${canvas.layout}"><div id="d-root">${renderBody(doc, assets)}</div><div id="d-sels"></div><script>window.__cfg=${JSON.stringify(cfg)};${RUNTIME}</script></body></html>`;
}
