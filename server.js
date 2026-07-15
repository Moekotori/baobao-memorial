const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3000;
const ROOT = __dirname;
const POSTS_FILE = path.join(ROOT, 'data', 'posts.json');
const ADMIN_PIN = process.env.ADMIN_PIN || '8888';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

function readPosts() {
  try {
    return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writePosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), 'utf-8');
}

function gitPush(message) {
  execSync('git add data/posts.json', { cwd: ROOT, stdio: 'pipe' });
  execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: ROOT, stdio: 'pipe' });
  execSync('git push', { cwd: ROOT, stdio: 'pipe' });
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

  const newPost = {
    id: `post-${Date.now()}`,
    title: post.title.trim(),
    content: post.content.trim(),
    author: (post.author || '匿名').trim(),
    time: (post.time || new Date().toLocaleDateString('zh-CN')).trim(),
    severity: post.severity === 'critical' ? 'critical' : 'normal',
    createdAt: new Date().toISOString(),
  };

  const posts = readPosts();
  posts.unshift(newPost);
  writePosts(posts);

  let pushed = false;
  try {
    gitPush(`发布: ${newPost.title}`);
    pushed = true;
  } catch {
    pushed = false;
  }

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

  const urlPath = req.url.split('?')[0];
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
  console.log('  发布 API 已启用，右下角按钮可直接投稿\n');
});