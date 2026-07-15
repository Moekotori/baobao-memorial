const STORAGE = {
  pinOk: 'baobao_pin_ok',
  pinValue: 'baobao_pin_value',
  localPosts: 'baobao_local_posts',
};

const API_URL = '/api/publish';

const Publish = {
  meta: null,

  init(meta) {
    this.meta = meta;
    this.bindEvents();
  },

  bindEvents() {
    document.getElementById('fab-publish').addEventListener('click', () => this.openModal());
    document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') this.closeModal();
    });
    document.getElementById('pin-submit').addEventListener('click', () => this.verifyPin());
    document.getElementById('pin-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.verifyPin();
    });
    document.getElementById('form-cancel').addEventListener('click', () => this.closeModal());
    document.getElementById('panel-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitPost();
    });
  },

  openModal() {
    document.getElementById('modal-overlay').hidden = false;
    document.body.style.overflow = 'hidden';
    this.hideAllPanels();

    if (sessionStorage.getItem(STORAGE.pinOk) === '1') {
      this.showForm();
    } else {
      document.getElementById('panel-pin').hidden = false;
      document.getElementById('pin-input').focus();
    }
  },

  closeModal() {
    document.getElementById('modal-overlay').hidden = true;
    document.body.style.overflow = '';
    this.clearFormMessages();
  },

  hideAllPanels() {
    ['panel-pin', 'panel-form'].forEach((id) => {
      document.getElementById(id).hidden = true;
    });
  },

  verifyPin() {
    const input = document.getElementById('pin-input').value.trim();
    const expected = this.meta?.adminPin || '8888';
    const err = document.getElementById('pin-error');

    if (input !== expected) {
      err.textContent = '密码错误';
      err.hidden = false;
      return;
    }

    sessionStorage.setItem(STORAGE.pinOk, '1');
    sessionStorage.setItem(STORAGE.pinValue, input);
    err.hidden = true;
    this.showForm();
  },

  showForm() {
    this.hideAllPanels();
    document.getElementById('panel-form').hidden = false;
    document.getElementById('post-title').focus();
  },

  clearFormMessages() {
    document.getElementById('form-error').hidden = true;
    document.getElementById('form-success').hidden = true;
  },

  showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast toast-${type}`;
    toast.hidden = false;
    setTimeout(() => { toast.hidden = true; }, 4000);
  },

  getPin() {
    return sessionStorage.getItem(STORAGE.pinValue)
      || document.getElementById('pin-input')?.value.trim()
      || '';
  },

  async fetchRemotePosts() {
    const res = await fetch(`data/posts.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  },

  async submitPost() {
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const author = document.getElementById('post-author').value.trim() || '匿名';
    const time = document.getElementById('post-time').value.trim() || new Date().toLocaleDateString('zh-CN');
    const severity = document.querySelector('input[name="severity"]:checked')?.value || 'normal';
    const pin = this.getPin();

    if (!title || !content) return;

    const post = { title, content, author, time, severity };

    const btn = document.getElementById('form-submit');
    const spinner = document.getElementById('submit-spinner');
    const errEl = document.getElementById('form-error');
    const okEl = document.getElementById('form-success');

    btn.disabled = true;
    spinner.hidden = false;
    errEl.hidden = true;
    okEl.hidden = true;

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, post }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        okEl.textContent = data.pushed === false
          ? '已保存！请运行 npm run deploy 推送到线上'
          : '发布成功！全站将在几秒内更新';
        okEl.hidden = false;
        this.showToast(data.pushed === false ? '已本地保存' : '发布成功');
      } else if (res.status === 404 || res.status === 0) {
        await this.fallbackPublish(post, pin, okEl);
      } else {
        throw new Error(data.error || '发布失败');
      }

      document.getElementById('panel-form').reset();
      window.dispatchEvent(new CustomEvent('posts-updated'));
      setTimeout(() => this.closeModal(), 1800);
    } catch (err) {
      if (err.message?.includes('fetch') || err.name === 'TypeError') {
        try {
          await this.fallbackPublish(post, pin, document.getElementById('form-success'));
          document.getElementById('panel-form').reset();
          window.dispatchEvent(new CustomEvent('posts-updated'));
          setTimeout(() => this.closeModal(), 1800);
        } catch (e) {
          errEl.textContent = e.message || '发布失败';
          errEl.hidden = false;
        }
      } else {
        errEl.textContent = err.message || '发布失败，请重试';
        errEl.hidden = false;
      }
    } finally {
      btn.disabled = false;
      spinner.hidden = true;
    }
  },

  async fallbackPublish(post, pin, okEl) {
    if (pin !== (this.meta?.adminPin || '8888')) {
      throw new Error('管理密码错误');
    }

    const newPost = {
      ...post,
      id: `post-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    const remote = await this.fetchRemotePosts();
    const merged = [newPost, ...remote.filter((p) => p.id !== newPost.id)];

    this.saveLocalPost(newPost);
    this.downloadPosts(merged);

    okEl.textContent = '已生成 posts.json 并下载，放入 data/ 后运行 npm run deploy';
    okEl.hidden = false;
    this.showToast('文件已下载，请 deploy 上线', 'warn');
  },

  downloadPosts(posts) {
    const blob = new Blob([JSON.stringify(posts, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'posts.json';
    a.click();
    URL.revokeObjectURL(a.href);
  },

  saveLocalPost(post) {
    const local = JSON.parse(localStorage.getItem(STORAGE.localPosts) || '[]');
    local.unshift(post);
    localStorage.setItem(STORAGE.localPosts, JSON.stringify(local));
  },

  getLocalPosts() {
    return JSON.parse(localStorage.getItem(STORAGE.localPosts) || '[]');
  },
};