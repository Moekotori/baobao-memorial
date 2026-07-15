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
    const expected = String(this.meta?.adminPin || '8888');
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
          ? '已保存本地文件，请 git push 同步到线上'
          : '发布成功！全站 3 秒内自动更新';
        okEl.hidden = false;
        this.showToast('发布成功');
        window.dispatchEvent(new CustomEvent('posts-updated'));
        document.getElementById('panel-form').reset();
        setTimeout(() => this.closeModal(), 1500);
        return;
      }

      throw new Error(data.error || `发布失败 (${res.status})`);
    } catch (err) {
      if (err.name === 'TypeError' || err.message?.includes('fetch')) {
        await this.localFallback(post, pin, okEl);
        document.getElementById('panel-form').reset();
        setTimeout(() => this.closeModal(), 2000);
      } else {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    } finally {
      btn.disabled = false;
      spinner.hidden = true;
    }
  },

  async localFallback(post, pin, okEl) {
    if (pin !== String(this.meta?.adminPin || '8888')) throw new Error('管理密码错误');

    const createdAt = new Date().toISOString();
    const filename = `${Date.now()}-post.md`;
    const md = [
      '---',
      `title: "${post.title.replace(/"/g, '\\"')}"`,
      `author: ${post.author}`,
      `time: "${post.time}"`,
      `severity: ${post.severity}`,
      `createdAt: ${createdAt}`,
      '---',
      '',
      post.content,
    ].join('\n');

    const localPost = {
      ...post,
      id: filename.replace('.md', ''),
      createdAt,
      filename,
      html: typeof marked !== 'undefined' ? marked.parse(post.content) : post.content,
    };

    this.saveLocalPost(localPost);
    this.downloadFile(md, filename);
    this.downloadManifestHint();

    okEl.textContent = 'API 不可用，已下载 .md 文件，放入 posts/ 并更新 manifest.json';
    okEl.hidden = false;
    this.showToast('已下载 Markdown 文件', 'warn');
    window.dispatchEvent(new CustomEvent('posts-updated'));
  },

  downloadFile(content, name) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  downloadManifestHint() {
    /* user manually adds filename to manifest */
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