const POLL_INTERVAL = 3000;
const CONTENT_URL = 'content/index.md';
const MANIFEST_URL = 'posts/manifest.json';

let lastHash = '';
let siteData = null;

const app = document.getElementById('app');
const loading = document.getElementById('loading');
const footer = document.getElementById('footer');
const updateStatus = document.getElementById('update-status');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function renderHero(meta) {
  return `
    <section class="hero" id="hero">
      <div class="hero-badge">📜 光荣事迹档案 · 永久陈列</div>
      <h1 class="hero-title">${escapeHtml(meta.title)}</h1>
      <p class="hero-subtitle">${escapeHtml(meta.subtitle)}</p>
      <div class="hero-subject">
        <div class="hero-subject-label">${escapeHtml(meta.subjectAlias || '瓜主')}</div>
        <div class="hero-subject-name">${escapeHtml(meta.subject)}</div>
      </div>
      <p class="hero-intro">${escapeHtml(meta.intro)}</p>
      <p class="hero-disclaimer">${escapeHtml(meta.disclaimer)}</p>
      <div class="hero-scroll">↓ 向下翻阅档案</div>
    </section>
  `;
}

function renderGallery(gallery = []) {
  if (!gallery?.length) return '';

  const items = gallery.map((img) => `
    <figure class="gallery-item">
      <div class="gallery-frame">
        <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt || img.caption || '')}" loading="lazy" />
      </div>
      ${img.caption ? `<figcaption class="gallery-caption">${escapeHtml(img.caption)}</figcaption>` : ''}
    </figure>
  `).join('');

  return `
    <section class="section gallery-section" id="gallery">
      <div class="section-header">
        <div class="section-tag">PHOTO</div>
        <h2 class="section-title">瓜主风采</h2>
      </div>
      <div class="image-gallery">${items}</div>
    </section>
  `;
}

function renderStats(stats = []) {
  if (!stats.length) return '';
  const cards = stats.map((s) => `
    <div class="stat-card">
      <div class="stat-value">${escapeHtml(String(s.value))}<span class="stat-unit">${escapeHtml(s.unit || '')}</span></div>
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

function renderHighlights(highlights = []) {
  if (!highlights.length) return '';
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
  if (!posts?.length) return '';

  const cards = posts.map((p) => {
    const critical = p.severity === 'critical';
    return `
      <article class="post-card${critical ? ' critical' : ''}">
        <div class="post-head">
          <h3 class="post-title">${escapeHtml(p.title)}</h3>
          <div class="post-meta">
            ${critical ? '<span class="episode-badge">⚠ 严重</span>' : ''}
            ${p.time ? `<span class="episode-time">${escapeHtml(p.time)}</span>` : ''}
          </div>
        </div>
        <div class="post-content markdown-body">${p.html}</div>
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

function renderArchive(bodyHtml) {
  return `
    <section class="section" id="chapters">
      <div class="section-header">
        <div class="section-tag">ARCHIVE</div>
        <h2 class="section-title">完整档案记录</h2>
      </div>
      ${Markdown.renderBody(bodyHtml)}
    </section>
  `;
}

function renderPage({ meta, bodyHtml, posts }) {
  app.innerHTML = [
    renderHero(meta),
    renderGallery(meta.gallery),
    renderStats(meta.stats),
    renderHighlights(meta.highlights),
    renderPosts(posts),
    renderArchive(bodyHtml),
  ].join('');

  document.getElementById('footer-quote').textContent = meta.footer?.quote || '';
  document.getElementById('footer-note').textContent = meta.footer?.note || '';
  footer.hidden = false;
  document.title = `${meta.title} · ${meta.subtitle}`;
}

async function fetchText(url) {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`加载失败: ${res.status} ${url}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`加载失败: ${res.status}`);
  return res.json();
}

async function loadPosts() {
  const manifest = await fetchJson(MANIFEST_URL).catch(() => []);
  const files = Array.isArray(manifest) ? manifest : [];

  const posts = await Promise.all(
    files.map(async (file) => {
      try {
        const text = await fetchText(`posts/${file}`);
        return Markdown.parsePostMarkdown(text, file);
      } catch {
        return null;
      }
    }),
  );

  const local = typeof Publish !== 'undefined' ? Publish.getLocalPosts() : [];
  const map = new Map();
  [...posts.filter(Boolean), ...local].forEach((p) => map.set(p.id, p));
  return [...map.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function loadContent(isInitial = false) {
  try {
    const [mdText, posts] = await Promise.all([
      fetchText(CONTENT_URL),
      loadPosts(),
    ]);

    const { meta, body } = Markdown.parseFrontmatter(mdText);
    const bodyHtml = Markdown.toHtml(body);
    const hash = JSON.stringify({ meta, body, posts });

    if (hash !== lastHash) {
      lastHash = hash;
      siteData = { meta, bodyHtml, posts };

      if (isInitial) {
        loading.style.display = 'none';
        if (typeof Publish !== 'undefined') Publish.init(meta);
        renderPage(siteData);
      } else {
        app.classList.add('flash-update');
        renderPage(siteData);
        setTimeout(() => app.classList.remove('flash-update'), 600);
      }

      updateStatus.textContent = `已同步 · ${formatDate(meta.lastUpdated)}`;
    } else {
      updateStatus.textContent = `实时同步中 · ${formatDate(meta.lastUpdated)}`;
    }
  } catch (err) {
    console.error(err);
    if (isInitial) {
      loading.innerHTML = '<p style="color:var(--red)">加载失败，请运行 npm start 启动服务</p>';
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