const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const MANIFEST = path.join(POSTS_DIR, 'manifest.json');
const CONTENT_MD = path.join(ROOT, 'content', 'index.md');

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'post';
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
  } catch {
    return [];
  }
}

function writeManifest(files) {
  fs.writeFileSync(MANIFEST, JSON.stringify(files, null, 2), 'utf-8');
}

function buildPostMarkdown(post) {
  const createdAt = post.createdAt || new Date().toISOString();
  const lines = [
    '---',
    `title: "${post.title.replace(/"/g, '\\"')}"`,
    `author: ${post.author || '匿名'}`,
    `time: "${post.time || ''}"`,
    `severity: ${post.severity === 'critical' ? 'critical' : 'normal'}`,
    `createdAt: ${createdAt}`,
    '---',
    '',
    post.content.trim(),
    '',
  ];
  return lines.join('\n');
}

function createPost(post) {
  const createdAt = post.createdAt || new Date().toISOString();
  const filename = `${Date.now()}-${slugify(post.title)}.md`;
  const filepath = path.join(POSTS_DIR, filename);

  const fullPost = {
    ...post,
    id: post.id || `post-${Date.now()}`,
    createdAt,
    filename,
  };

  fs.writeFileSync(filepath, buildPostMarkdown(fullPost), 'utf-8');

  const manifest = readManifest();
  if (!manifest.includes(filename)) {
    manifest.unshift(filename);
    writeManifest(manifest);
  }

  return { ...fullPost, filename };
}

function touchContentTimestamp() {
  try {
    let text = fs.readFileSync(CONTENT_MD, 'utf-8');
    const now = new Date().toISOString();
    if (text.startsWith('---')) {
      text = text.replace(/lastUpdated:\s*.+/, `lastUpdated: ${now}`);
    }
    fs.writeFileSync(CONTENT_MD, text, 'utf-8');
  } catch {
    /* ignore */
  }
}

module.exports = { createPost, touchContentTimestamp, buildPostMarkdown, slugify, MANIFEST, POSTS_DIR };