// Traductor en vivo ES → FR para toda la interfaz. Conserva los originales para volver a ES.
import { FR } from './fr-dict';

type Plantilla = { re: RegExp; fr: string };
const exacto = new Map<string, string>();
const plantillas: Plantilla[] = [];
for (const [k, v] of Object.entries(FR)) {
  if (/\{\w+\}/.test(k)) {
    const re = new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\w+\}/g, '(.+?)') + '$', 's');
    const nombres = [...k.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
    plantillas.push({ re, fr: v.replace(/\{(\w+)\}/g, (_x, n) => '{' + nombres.indexOf(n) + '}') });
  } else exacto.set(k, v);
}
plantillas.sort((a, b) => b.re.source.length - a.re.source.length);
const cache = new Map<string, string>();

function uno(s: string): string | null {
  const e = exacto.get(s); if (e !== undefined) return e;
  const md = /^([A-Za-zñ]+) de (\d{4})$/.exec(s); if (md && exacto.has(md[1].toLowerCase())) return trad(md[1]) + ' ' + md[2];
  for (const p of plantillas) {
    const m = p.re.exec(s);
    if (m) return p.fr.replace(/\{(\d+)\}/g, (_x, i) => { const c = m[Number(i) + 1]; return trad(c); });
  }
  return null;
}
export function trad(s: string): string {
  if (!s || !/[A-Za-zÀ-ÿ]/.test(s)) return s;
  const c = cache.get(s); if (c !== undefined) return c;
  const ini = s.match(/^\s*/)![0], fin = s.match(/\s*$/)![0]; const core = s.trim();
  const dir = uno(s); let r: string | null = dir ?? uno(core);
  if (r === null && core.includes(' · ')) {
    const partes = core.split(' · '); let cambio = false;
    const t = partes.map(p => { const x = uno(p); if (x !== null) { cambio = true; return x; } return p; });
    if (cambio) r = t.join(' · ');
  }
  if (r === null && core.includes('\n')) { r = core.split('\n').map(trad).join('\n'); }
  const out = r === null ? s : (dir !== null ? r : ini + r + fin);
  cache.set(s, out); return out;
}

const ATTR = ['placeholder', 'title', 'aria-label', 'alt'];
const nodos = new Map<Text, { o: string; t: string }>();
const attrs = new Map<Element, Record<string, { o: string; t: string }>>();
let activo = false; let obs: MutationObserver | null = null; let timer: any = null;

function origen(n: Text) { const r = nodos.get(n); return r && n.data === r.t ? r.o : n.data; }
function pasada(root: Node, fr: boolean) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let cur: Node | null = w.currentNode; const runs: Text[][] = []; let run: Text[] = []; const els: Element[] = [];
  const cierra = () => { if (run.length) runs.push(run); run = []; };
  while ((cur = w.nextNode())) {
    if (cur.nodeType === 3) {
      const p = (cur as Text).parentElement; if (p && /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.tagName)) continue;
      run.push(cur as Text);
    } else { cierra(); els.push(cur as Element); }
  }
  cierra();
  for (const r of runs) {
    const os = r.map(origen); const joined = os.join('');
    const tt = fr ? trad(joined) : joined;
    let porNodo: string[] | null = null;
    if (fr && tt === joined && r.length > 1) { const x = os.map(trad); if (x.join('') !== joined) porNodo = x; }
    r.forEach((n, i) => {
      const nuevo = porNodo ? porNodo[i] : tt !== joined ? (i === 0 ? tt : '') : os[i];
      if (n.data !== nuevo) n.data = nuevo;
      if (nuevo !== os[i]) nodos.set(n, { o: os[i], t: nuevo }); else nodos.delete(n);
    });
  }
  for (const el of els) {
    for (const a of ATTR) {
      const v = el.getAttribute(a); if (v === null) continue;
      const reg = attrs.get(el) || {}; const r = reg[a];
      const o = r && v === r.t ? r.o : v; const t = fr ? trad(o) : o;
      if (t !== v) el.setAttribute(a, t);
      if (t !== o) { reg[a] = { o, t }; attrs.set(el, reg); } else if (r) { delete reg[a]; }
    }
  }
}
function correr() {
  if (!obs) return;
  obs.disconnect();
  try { pasada(document.body, activo); } finally { obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR }); }
}
function pedir() { if (timer) return; timer = setTimeout(() => { timer = null; correr(); }, 25); }

let envuelto = false;
function envolver() {
  if (envuelto) return; envuelto = true;
  const a = window.alert.bind(window), c = window.confirm.bind(window), p = window.prompt.bind(window);
  window.alert = (m?: any) => a(activo ? trad(String(m ?? '')) : m);
  window.confirm = (m?: any) => c(activo ? trad(String(m ?? '')) : m);
  window.prompt = (m?: any, d?: string) => p(activo ? trad(String(m ?? '')) : m, d);
}
export function activarTraductor(fr: boolean) {
  if (typeof document === 'undefined') return;
  envolver();
  activo = fr;
  if (!obs) obs = new MutationObserver(pedir);
  correr();
}
