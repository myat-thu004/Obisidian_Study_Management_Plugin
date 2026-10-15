const { Plugin, ItemView, PluginSettingTab, Setting, Notice, normalizePath } = require('obsidian');
const VIEW = 'life-study-dashboard';
const DEF = { root: 'Life & Study', lengths: [25, 45, 50] };
const p2 = n => String(n).padStart(2, '0');
const dmy = d => `${p2(d.getDate())}-${p2(d.getMonth() + 1)}-${d.getFullYear()}`;
const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const parseDmy = s => { const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; };
const hm = n => `${Math.floor(n / 60)}h ${n % 60}m`;
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${p2(Math.floor(s / 60))}:${p2(s % 60)}`; };
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const monday = d => { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

module.exports = class LifeStudy extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEF, await this.loadData());
    this.t = { tag: '', len: this.settings.lengths[0], running: false, active: false, acc: 0, since: 0, start: null };
    this.registerView(VIEW, leaf => new Dash(leaf, this));
    this.addRibbonIcon('layout-dashboard', 'Open Life & Study dashboard', () => this.open());
    this.addCommand({ id: 'open', name: 'Open dashboard', callback: () => this.open() });
    this.addCommand({ id: 'setup', name: 'Create Life & Study folder with examples', callback: () => this.setup(true) });
    this.app.workspace.onLayoutReady(async () => { if (!this.app.vault.getAbstractFileByPath(normalizePath(this.settings.root))) await this.setup(true); await this.migrate(); });
    this.addSettingTab(new Tab(this.app, this));
    let to;
    const refresh = () => { clearTimeout(to); to = setTimeout(() => this.views().forEach(v => v.render()), 300); };
    ['create', 'delete', 'modify', 'rename'].forEach(e => this.registerEvent(this.app.vault.on(e, refresh)));
    this.registerEvent(this.app.metadataCache.on('changed', refresh));
    this.registerInterval(window.setInterval(() => {
      if (this.t.running && this.remaining() <= 0) this.end(true);
      this.views().forEach(v => v.tick());
    }, 1000));
  }
  views() { return this.app.workspace.getLeavesOfType(VIEW).map(l => l.view); }
  async open() {
    let l = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!l) { l = this.app.workspace.getLeaf('tab'); await l.setViewState({ type: VIEW, active: true }); }
    this.app.workspace.revealLeaf(l);
  }
  save() { return this.saveData(this.settings); }

  // ---------- Folder structure & markdown helpers ----------
  path(sub) { return normalizePath(this.settings.root + '/' + sub); }
  async mk(path) {
    let cur = '';
    for (const seg of normalizePath(path).split('/')) {
      cur = cur ? cur + '/' + seg : seg;
      if (!this.app.vault.getAbstractFileByPath(cur)) await this.app.vault.createFolder(cur);
    }
  }
  async put(path, text) {
    path = normalizePath(path);
    if (this.app.vault.getAbstractFileByPath(path)) return;
    await this.mk(path.split('/').slice(0, -1).join('/'));
    await this.app.vault.create(path, text);
  }
  subjects() {
    const d = this.app.vault.getAbstractFileByPath(this.path('Subjects'));
    return (d && d.children ? d.children.filter(c => c.children).map(c => c.name) : []).sort((a, b) => a.localeCompare(b));
  }
  weekParts(d) {
    const m = monday(d), th = new Date(m.getFullYear(), m.getMonth(), m.getDate() + 3);
    return { m, th, week: p2(Math.ceil(th.getDate() / 7)), name: `${th.getFullYear()}-${p2(th.getMonth() + 1)} Week ${p2(Math.ceil(th.getDate() / 7))}` };
  }
  weekFile(d) { return this.path(`Weekly Plans/${this.weekParts(d).name}.md`); }
  async weekPlan(d, example) {
    const path = this.weekFile(d), have = this.app.vault.getAbstractFileByPath(path);
    if (have) return have;
    const { m, th, week } = this.weekParts(d);
    const ex = [['Refresh Python basics', 'Solve two SQL problems'], ['Practice Python conditions', 'Review SQL aggregation'], ['Practice Python loops'], ['Combine loops and conditions'], ['Practice SQL joins'], ['Work on a portfolio project'], ['Review progress and plan next week']];
    let out = `# ${th.toLocaleString('en', { month: 'long' })}\n\n## Week ${week}\n`;
    for (let i = 0; i < 7; i++) out += `\n### ${dmy(new Date(m.getFullYear(), m.getMonth(), m.getDate() + i))}\n` + (example ? ex[i] : ['']).map(t => `- [ ] ${t}`).join('\n') + '\n';
    out += '\n## Weekly goals\n- \n\n## Notes\n';
    await this.put(path, out);
    return this.app.vault.getAbstractFileByPath(normalizePath(path));
  }
  async setup(notify) {
    const now = new Date(), t0 = iso(now), r = (p, x) => this.put(this.path(p), x);
    for (const n of ['Chinese', 'Python', 'SQL', 'Reading', 'Writing'])
      await r(`Subjects/${n}/Overview.md`, `# ${n}\n\nEvery folder in Subjects is a Pomodoro subject. Add as many notes as you like to this folder.\n`);
    await this.weekPlan(now, true);
    const g = {};
    [[1, 'Submit health informatics assignment'], [3, 'Finish Python fundamentals review'], [10, 'Complete weekly reflection']].forEach(([n, x]) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + n), h = '## ' + d.toLocaleString('en', { month: 'long' }) + ' ' + d.getFullYear();
      (g[h] = g[h] || []).push(`- [ ] ${dmy(d)} — ${x}`);
    });
    await r('Deadlines.md', '# Deadlines\n\n' + Object.entries(g).map(([h, l]) => h + '\n\n' + l.join('\n')).join('\n\n') + '\n');
    await r('Sessions.md', `# Sessions\n\n### ${dmy(now)}\n- Chinese | 25 mins | 09:00–09:25\n`);
    await r('Books/Atomic Habits.md', `---\ntitle: Atomic Habits\nauthor: James Clear\nisbn: "9780735211292"\nstatus: reading\ntotal_pages: 320\ncurrent_page: 40\n---\n# Atomic Habits\n\nExample book record. Reading notes go here.\n`);
    await r('Resources.md', '# Resources\n\n### Python Official Tutorial\nhttps://docs.python.org/3/tutorial/\n');
    await r(`Daily/${t0}.md`, `# ${dmy(now)}\n\n## Plan\n- \n\n## Reflection\n`);
    await r('Home.md', `# Life & Study\n\nOpen the dashboard from the ribbon icon, or run "Open dashboard" from the command palette.\n\n- Weekly Plans/ — one note per week, tasks under ### dd-mm-yyyy headings\n- [[Deadlines]] — one line per deadline\n- [[Sessions]] — completed Pomodoros, grouped by date\n- Subjects/ — one folder per subject, with as many notes as you like\n- [[Resources]] — links, one ### heading each\n- Books/, Daily/ — example records\n`);
    if (notify) new Notice(`Life & Study folder is ready: ${this.settings.root}/`);
    this.views().forEach(v => v.render());
  }

  async logSession(day, line) {
    const path = this.path('Sessions.md'), head = `### ${dmy(day)}`;
    await this.put(path, '# Sessions\n');
    await this.app.vault.process(this.app.vault.getAbstractFileByPath(path), c => {
      const L = c.split('\n'), h = L.findIndex(x => x.trim() === head);
      if (h < 0) return c.replace(/\n*$/, '\n\n') + head + '\n' + line + '\n';
      let e = h + 1;
      while (e < L.length && !/^#/.test(L[e])) e++;
      while (e > h + 1 && !L[e - 1].trim()) e--;
      L.splice(e, 0, line);
      return L.join('\n');
    });
  }
  async migrate() {
    const dir = this.app.vault.getAbstractFileByPath(this.path('Subjects'));
    if (!dir || !dir.children) return;
    for (const f of dir.children.filter(c => c.extension === 'md')) {
      await this.mk(`${dir.path}/${f.basename}`);
      await this.app.fileManager.renameFile(f, `${dir.path}/${f.basename}/Overview.md`);
    }
    this.views().forEach(v => v.render());
  }

  // ---------- Markdown parsing ----------
  async tasks() {
    const out = [];
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!f.path.startsWith(this.path('Weekly Plans') + '/')) continue;
      let date = null;
      (await this.app.vault.cachedRead(f)).split('\n').forEach((l, i) => {
        const h = /^###\s+(\d{2}-\d{2}-\d{4})/.exec(l);
        if (h) date = h[1]; else if (/^#{1,3}\s/.test(l)) date = null;
        const t = /^\s*- \[( |x)\]\s+(.*)/i.exec(l);
        if (t && date && t[2].trim()) out.push({ f, i, date, done: t[1] !== ' ', text: t[2] });
      });
    }
    return out;
  }
  async deadlines() {
    const f = this.app.vault.getAbstractFileByPath(this.path('Deadlines.md'));
    const out = [];
    if (!f) return out;
    (await this.app.vault.cachedRead(f)).split('\n').forEach((l, i) => {
      const m = /^\s*- \[( |x)\]\s+(\d{2}-\d{2}-\d{4})\s*[—–-]\s*(.*)/i.exec(l);
      if (m) out.push({ f, i, done: m[1] !== ' ', date: parseDmy(m[2]), text: m[3] });
    });
    return out;
  }
  toggle(f, i, done) {
    return this.app.vault.process(f, c => {
      const L = c.split('\n');
      L[i] = L[i].replace(/\[( |x)\]/i, done ? '[x]' : '[ ]');
      return L.join('\n');
    });
  }
  async addDeadline(d, text) {
    const path = this.path('Deadlines.md');
    let f = this.app.vault.getAbstractFileByPath(path);
    if (!f) { await this.put(path, '# Deadlines\n'); f = this.app.vault.getAbstractFileByPath(path); }
    const head = '## ' + d.toLocaleString('en', { month: 'long' }) + ' ' + d.getFullYear();
    const line = `- [ ] ${dmy(d)} — ${text}`;
    await this.app.vault.process(f, c => {
      const L = c.split('\n'), h = L.findIndex(x => x.trim() === head);
      if (h < 0) return c.replace(/\n*$/, '\n\n') + head + '\n\n' + line + '\n';
      let e = h + 1;
      while (e < L.length && !/^#/.test(L[e])) e++;
      while (e > h + 1 && !L[e - 1].trim()) e--;
      L.splice(e, 0, line);
      return L.join('\n');
    });
  }
  async sessions() {
    const f = this.app.vault.getAbstractFileByPath(this.path('Sessions.md')), out = [];
    if (!f) return out;
    let day = null;
    (await this.app.vault.cachedRead(f)).split('\n').forEach(l => {
      const h = /^###\s+(\d{2}-\d{2}-\d{4})/.exec(l);
      if (h) { const d = parseDmy(h[1]); day = d && iso(d); return; }
      const m = /^\s*-\s+(.+?)\s*\|\s*(\d+)\s*mins?\s*(?:\|\s*(.*))?$/i.exec(l);
      if (m && day) out.push({ date: day, tag: m[1], minutes: +m[2], note: m[3] || '' });
    });
    return out;
  }

  // ---------- Timer ----------
  focused() { return this.t.acc + (this.t.running ? Date.now() - this.t.since : 0); }
  remaining() { return this.t.len * 60000 - this.focused(); }
  begin() { if (!this.t.tag) return new Notice('Add a subject first.'); Object.assign(this.t, { active: true, running: true, acc: 0, since: Date.now(), start: new Date() }); }
  pause() { this.t.acc += Date.now() - this.t.since; this.t.running = false; }
  resume() { this.t.since = Date.now(); this.t.running = true; }
  async end(finished) {
    const t = this.t;
    if (t.running) this.pause();
    const min = finished ? t.len : Math.round(t.acc / 60000), start = t.start, tag = t.tag;
    Object.assign(t, { active: false, running: false, acc: 0 });
    this.views().forEach(v => v.render());
    if (min < 1) return new Notice('Session under 1 minute was not saved.');
    const end = new Date(), tm = d => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
    await this.logSession(start, `- ${tag} | ${min} mins | ${tm(start)}–${tm(end)}`);
    new Notice(`Saved ${tag} | ${min} mins`);
  }
};

class Dash extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.p = plugin; this.month = startOfDay(new Date()); this.month.setDate(1); this.pick = ''; }
  getViewType() { return VIEW; }
  getDisplayText() { return 'Life & Study'; }
  getIcon() { return 'layout-dashboard'; }
  async onOpen() { await this.render(); }
  tick() { if (this.clock) { this.clock.setText(mmss(this.p.remaining())); } }

  async render() {
    const p = this.p, root = this.contentEl;
    root.empty(); root.addClass('lsd');
    const now = new Date(), todayStr = dmy(now);
    const [tasks, dls] = [await p.tasks(), await p.deadlines()], ses = await p.sessions();
    root.createEl('h1', { text: now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) });
    const cols = root.createDiv('lsd-cols');

    // Column 1: today's tasks
    const c1 = cols.createDiv('lsd-col'); c1.createEl('h2', { text: 'Today' });
    const mine = tasks.filter(t => t.date === todayStr);
    if (!mine.length) c1.createEl('p', { cls: 'lsd-empty', text: `No tasks for today. Add them under ### ${todayStr} in this week's plan.` });
    mine.forEach(t => this.check(c1, t, () => p.toggle(t.f, t.i, !t.done)));
    const wf = p.app.vault.getAbstractFileByPath(p.weekFile(now));
    c1.createEl('button', { cls: 'lsd-wide', text: wf ? "Open this week's plan" : "Create this week's plan" }).onclick = async () => {
      const f = wf || await p.weekPlan(now);
      this.app.workspace.getLeaf('tab').openFile(f);
    };

    // Column 2: calendar
    const c2 = cols.createDiv('lsd-col'); c2.createEl('h2', { text: 'Calendar' });
    this.calendar(c2, dls, startOfDay(now));
    this.deadlineList(c2, dls, startOfDay(now));

    // Column 3: timer + today's sessions
    const c3 = cols.createDiv('lsd-col'); c3.createEl('h2', { text: 'Pomodoro' });
    this.timer(c3);
    c3.createEl('h3', { text: 'Completed today' });
    const td = ses.filter(s => s.date === iso(now));
    if (!td.length) c3.createEl('p', { cls: 'lsd-empty', text: 'No sessions yet.' });
    td.forEach(s => c3.createDiv({ cls: 'lsd-sess', text: `${s.tag} | ${s.minutes} mins` + (s.note ? ` | ${s.note}` : '') }));

    this.stats(root, ses, now);
    root.createDiv('lsd-hr');
    this.books(root);
    root.createDiv('lsd-hr');
    await this.resources(root);
  }

  books(root) {
    const p = this.p, dir = p.path('Books') + '/';
    root.createEl('h2', { text: 'Books' });
    const grid = root.createDiv('lsd-books');
    const files = p.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(dir));
    if (!files.length) grid.createEl('p', { cls: 'lsd-empty', text: 'No books yet. Add one below.' });
    files.forEach(f => {
      const fm = p.app.metadataCache.getFileCache(f)?.frontmatter || {}, card = grid.createDiv('lsd-book');
      card.createDiv({ cls: 'ttl', text: fm.title || f.basename });
      if (fm.author) card.createDiv({ cls: 'lbl', text: String(fm.author) });
      if (fm.status) card.createDiv({ cls: 'lbl', text: String(fm.status) });
      const tot = +fm.total_pages, cur = +fm.current_page || 0;
      if (tot > 0) {
        card.createDiv('bar').createDiv().style.width = Math.min(100, Math.round(cur / tot * 100)) + '%';
        card.createDiv({ cls: 'lbl', text: `${cur} / ${tot} pages` });
      }
      card.onclick = () => this.app.workspace.getLeaf('tab').openFile(f);
    });
    const form = root.createDiv('lsd-form');
    const ti = form.createEl('input', { type: 'text', placeholder: 'Book title' }), au = form.createEl('input', { type: 'text', placeholder: 'Author' });
    form.createEl('button', { text: 'Add book' }).onclick = async () => {
      const n = ti.value.replace(/[\\\/:*?"<>|#^\[\]]/g, '').trim();
      if (!n) return new Notice('Enter a book title.');
      await p.put(p.path(`Books/${n}.md`), `---\ntitle: ${JSON.stringify(n)}\nauthor: ${JSON.stringify(au.value.trim())}\nstatus: to-read\ntotal_pages: 0\ncurrent_page: 0\n---\n# ${n}\n`);
    };
  }

  async resources(root) {
    const p = this.p, path = p.path('Resources.md'), f = p.app.vault.getAbstractFileByPath(path), items = [];
    if (f) {
      let cur = null;
      (await p.app.vault.cachedRead(f)).split('\n').forEach(l => {
        const h = /^###\s+(.+)/.exec(l);
        if (h) { cur = { name: h[1].trim(), url: '' }; items.push(cur); } else if (cur && !cur.url && l.trim()) cur.url = l.trim();
      });
    }
    root.createEl('h2', { text: 'Resources' });
    const list = root.createDiv('lsd-res');
    if (!items.length) list.createEl('p', { cls: 'lsd-empty', text: 'No resources yet. Add a name and link below.' });
    items.forEach(r => {
      const row = list.createDiv('lsd-resrow');
      if (/^https?:\/\//i.test(r.url)) row.createEl('a', { text: r.name, href: r.url, attr: { target: '_blank', rel: 'noopener' } });
      else row.createSpan({ text: r.name });
      row.createSpan({ cls: 'lbl', text: r.url.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 60) });
    });
    const form = root.createDiv('lsd-form');
    const nm = form.createEl('input', { type: 'text', placeholder: 'Name' }), ln = form.createEl('input', { type: 'text', placeholder: 'Link' });
    form.createEl('button', { text: 'Add resource' }).onclick = async () => {
      const n = nm.value.replace(/\s+/g, ' ').trim(), u = ln.value.trim();
      if (!n || !u) return new Notice('Enter a name and a link.');
      await p.put(path, '# Resources\n');
      await p.app.vault.process(p.app.vault.getAbstractFileByPath(path), c => c.replace(/\n*$/, '\n\n') + `### ${n}\n${u}\n`);
    };
  }

  deadlineList(el, dls, today) {
    const m = this.month;
    el.createEl('h3', { text: 'Deadlines · ' + m.toLocaleString('en', { month: 'long' }) });
    const list = el.createDiv('lsd-dl'), mine = dls.filter(x => x.date.getMonth() === m.getMonth() && x.date.getFullYear() === m.getFullYear()).sort((a, b) => a.date - b.date);
    if (!mine.length) list.createEl('p', { cls: 'lsd-empty', text: 'No deadlines this month.' });
    mine.forEach(x => {
      const r = this.check(list, { ...x, text: `${dmy(x.date)} — ${x.text}` }, () => this.p.toggle(x.f, x.i, !x.done));
      if (!x.done && x.date < today) r.addClass('overdue');
    });
  }

  check(parent, t, onToggle) {
    const row = parent.createEl('label', { cls: 'lsd-task' });
    const cb = row.createEl('input', { type: 'checkbox' }); cb.checked = t.done;
    cb.onchange = onToggle;
    row.createSpan({ text: t.text, cls: t.done ? 'done' : '' });
    return row;
  }

  calendar(el, dls, today) {
    const m = this.month, nav = el.createDiv('lsd-nav');
    const step = n => { this.month = new Date(m.getFullYear(), m.getMonth() + n, 1); this.render(); };
    nav.createEl('button', { text: '‹' }).onclick = () => step(-1);
    nav.createSpan({ text: m.toLocaleString('en', { month: 'long', year: 'numeric' }) });
    nav.createEl('button', { text: '›' }).onclick = () => step(1);
    const grid = el.createDiv('lsd-cal');
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(d => grid.createDiv({ cls: 'lsd-dow', text: d }));
    const lead = (m.getDay() + 6) % 7, days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    for (let i = 0; i < lead; i++) grid.createDiv();
    for (let d = 1; d <= days; d++) {
      const dt = new Date(m.getFullYear(), m.getMonth(), d), due = dls.filter(x => +x.date === +dt);
      const cell = grid.createDiv({ cls: 'lsd-day', text: String(d) });
      if (+dt === +today) cell.addClass('today');
      if (due.length) cell.addClass(due.every(x => x.done) ? 'has-done' : dt < today ? 'overdue' : (dt - today) / 864e5 <= 3 ? 'soon' : 'has');
      cell.onclick = () => { this.pick = iso(dt); this.dateInput && (this.dateInput.value = this.pick); };
    }
    const form = el.createDiv('lsd-form');
    this.dateInput = form.createEl('input', { type: 'date', value: this.pick || iso(today) });
    const txt = form.createEl('input', { type: 'text', placeholder: 'New deadline' });
    form.createEl('button', { text: 'Add deadline' }).onclick = async () => {
      const [y, mo, d] = this.dateInput.value.split('-').map(Number);
      if (!y || !txt.value.trim()) return new Notice('Pick a date and enter a title.');
      await this.p.addDeadline(new Date(y, mo - 1, d), txt.value.trim());
    };
  }

  timer(el) {
    const t = this.p.t, s = this.p.settings, subs = this.p.subjects(); if (!subs.includes(t.tag)) t.tag = subs[0] || '';
    this.clock = el.createDiv({ cls: 'lsd-clock', text: mmss(t.active ? this.p.remaining() : t.len * 60000) });
    const sel = el.createDiv('lsd-form');
    const tag = sel.createEl('select'); subs.forEach(x => tag.createEl('option', { text: x, value: x })); tag.value = t.tag; tag.disabled = t.active;
    tag.onchange = () => t.tag = tag.value;
    const len = sel.createEl('select'); s.lengths.forEach(x => len.createEl('option', { text: x + ' min', value: String(x) })); len.value = String(t.len); len.disabled = t.active;
    len.onchange = () => { t.len = +len.value; this.render(); };
    const bar = el.createDiv('lsd-form');
    if (!t.active) {
      const row = el.createDiv('lsd-form'), nm = row.createEl('input', { type: 'text', placeholder: 'New subject' });
      row.createEl('button', { text: 'Add subject' }).onclick = async () => {
        const n = nm.value.replace(/[\\\/:*?"<>|#^\[\]]/g, '').trim();
        if (!n) return;
        await this.p.put(this.p.path(`Subjects/${n}/Overview.md`), `# ${n}\n`);
        t.tag = n; this.render();
      };
    }
    const b = (txt, fn) => bar.createEl('button', { text: txt }).onclick = fn;
    if (!t.active) b('Start', () => { this.p.begin(); this.render(); });
    else {
      b(t.running ? 'Pause' : 'Resume', () => { t.running ? this.p.pause() : this.p.resume(); this.render(); });
      b('End', () => this.p.end(false));
    }
  }

  stats(root, ses, now) {
    const sum = pred => ses.filter(pred).reduce((a, s) => a + s.minutes, 0);
    const wk = monday(now), wkEnd = new Date(+wk + 7 * 864e5);
    const inD = s => { const [y, m, d] = s.date.split('-').map(Number); return new Date(y, m - 1, d); };
    root.createDiv('lsd-hr');
    const row = root.createDiv('lsd-stats');
    [['Today', sum(s => s.date === iso(now))], ['This week', sum(s => inD(s) >= wk && inD(s) < wkEnd)],
     ['This month', sum(s => s.date.slice(0, 7) === iso(now).slice(0, 7))], ['This year', sum(s => s.date.slice(0, 4) === String(now.getFullYear()))]]
      .forEach(([k, v]) => { const c = row.createDiv('lsd-stat'); c.createDiv({ text: hm(v), cls: 'big' }); c.createDiv({ text: k, cls: 'lbl' }); });

    root.createDiv('lsd-hr');
    const perf = root.createDiv('lsd-perf'), left = perf.createDiv(), side = perf.createDiv('lsd-side');
    left.createEl('h2', { text: `Study activity ${now.getFullYear()}` });
    const by = {}; ses.forEach(s => (by[s.date] = by[s.date] || []).push(s));
    const heat = left.createDiv('lsd-heat'), jan1 = new Date(now.getFullYear(), 0, 1);
    for (let i = 0; i < (jan1.getDay() + 6) % 7; i++) heat.createDiv();
    for (let d = new Date(jan1); d.getFullYear() === jan1.getFullYear(); d.setDate(d.getDate() + 1)) {
      const list = by[iso(d)] || [], m = list.reduce((a, s) => a + s.minutes, 0);
      const lvl = m === 0 ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4;
      const c = heat.createDiv({ cls: `lsd-cell l${lvl}`, attr: { title: `${dmy(d)} · ${hm(m)}` } });
      const label = `${dmy(d)} — ${hm(m)}` + (list.length ? '\n' + list.map(s => `${s.tag} ${s.minutes}m`).join(', ') : '');
      c.onclick = () => new Notice(label);
    }

    side.createEl('h2', { text: `Hours by subject ${now.getFullYear()}` });
    const tot = {};
    ses.filter(s => s.date.slice(0, 4) === String(now.getFullYear())).forEach(s => tot[s.tag] = (tot[s.tag] || 0) + s.minutes);
    const rows = Object.entries(tot).sort((a, b) => b[1] - a[1]), top = rows.length ? rows[0][1] : 1;
    if (!rows.length) side.createEl('p', { cls: 'lsd-empty', text: 'No sessions yet this year.' });
    rows.forEach(([k, v]) => {
      const r = side.createDiv('lsd-hbar');
      r.createSpan({ cls: 'k', text: k });
      r.createDiv('track').createDiv().style.width = Math.max(2, Math.round(v / top * 100)) + '%';
      r.createSpan({ cls: 'v', text: hm(v) });
    });
  }
}

class Tab extends PluginSettingTab {
  constructor(app, p) { super(app, p); this.p = p; }
  display() {
    const el = this.containerEl, s = this.p.settings; el.empty();
    new Setting(el).setName('Main folder').setDesc('Holds Weekly Plans, Deadlines.md, Sessions.md, Subjects, Books, Resources.md and Daily. If you rename it, move your existing files too.')
      .addText(t => t.setValue(s.root).onChange(async v => { s.root = v.trim() || DEF.root; await this.p.save(); }));
    new Setting(el).setName('Session lengths (minutes)').setDesc('Comma-separated, for example 25, 45, 50.')
      .addText(t => t.setValue(s.lengths.join(', ')).onChange(async v => { s.lengths = v.split(',').map(x => +x.trim()).filter(Boolean); await this.p.save(); }));
    new Setting(el).setName('Pomodoro subjects').setDesc('Each folder in Subjects is one subject. Add, rename or delete folders there, or use Add subject on the dashboard.');
    new Setting(el).setName('Create folder structure').setDesc('Creates any missing folders and example notes. Existing files are never overwritten.')
      .addButton(b => b.setButtonText('Create now').onClick(() => this.p.setup(true)));
  }
}
