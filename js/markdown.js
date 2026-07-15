const Markdown = {
  parseFrontmatter(text) {
    if (!text.startsWith('---')) return { meta: {}, body: text };
    const end = text.indexOf('\n---', 3);
    if (end === -1) return { meta: {}, body: text };

    const yaml = text.slice(4, end).trim();
    const body = text.slice(end + 4).trim();
    const meta = typeof jsyaml !== 'undefined' ? (jsyaml.load(yaml) || {}) : {};
    return { meta, body };
  },

  toHtml(md) {
    if (typeof marked === 'undefined') return md;
    marked.setOptions({ breaks: true, gfm: true });
    return marked.parse(md);
  },

  parsePostMarkdown(text, filename) {
    const { meta, body } = this.parseFrontmatter(text);
    const html = this.toHtml(body);
    return {
      id: filename?.replace('.md', '') || meta.createdAt,
      title: meta.title || '无标题',
      author: meta.author || '匿名',
      time: meta.time || '',
      severity: meta.severity || 'normal',
      createdAt: meta.createdAt || new Date().toISOString(),
      content: body,
      html,
      filename,
    };
  },

  renderBody(html) {
    return `<div class="markdown-body">${html}</div>`;
  },
};