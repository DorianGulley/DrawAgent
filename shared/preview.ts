import { AppDoc } from "./model";
import { renderBody } from "./render";

const STYLES = String.raw`
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0;-webkit-text-size-adjust:100%}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif;-webkit-font-smoothing:antialiased;-webkit-user-select:none;user-select:none}
h2,p{margin:0}
h2{letter-spacing:-0.02em;line-height:1.12}
p{line-height:1.4}
.d-screen{display:flex;flex-direction:column;min-height:100vh;padding:calc(var(--inset-top,0px) + var(--pad)) var(--pad) calc(var(--inset-bottom,0px) + var(--pad))}
body.d-edit .d-screen{padding-bottom:calc(var(--sheet,300px) + var(--pad))}
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
#d-sel{position:absolute;pointer-events:none;border:2px solid #635BFF;border-radius:10px;z-index:1000;opacity:0;transition:opacity .18s ease;box-shadow:0 0 0 4px rgba(99,91,255,.16)}
#d-sel.on{opacity:1}
#d-sel .h{position:absolute;width:10px;height:10px;background:#fff;border:2px solid #635BFF;border-radius:3px}
#d-sel .tl{left:-6px;top:-6px}#d-sel .tr{right:-6px;top:-6px}#d-sel .bl{left:-6px;bottom:-6px}#d-sel .br{right:-6px;bottom:-6px}
#d-sel .tag{position:absolute;left:-2px;top:-30px;background:#635BFF;color:#fff;font:600 12px/1 -apple-system,sans-serif;padding:6px 9px;border-radius:8px;white-space:nowrap;letter-spacing:.01em}
#d-sel.below .tag{top:auto;bottom:-30px}
.d-flash{animation:d-flash 1.8s ease-out}
@keyframes d-flash{0%{box-shadow:0 0 0 0 rgba(99,91,255,.0)}15%{box-shadow:0 0 0 6px rgba(99,91,255,.45)}100%{box-shadow:0 0 0 18px rgba(99,91,255,0)}}
`;

const RUNTIME = String.raw`
(function(){
  var root = document.getElementById('d-root');
  var sel = document.getElementById('d-sel');
  var editMode = false, selectedId = null, doneState = {}, focus = null;
  function post(msg){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  function byId(id){ return root.querySelector('[data-direct-id="' + CSS.escape(id) + '"]'); }
  function syncBackground(){
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
    var el = selectedId && byId(selectedId);
    if (!editMode || !el) { sel.className = ''; return; }
    var r = el.getBoundingClientRect(), pad = 4;
    sel.style.left = (r.left + window.scrollX - pad) + 'px';
    sel.style.top = (r.top + window.scrollY - pad) + 'px';
    sel.style.width = (r.width + pad * 2) + 'px';
    sel.style.height = (r.height + pad * 2) + 'px';
    sel.querySelector('.tag').textContent = el.getAttribute('data-direct-label');
    sel.className = 'on' + (r.top < (window.__insetTop || 0) + 40 ? ' below' : '');
  }
  function reveal(el){
    var r = el.getBoundingClientRect(), top = (window.__insetTop || 0) + 12, bottom = window.innerHeight - 300;
    if (r.bottom > bottom) window.scrollBy({ top: Math.min(r.bottom - bottom, r.top - top), behavior: 'smooth' });
    else if (r.top < top) window.scrollBy({ top: r.top - top, behavior: 'smooth' });
  }
  function select(el){
    selectedId = el ? el.getAttribute('data-direct-id') : null;
    placeSelection();
    if (!el) { post({ type: 'deselect' }); return; }
    reveal(el);
    var name = el.querySelector('.d-habit-name, .d-stat-value');
    post({ type: 'select', id: selectedId, nodeType: el.getAttribute('data-direct-type'), label: el.getAttribute('data-direct-label'), text: (name || el).textContent.trim().slice(0, 60) });
  }
  document.addEventListener('click', function(e){
    var el = e.target.closest('[data-direct-id]');
    if (editMode) {
      e.preventDefault(); e.stopPropagation();
      document.body.classList.remove('d-hint');
      select(el);
      return;
    }
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
  window.addEventListener('resize', placeSelection);
  window.__direct = {
    render: function(html, changed){
      if (focus) { clearInterval(focus.interval); focus = null; }
      root.innerHTML = html;
      syncBackground(); applyDone();
      if (selectedId && !byId(selectedId)) selectedId = null;
      placeSelection();
      (changed || []).forEach(function(id, i){
        var el = byId(id);
        if (!el) return;
        el.classList.add('d-flash');
        if (i === 0) {
          var r = el.getBoundingClientRect();
          if (r.top < (window.__insetTop || 0) || r.bottom > window.innerHeight - 300) reveal(el);
        }
        setTimeout(function(){ el.classList.remove('d-flash'); placeSelection(); }, 1900);
      });
      setTimeout(placeSelection, 350);
    },
    setEditMode: function(on){
      editMode = on;
      document.body.classList.toggle('d-edit', on);
      if (on) { document.body.classList.add('d-hint'); setTimeout(function(){ document.body.classList.remove('d-hint'); }, 1400); }
      else { selectedId = null; }
      placeSelection();
    },
    select: function(id){ select(id ? byId(id) : null); }
  };
  syncBackground(); applyDone();
  post({ type: 'ready' });
})();
`;

export interface PreviewOptions {
  insetTop: number;
  insetBottom: number;
}

export function buildPreviewHtml(doc: AppDoc, { insetTop, insetBottom }: PreviewOptions): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><style>${STYLES}:root{--inset-top:${insetTop}px;--inset-bottom:${insetBottom}px}</style></head><body><div id="d-root">${renderBody(doc)}</div><div id="d-sel"><div class="tag"></div><div class="h tl"></div><div class="h tr"></div><div class="h bl"></div><div class="h br"></div></div><script>window.__insetTop=${insetTop};${RUNTIME}</script></body></html>`;
}
