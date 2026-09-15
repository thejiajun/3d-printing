// Serves the static site (Workers Assets) and streams /data/* from the private R2 bucket.
// /data/private/* (full backup of ../models) is only served to the owner, who signs in
// with OWNER_PASSWORD (a Worker secret) and gets an HMAC-signed session cookie.

const COOKIE = 'owner_session';
const SESSION_DAYS = 90;
const encoder = new TextEncoder();

async function hmac(env, message) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(`session:${env.OWNER_PASSWORD}`),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]);
}

function timingSafeEqual(a, b) {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  if (x.length !== y.length) return false;
  return crypto.subtle.timingSafeEqual(x, y);
}

async function isOwner(request, env) {
  if (!env.OWNER_PASSWORD) return false;
  const value = request.headers.get('cookie')?.match(new RegExp(`${COOKIE}=([^;]+)`))?.[1];
  if (!value) return false;
  const [expires, sig] = value.split('.');
  if (!(Number(expires) > Date.now())) return false;
  return timingSafeEqual(sig ?? '', await hmac(env, expires));
}

const json = (body, init = {}) => new Response(JSON.stringify(body), {
  ...init, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...init.headers },
});

async function handleApi(request, env, path) {
  if (path === '/api/me') return json({ owner: await isOwner(request, env) });

  if (path === '/api/login' && request.method === 'POST') {
    const { password } = await request.json().catch(() => ({}));
    if (!env.OWNER_PASSWORD || typeof password !== 'string' || !timingSafeEqual(password, env.OWNER_PASSWORD)) {
      await new Promise((r) => setTimeout(r, 800)); // slow down guessing
      return json({ owner: false }, { status: 401 });
    }
    const expires = String(Date.now() + SESSION_DAYS * 86400_000);
    const cookie = `${COOKIE}=${expires}.${await hmac(env, expires)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
    return json({ owner: true }, { headers: { 'set-cookie': cookie } });
  }

  if (path === '/api/logout' && request.method === 'POST') {
    return json({ owner: false }, { headers: { 'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } });
  }
  return json({ error: 'not found' }, { status: 404 });
}

async function handleData(request, env, key) {
  const isPrivate = key.startsWith('private/');
  // Hide private objects entirely from visitors (404, not 403).
  if (isPrivate && !(await isOwner(request, env))) return new Response('Not found', { status: 404 });

  const object = await env.LIBRARY.get(key, { onlyIf: request.headers, range: request.headers });
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', isPrivate ? 'private, no-store'
    // Assets are content-addressed and never change; the catalog does.
    : key === 'catalog.json' ? 'public, max-age=60, must-revalidate'
      : 'public, max-age=31536000, immutable');
  if (!('body' in object)) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url.pathname);
    if (url.pathname.startsWith('/data/')) {
      return handleData(request, env, decodeURIComponent(url.pathname.slice('/data/'.length)));
    }
    return env.ASSETS.fetch(request);
  },
};
