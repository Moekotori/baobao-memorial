const REPO = { owner: 'Moekotori', name: 'baobao-memorial' };
const ADMIN_PIN = process.env.ADMIN_PIN || 'liangxianyu';

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'post';
}

function buildPostMarkdown(post) {
  const createdAt = post.createdAt || new Date().toISOString();
  return [
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
  ].join('\n');
}

async function githubRequest(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `GitHub error ${res.status}`);
  return data;
}

async function getFile(path, token) {
  const url = `https://api.github.com/repos/${REPO.owner}/${REPO.name}/contents/${path}`;
  try {
    const file = await githubRequest(url, token);
    const content = Buffer.from(file.content, 'base64').toString('utf-8');
    return { content, sha: file.sha };
  } catch (e) {
    if (e.message?.includes('404')) return { content: null, sha: null };
    throw e;
  }
}

async function putFile(path, content, message, token, sha) {
  const url = `https://api.github.com/repos/${REPO.owner}/${REPO.name}/contents/${path}`;
  const body = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
  };
  if (sha) body.sha = sha;
  return githubRequest(url, token, { method: 'PUT', body: JSON.stringify(body) });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = process.env.GH_PUBLISH_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) return res.status(500).json({ error: '服务器未配置 GH_PUBLISH_TOKEN' });

    const { pin, post } = req.body || {};
    if (pin !== ADMIN_PIN) return res.status(403).json({ error: '管理密码错误' });
    if (!post?.title || !post?.content) return res.status(400).json({ error: '标题和内容不能为空' });

    const createdAt = new Date().toISOString();
    const filename = `${Date.now()}-${slugify(post.title)}.md`;
    const newPost = {
      id: `post-${Date.now()}`,
      title: post.title.trim(),
      content: post.content.trim(),
      author: (post.author || '匿名').trim(),
      time: (post.time || new Date().toLocaleDateString('zh-CN')).trim(),
      severity: post.severity === 'critical' ? 'critical' : 'normal',
      createdAt,
      filename,
    };

    const mdContent = buildPostMarkdown(newPost);

    const manifestFile = await getFile('posts/manifest.json', token);
    let manifest = [];
    if (manifestFile.content) {
      manifest = JSON.parse(manifestFile.content);
    }
    manifest.unshift(filename);

    await putFile(`posts/${filename}`, mdContent, `发布: ${newPost.title}`, token);
    await putFile('posts/manifest.json', JSON.stringify(manifest, null, 2), `更新 manifest: ${newPost.title}`, token, manifestFile.sha);

    const contentFile = await getFile('content/index.md', token);
    if (contentFile.content) {
      const updated = contentFile.content.replace(/lastUpdated:\s*.+/, `lastUpdated: ${createdAt}`);
      await putFile('content/index.md', updated, `更新 timestamp: ${newPost.title}`, token, contentFile.sha);
    }

    return res.status(200).json({ ok: true, post: newPost, pushed: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || '发布失败' });
  }
};