// Static Worker + Vercel-style API functions and rewrites.
import base from './worker.mjs';
import policy from './policy.json';
import { routes } from './api-index.mjs';

function vercelReq(request, url, body, extraQuery) {
  const headers = {};
  for (const [k, v] of request.headers) headers[k.toLowerCase()] = v;
  const query = Object.fromEntries(url.searchParams); Object.assign(query, extraQuery || {});
  const cookies = Object.fromEntries((headers.cookie || '').split(';').map(c => c.trim()).filter(Boolean).map(c => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
  return { method: request.method, url: url.pathname + url.search, headers, query, cookies, body };
}
function vercelRes() {
  const r = { statusCode: 200, headers: new Headers(), body: null, headersSent: false };
  r.setHeader = (k, v) => { if (Array.isArray(v)) { r.headers.delete(k); v.forEach(x => r.headers.append(k, String(x))); } else r.headers.set(k, String(v)); return r; };
  r.getHeader = k => r.headers.get(k); r.removeHeader = k => r.headers.delete(k);
  r.status = c => { r.statusCode = c; return r; };
  r.json = v => { r.headers.set('Content-Type', 'application/json; charset=utf-8'); r.body = JSON.stringify(v); return r; };
  r.send = v => { if (v !== null && typeof v === 'object' && !(v instanceof Uint8Array) && !(v instanceof ArrayBuffer)) return r.json(v); if (!r.headers.has('Content-Type')) r.headers.set('Content-Type', typeof v === 'string' ? 'text/html; charset=utf-8' : 'application/octet-stream'); r.body = v; return r; };
  r.redirect = (a, b) => { const [code, loc] = typeof a === 'number' ? [a, b] : [307, a]; r.statusCode = code; r.headers.set('Location', loc); return r; };
  r.writeHead = (c, h) => { r.statusCode = c; for (const [k, v] of Object.entries(h || {})) r.setHeader(k, v); return r; };
  r.write = v => { r.body = (r.body || '') + v; return true; };
  r.end = v => { if (v !== undefined) r.body = (r.body && typeof r.body === 'string' ? r.body : '') + v; return r; };
  return r;
}
async function parseBody(request) {
  if (['GET', 'HEAD'].includes(request.method)) return undefined;
  const type = (request.headers.get('content-type') || '').toLowerCase();
  const text = await request.text();
  if (type.includes('application/json')) { try { return JSON.parse(text); } catch { return text; } }
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text));
  return text;
}
function find(path) {
  path = path.replace(/\/$/, '') || '/';
  if (routes[path]) return [routes[path], {}];
  for (const [r, m] of Object.entries(routes)) {
    const cm = r.match(/^(.*)\/\[\.\.\.(\w+)\]$/);
    if (cm && path.startsWith(cm[1] + '/')) return [m, { [cm[2]]: path.slice(cm[1].length + 1).split('/') }];
    const dm = r.match(/^(.*)\/\[(\w+)\]$/);
    if (dm && path.startsWith(dm[1] + '/') && !path.slice(dm[1].length + 1).includes('/')) return [m, { [dm[2]]: path.slice(dm[1].length + 1) }];
  }
  return [null, {}];
}
function rewrite(url) {
  for (const rule of policy.config.rewrites || []) {
    if (rule.source === url.pathname) return new URL(rule.destination, url);
    const m = rule.source.match(/^(.*)\/:(\w+)\*$/);
    if (m && (url.pathname === m[1] || url.pathname.startsWith(m[1] + '/'))) {
      const rest = url.pathname.slice(m[1].length + 1);
      const u = new URL(rule.destination.replace(':' + m[2] + '*', rest), url);
      for (const [k, v] of url.searchParams) if (!u.searchParams.has(k)) u.searchParams.set(k, v);
      return u;
    }
  }
  return null;
}
export default {
  async fetch(request, env, ctx) {
    globalThis.process ??= { env: {} }; process.env ??= {};
    for (const [k, v] of Object.entries(env)) if (typeof v === 'string') process.env[k] = v;
    let url = new URL(request.url);
    if (!url.pathname.startsWith('/api/') || !find(url.pathname)[0]) { const r = rewrite(url); if (r) { url = r; request = new Request(r, request); } }
    const [mod, params] = find(url.pathname);
    if (mod) {
      const fn = mod.default || mod;
      if (mod.config?.runtime === 'edge') return fn(request, ctx);
      const res = vercelRes();
      await fn(vercelReq(request, url, await parseBody(request), params), res);
      const resp = new Response(res.body, { status: res.statusCode, headers: res.headers });
      for (const rule of policy.config.headers || []) if (rule.source === '/(.*)') for (const h of rule.headers) if (!resp.headers.has(h.key)) resp.headers.set(h.key, h.value);
      return resp;
    }
    return base.fetch(request, env, ctx);
  }
};
