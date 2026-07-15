const REPO = { owner: 'Moekotori', name: 'baobao-memorial' };
const POSTS_PATH = 'data/posts.json';
const ADMIN_PIN = process.env.ADMIN_PIN || '8888';

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return res.status(500).json({ error: '服务器未配置 GITHUB_TOKEN' });

    const { pin, post } = req.body || {};
    if (pin !== ADMIN_PIN) return res.status(403).json({ error: '管理密码错误' });
    if (!post?.title || !post?.content) return res.status(400).json({ error: '标题和内容不能为空' });

    const apiBase = `https://api.github.com/repos/${REPO.owner}/${REPO.name}/contents/${POSTS_PATH}`;

    let posts = [];
    let sha = null;

    try {
      const file = await githubRequest(apiBase, token);
      sha = file.sha;
      posts = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
    } catch (e) {
      if (!e.message?.includes('404')) throw e;
    }

    const newPost = {
      id: post.id || `post-${Date.now()}`,
      title: post.title.trim(),
      content: post.content.trim(),
      author: (post.author || '匿名').trim(),
      time: (post.time || new Date().toLocaleDateString('zh-CN')).trim(),
      severity: post.severity === 'critical' ? 'critical' : 'normal',
      createdAt: new Date().toISOString(),
    };

    posts.unshift(newPost);

    const content = Buffer.from(JSON.stringify(posts, null, 2), 'utf-8').toString('base64');

    await githubRequest(apiBase, token, {
      method: 'PUT',
      body: JSON.stringify({
        message: `发布: ${newPost.title}`,
        content,
        sha,
      }),
    });

    return res.status(200).json({ ok: true, post: newPost });
  } catch (err) {
    return res.status(500).json({ error: err.message || '发布失败' });
  }
};