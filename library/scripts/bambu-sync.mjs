// Bambu Cloud print history -> data/bambu-tasks.json
// Unofficial API (same one Bambu Studio / Handy use), documented by the community:
// https://github.com/coelacant1/Bambu-Lab-Cloud-API
//
//   node scripts/bambu-sync.mjs login --email you@x.com            # emails a 6-digit code
//   node scripts/bambu-sync.mjs login --email you@x.com --code 123456  # stores token in .env.local
//   node scripts/bambu-sync.mjs tasks                               # fetches every print
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = join(ROOT, '.env.local');
const API = 'https://api.bambulab.com';
const HEADERS = { 'Content-Type': 'application/json', 'User-Agent': 'bambu_network_agent/01.09.05.01' };

function readEnv() {
  if (!existsSync(ENV_FILE)) return {};
  return Object.fromEntries(readFileSync(ENV_FILE, 'utf8').split('\n')
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
}

function writeEnv(patch) {
  const env = { ...readEnv(), ...patch };
  writeFileSync(ENV_FILE, `${Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n')}\n`, { mode: 0o600 });
}

async function call(method, path, { body, token } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { ...HEADERS, ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function login({ email, code }) {
  if (!email) throw new Error('--email is required');
  if (!code) {
    await call('POST', '/v1/user-service/user/sendemail/code', { body: { email, type: 'codeLogin' } });
    console.log(`Code sent to ${email}. Re-run with --code <6 digits>.`);
    return;
  }
  const res = await call('POST', '/v1/user-service/user/login', { body: { account: email, code } });
  if (!res.accessToken) throw new Error(`login failed: ${JSON.stringify(res)}`);
  writeEnv({ BAMBU_TOKEN: res.accessToken, BAMBU_REFRESH_TOKEN: res.refreshToken ?? '' });
  console.log(`Logged in; token stored in .env.local (expires in ~${Math.round((res.expiresIn ?? 0) / 86400)} days).`);
}

async function tasks() {
  const token = process.env.BAMBU_TOKEN ?? readEnv().BAMBU_TOKEN;
  if (!token) throw new Error('No BAMBU_TOKEN. Run: npm run bambu:login -- --email you@example.com');
  const all = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await call('GET', `/v1/user-service/my/tasks?limit=${limit}&offset=${offset}`, { token });
    const hits = page.hits ?? [];
    // Guard against the API ignoring offset and returning the same page forever.
    const fresh = hits.filter((h) => !all.some((a) => a.id === h.id));
    all.push(...fresh);
    if (hits.length < limit || !fresh.length || all.length >= (page.total ?? Infinity)) break;
  }
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(join(ROOT, 'data/bambu-tasks.json'), JSON.stringify(all, null, 2));
  console.log(`Saved ${all.length} prints to data/bambu-tasks.json`);
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { email: { type: 'string' }, code: { type: 'string' } },
});
const cmd = positionals[0];
if (cmd === 'login') await login(values);
else if (cmd === 'tasks') await tasks();
else console.log('usage: bambu-sync.mjs login --email <email> [--code <code>] | tasks');
