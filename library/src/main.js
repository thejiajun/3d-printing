import './style.css';
import { createViewer, snapshot } from './viewer.js';

const DATA = import.meta.env.VITE_DATA_BASE ?? '/data';
const app = document.querySelector('#app');
const state = { catalog: null, filter: 'all', query: '', viewer: null };

const SOURCE_LABEL = { original: '自己设计', download: '下载的', cloud: '仅打印记录' };
const FILTERS = [['all', '全部'], ['original', '自己设计'], ['download', '下载的'], ['cloud', '仅打印记录']];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const asset = (key) => (/^https?:/.test(key) ? key : `${DATA}/${key}`);
const dateFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'short', day: 'numeric' });
const fmtDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : '—');
const fmtDuration = (sec) => {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h} 小时 ${m} 分` : `${m} 分钟`;
};
const PRINT_STATUS = { 2: '完成', 3: '失败', 1: '打印中' };

// ---- List page --------------------------------------------------------------

function visibleProjects() {
  const q = state.query.trim().toLowerCase();
  return state.catalog.projects.filter((p) =>
    (state.filter === 'all' || p.source === state.filter)
    && (!q || [p.title, p.designer, ...p.versions.map((v) => v.name)].join(' ').toLowerCase().includes(q)));
}

function renderList() {
  disposeViewer();
  const { projects } = state.catalog;
  const prints = projects.flatMap((p) => p.prints);
  const grams = prints.reduce((n, t) => n + (t.weight ?? 0), 0);

  app.innerHTML = `
    <header class="top">
      <div>
        <h1>打印库</h1>
        <p class="stats">${projects.length} 个模型${prints.length ? ` · 打印 ${prints.length} 次 · 耗材 ${(grams / 1000).toFixed(2)} kg` : ''}</p>
      </div>
      <input class="search" type="search" placeholder="搜索模型" value="${esc(state.query)}" aria-label="搜索模型">
    </header>
    <nav class="filters">
      ${FILTERS.filter(([k]) => k === 'all' || projects.some((p) => p.source === k)).map(([k, label]) => `
        <button class="chip" aria-pressed="${state.filter === k}" data-filter="${k}">${label}</button>`).join('')}
    </nav>
    <main class="grid"></main>`;

  app.querySelector('.search').addEventListener('input', (e) => { state.query = e.target.value; renderCards(); });
  app.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
    state.filter = b.dataset.filter;
    app.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === b));
    renderCards();
  }));
  renderCards();
}

function renderCards() {
  const grid = app.querySelector('.grid');
  const list = visibleProjects();
  if (!list.length) {
    grid.innerHTML = '<p class="empty">没有匹配的模型</p>';
    return;
  }
  grid.innerHTML = list.map((p) => {
    const sub = p.lastPrintedAt
      ? `打印 ${p.prints.length} 次 · ${fmtDate(p.lastPrintedAt)}`
      : `${p.versions.length > 1 ? `${p.versions.length} 个版本 · ` : ''}${fmtDate(p.updatedAt)}`;
    return `
      <a class="card" href="#/m/${encodeURIComponent(p.id)}">
        <div class="thumb" data-glb="${p.cover ? '' : esc(p.versions[0]?.glb ?? '')}">
          ${p.cover ? `<img src="${esc(asset(p.cover))}" alt="" loading="lazy">` : ''}
        </div>
        <div class="card-body">
          <h2>${esc(p.title)}</h2>
          <p>${sub}</p>
        </div>
      </a>`;
  }).join('');
  lazySnapshots(grid);
}

// Cards without an image get a rendered thumbnail once they scroll into view.
function lazySnapshots(grid) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      snapshot(asset(e.target.dataset.glb)).then((src) => {
        e.target.innerHTML = `<img src="${src}" alt="">`;
      }).catch(() => {});
    }
  }, { rootMargin: '200px' });
  grid.querySelectorAll('.thumb[data-glb]:not([data-glb=""])').forEach((el) => io.observe(el));
}

// ---- Detail page ------------------------------------------------------------

function renderDetail(id, versionHash) {
  const p = state.catalog.projects.find((x) => x.id === id);
  if (!p) return renderList();
  const version = p.versions.find((v) => v.hash === versionHash) ?? p.versions[0];

  // Switching versions only swaps the model, keeping the viewer and scroll position.
  if (state.viewer?.projectId === id && version) {
    selectVersion(p, version);
    return;
  }
  disposeViewer();
  window.scrollTo(0, 0);

  app.innerHTML = `
    <div class="detail">
      <section class="stage">
        <div class="canvas"></div>
        ${version ? `
          <div class="stage-bar">
            <div><a class="ghost stage-back" href="#/">←</a><span class="dims"></span></div>
            <button class="ghost reset">重置视角</button>
          </div>
          <p class="hint">拖动旋转 · 滚轮或双指缩放 · 右键平移</p>` : `
          ${p.cover ? `<img class="fallback" src="${esc(asset(p.cover))}" alt="">` : ''}
          <p class="hint">这个模型是从云端打印的，本地没有文件，所以只有封面</p>`}
      </section>
      <aside class="info">
        <a class="back" href="#/">← 打印库</a>
        <h1>${esc(p.title)}</h1>
        <p class="byline">
          <span class="badge">${p.remix ? '改件' : SOURCE_LABEL[p.source]}</span>
        </p>
        ${p.designer ? `
          <p class="credit">
            ${p.remix ? '基于' : '设计'} <strong>${esc(p.designer)}</strong> 的作品${p.license ? ` · ${esc(p.license)}` : ''}
            ${p.sourceUrl ? `<br><a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener">MakerWorld 原页面 ↗</a>` : ''}
          </p>` : ''}
        <div class="actions">
          ${version?.file ? `<a class="button download" href="${esc(asset(version.file))}" download>下载 ${version.format.toUpperCase()}</a>` : ''}
          ${!p.downloadable && p.sourceUrl ? `
            <a class="button" href="${esc(p.sourceUrl)}" target="_blank" rel="noopener">到 MakerWorld 下载 ↗</a>
            <p class="muted note">原作者的授权不允许转发文件，请到原页面下载</p>` : ''}
        </div>

        ${p.versions.length > 1 ? `
          <h3>版本 <span class="count">${p.versions.length}</span></h3>
          <ol class="versions">
            ${p.versions.map((v) => `
              <li><a href="#/m/${encodeURIComponent(p.id)}/${v.hash}" data-hash="${v.hash}">
                <span class="v-name">${esc(v.name)}</span>
                <span class="v-meta">${v.format.toUpperCase()} · ${fmtDate(v.updatedAt)}</span>
              </a></li>`).join('')}
          </ol>` : ''}

        <h3>打印记录 <span class="count">${p.prints.length}</span></h3>
        ${p.prints.length ? `
          <ul class="prints">
            ${p.prints.map((t) => `
              <li>
                <div><strong>${fmtDate(t.startTime)}</strong>${t.status !== 2 && PRINT_STATUS[t.status] ? ` <span class="badge warn">${PRINT_STATUS[t.status]}</span>` : ''}</div>
                <div class="p-meta">${[t.weight && `${t.weight.toFixed(1)} g`, fmtDuration(t.costTime), t.device, t.plate].filter(Boolean).map(esc).join(' · ')}</div>
              </li>`).join('')}
          </ul>` : `<p class="muted">${state.catalog.printsSynced ? '拓竹云端没有匹配到这个模型的打印记录' : '还没同步拓竹打印记录'}</p>`}

        ${version ? `<p class="file muted">文件 <code>${esc(version.path)}</code></p>` : ''}
      </aside>
    </div>`;

  if (!version) return;
  const viewer = createViewer(app.querySelector('.canvas'));
  state.viewer = { projectId: id, viewer };
  app.querySelector('.reset').addEventListener('click', () => viewer.resetView());
  selectVersion(p, version);
}

async function selectVersion(p, version) {
  const { viewer } = state.viewer;
  app.querySelectorAll('.versions a').forEach((a) => a.setAttribute('aria-current', a.dataset.hash === version.hash));
  app.querySelector('.file code').textContent = version.path;
  const download = app.querySelector('.download');
  if (download) {
    download.href = asset(version.file);
    download.textContent = `下载 ${version.format.toUpperCase()}`;
  }
  const stageEl = app.querySelector('.stage');
  stageEl.classList.add('loading');
  try {
    const size = await viewer.show(asset(version.glb));
    if (size) {
      app.querySelector('.dims').textContent = `${size.x.toFixed(0)} × ${size.z.toFixed(0)} × ${size.y.toFixed(0)} mm`;
    }
  } catch (err) {
    console.error(err);
    app.querySelector('.dims').textContent = '模型加载失败';
  } finally {
    stageEl.classList.remove('loading');
  }
}

function disposeViewer() {
  state.viewer?.viewer.dispose();
  state.viewer = null;
}

// ---- Router -----------------------------------------------------------------

function route() {
  const [, page, id, hash] = location.hash.split('/');
  if (page === 'm' && id) renderDetail(decodeURIComponent(id), hash);
  else renderList();
}

async function boot() {
  try {
    const res = await fetch(`${DATA}/catalog.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    state.catalog = await res.json();
  } catch {
    app.innerHTML = '<p class="empty">目录还没生成。先运行 <code>npm run catalog</code>。</p>';
    return;
  }
  addEventListener('hashchange', route);
  route();
}

boot();
