const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createPost, touchContentTimestamp } = require('./lib/publish-core');

const PORT = 3000;
const ROOT = __dirname;
const ADMIN_PIN = process.env.ADMIN_PIN || 'liangxianyu';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function gitPush(message) {
  execSync('git add posts/ content/index.md images/', { cwd: ROOT, stdio: 'pipe' });
  try {
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: ROOT, stdio: 'pipe' });
    execSync('git push', { cwd: ROOT, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function handlePublish(body, res) {
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '无效请求' }));
    return;
  }

  if (data.pin !== ADMIN_PIN) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '管理密码错误' }));
    return;
  }

  const { post } = data;
  if (!post?.title || !post?.content) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '标题和内容不能为空' }));
    return;
  }

  const newPost = createPost({
    title: post.title.trim(),
    content: post.content.trim(),
    author: (post.author || '匿名').trim(),
    time: (post.time || new Date().toLocaleDateString('zh-CN')).trim(),
    severity: post.severity === 'critical' ? 'critical' : 'normal',
  });

  touchContentTimestamp();
  const pushed = gitPush(`发布: ${newPost.title}`);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, post: newPost, pushed }));
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/publish') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => handlePublish(body, res));
    return;
  }

  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  光荣事迹纪念馆 → http://localhost:${PORT}`);
  console.log('  编辑 content/index.md 实时更新 · 右下角按钮发布投稿\n');
});