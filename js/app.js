const POLL_INTERVAL = 3000;
const DATA_URL = 'data/content.json';
const POSTS_URL = 'data/posts.json';

let lastHash = '';
let contentData = null;
let postsData = [];

const app = document.getElementById('app');
const loading = document.getElementById('loading');
const footer = document.getElementById('footer');
const updateStatus = document.getElementById('update-status');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function hashContent(data, posts) {
  return JSON.stringify({ data, posts });
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function mergePosts(remote, local) {
  const map = new Map();
  [...remote, ...local].forEach((p) => map.set(p.id, p));
  return [...map.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderHero(meta) {
  return `
    <section class="hero" id="hero">
      <div class="hero-badge">📜 光荣事迹档案 · 永久陈列</div>
      <h1 class="hero-title">${escapeHtml(meta.title)}</h1>
      <p class="hero-subtitle">${escapeHtml(meta.subtitle)}</p>
      <div class="hero-subject">
        <div class="hero-subject-label">瓜主</div>
        <div class="hero-subject-name">${escapeHtml(meta.subject)}</div>
      </div>
      <p class="hero-intro">${escapeHtml(meta.intro)}</p>
      <p class="hero-disclaimer">${escapeHtml(meta.disclaimer)}</p>
      <div class="hero-scroll">↓ 向下翻阅档案</div>
    </section>
  `;
}

function renderStats(stats) {
  const cards = stats.map((s) => `
    <div class="stat-card">
      <div class="stat-value">${escapeHtml(s.value)}<span class="stat-unit">${escapeHtml(s.unit)}</span></div>
      <div class="stat-label">${escapeHtml(s.label)}</div>
    </div>
  `).join('');

  return `
    <section class="section" id="stats">
      <div class="section-header">
        <div class="section-tag">DATA</div>
        <h2 class="section-title">事迹数据一览</h2>
      </div>
      <div class="stats-grid">${cards}</div>
    </section>
  `;
}

function renderHighlights(highlights) {
  const cards = highlights.map((h) => `
    <div class="highlight-card">
      <div class="highlight-icon">${h.icon}</div>
      <div class="highlight-title">${escapeHtml(h.title)}</div>
      <div class="highlight-desc">${escapeHtml(h.desc)}</div>
    </div>
  `).join('');

  return `
    <section class="section" id="highlights">
      <div class="section-header">
        <div class="section-tag">HIGHLIGHTS</div>
        <h2 class="section-title">核心光荣事迹</h2>
      </div>
      <div class="highlights-grid">${cards}</div>
    </section>
  `;
}

function renderPosts(posts) {
  if (!posts || posts.length === 0) return '';

  const cards = posts.map((p) => {
    const critical = p.severity === 'critical';
    return `
      <article class="post-card${critical ? ' critical' : ''}">
        <div class="post-head">
          <h3 class="post-title">${escapeHtml(p.title)}</h3>
          <div class="post-meta">
            ${critical ? '<span class="episode-badge">⚠ 严重</span>' : ''}
            <span class="episode-time">${escapeHtml(p.time)}</span>
          </div>
        </div>
        <p class="post-content">${escapeHtml(p.content)}</p>
        <div class="post-footer">
          <span class="post-author">${escapeHtml(p.author)}</span>
          <span class="post-date">${formatDate(p.createdAt)}</span>
        </div>
      </article>
    `;
  }).join('');

  return `
    <section class="section" id="feed">
      <div class="section-header">
        <div class="section-tag">LIVE</div>
        <h2 class="section-title">最新投稿</h2>
      </div>
      <div class="posts-list">${cards}</div>
    </section>
  `;
}

function renderEpisodes(episodes) {
  return episodes.map((ep) => {
    const items = ep.items.map((item) => `
      <div class="event-item">
        <div class="event-title">${escapeHtml(item.title)}</div>
        <div class="event-content">${escapeHtml(item.content)}</div>
      </div>
    `).join('');

    const criticalClass = ep.severity === 'critical' ? ' critical' : '';
    const badge = ep.severity === 'critical'
      ? '<span class="episode-badge">⚠ 严重</span>' : '';

    return `
      <article class="episode${criticalClass}">
        <div class="episode-head">
          <span class="episode-title">${escapeHtml(ep.title)}</span>
          <div style="display:flex;gap:8px;align-items:center">
            ${badge}
            <span class="episode-time">${escapeHtml(ep.time)}</span>
          </div>
        </div>
        <div class="episode-body">${items}</div>
      </article>
    `;
  }).join('');
}

function renderChapters(chapters) {
  const content = chapters.map((ch) => `
    <div class="chapter">
      <div class="chapter-header">
        <h3 class="chapter-title">${escapeHtml(ch.title)}</h3>
        <span class="chapter-author">作者：${escapeHtml(ch.author)}</span>
        ${ch.authorNote ? `<p class="chapter-note">${escapeHtml(ch.authorNote)}</p>` : ''}
      </div>
      ${renderEpisodes(ch.episodes)}
    </div>
  `).join('');

  return `
    <section class="section" id="chapters">
      <div class="section-header">
        <div class="section-tag">ARCHIVE</div>
        <h2 class="section-title">完整档案记录</h2>
      </div>
      ${content}
    </section>
  `;
}

function renderExtras(extras) {
  if (!extras || extras.length === 0) return '';

  const cards = extras.map((e) => `
    <div class="extra-card">
      <div class="extra-title">${escapeHtml(e.title)}</div>
      <div class="extra-content">${escapeHtml(e.content)}</div>
    </div>
  `).join('');

  return `
    <section class="section" id="extras">
      <div class="section-header">
        <div class="section-tag">EXTRA</div>
        <h2 class="section-title">番外篇</h2>
      </div>
      <div class="extras-list">${cards}</div>
    </section>
  `;
}

function renderPage(data, posts) {
  const { meta, stats, highlights, chapters, extras } = data;

  app.innerHTML = [
    renderHero(meta),
    renderStats(stats),
    renderHighlights(highlights),
    renderPosts(posts),
    renderChapters(chapters),
    renderExtras(extras),
  ].join('');

  document.getElementById('footer-quote').textContent = data.footer?.quote || '';
  document.getElementById('footer-note').textContent = data.footer?.note || '';
  footer.hidden = false;
  document.title = `${meta.title} · ${meta.subtitle}`;
}

async function fetchJson(url) {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`加载失败: ${res.status}`);
  return res.json();
}

async function loadContent(isInitial = false) {
  try {
    const [data, remotePosts] = await Promise.all([
      fetchJson(DATA_URL),
      fetchJson(POSTS_URL).catch(() => []),
    ]);

    const localPosts = typeof Publish !== 'undefined' ? Publish.getLocalPosts() : [];
    const posts = mergePosts(remotePosts, localPosts);
    const hash = hashContent(data, posts);

    if (hash !== lastHash) {
      const isUpdate = !isInitial && lastHash !== '';
      lastHash = hash;
      contentData = data;
      postsData = posts;

      if (isInitial) {
        loading.style.display = 'none';
        if (typeof Publish !== 'undefined') Publish.init(data.meta);
        renderPage(data, posts);
      } else {
        app.classList.add('flash-update');
        renderPage(data, posts);
        setTimeout(() => app.classList.remove('flash-update'), 600);
      }

      updateStatus.textContent = `已同步 · ${formatDate(data.meta.lastUpdated)}`;
    } else {
      updateStatus.textContent = `实时同步中 · ${formatDate(data.meta.lastUpdated)}`;
    }
  } catch (err) {
    console.error(err);
    if (isInitial) {
      loading.innerHTML = '<p style="color:var(--red)">加载失败，请确认已启动本地服务器</p>';
    }
    updateStatus.textContent = '同步失败';
  }
}

const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
});

window.addEventListener('posts-updated', () => loadContent(false));

loadContent(true);
setInterval(() => loadContent(false), POLL_INTERVAL);