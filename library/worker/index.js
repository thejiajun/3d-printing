// Serves the static site (Workers Assets) and streams /data/* from the private R2 bucket.
// /data/private/* (full backup of ../models) is owner-only. Sign-in is handled by
// Cloudflare Access, which protects /owner/* and /data/private/*; the Worker also
// verifies the Access JWT itself so a misconfigured Access app cannot leak files.
import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks = null;

async function isOwner(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return false;
  const token = request.headers.get('cf-access-jwt-assertion')
    ?? request.headers.get('cookie')?.match(/CF_Authorization=([^;]+)/)?.[1];
  if (!token) return false;
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  jwks ??= createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  try {
    await jwtVerify(token, jwks, { issuer, audience: env.ACCESS_AUD });
    return true;
  } catch {
    return false;
  }
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

    // Access puts its login page in front of this path; once through, go back to the site.
    if (url.pathname === '/owner/login') {
      const back = url.searchParams.get('back') ?? '/';
      return Response.redirect(new URL(back.startsWith('/') ? back : '/', url), 302);
    }
    if (url.pathname === '/owner/logout') {
      return Response.redirect(new URL('/cdn-cgi/access/logout', url), 302);
    }
    if (url.pathname === '/api/me') {
      return Response.json({ owner: await isOwner(request, env) }, { headers: { 'cache-control': 'no-store' } });
    }
    if (url.pathname.startsWith('/data/')) {
      return handleData(request, env, decodeURIComponent(url.pathname.slice('/data/'.length)));
    }
    return env.ASSETS.fetch(request);
  },
};
