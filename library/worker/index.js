// Serves the static site (Workers Assets) and streams /data/* from the private R2 bucket.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/data/')) return env.ASSETS.fetch(request);

    const key = decodeURIComponent(url.pathname.slice('/data/'.length));
    const object = await env.LIBRARY.get(key, { onlyIf: request.headers, range: request.headers });
    if (!object) return new Response('Not found', { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    // Assets are content-addressed and never change; the catalog does.
    headers.set('cache-control', key === 'catalog.json'
      ? 'public, max-age=60, must-revalidate'
      : 'public, max-age=31536000, immutable');
    if (!('body' in object)) return new Response(null, { status: 304, headers });
    return new Response(object.body, { headers });
  },
};
