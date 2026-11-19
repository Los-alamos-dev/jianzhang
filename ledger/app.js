(() => {
  'use strict';

  const STORAGE_KEY = 'jianzhang.entries.v1';
  const MAX_AMOUNT = 9999999.99;
  const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  const CATEGORIES = {
    expense: [
      { name: '餐饮', icon: '🍜', color: '#d8794f', soft: '#f8e8dc' },
      { name: '交通', icon: '🚌', color: '#5b86a8', soft: '#e6eef5' },
      { name: '购物', icon: '🛍️', color: '#b56b8e', soft: '#f5e5ed' },
      { name: '居住', icon: '🏠', color: '#8a7a5c', soft: '#f0eadf' },
      { name: '娱乐', icon: '🎬', color: '#7b6bb0', soft: '#ebe7f7' },
      { name: '医疗', icon: '💊', color: '#c45f5f', soft: '#f8e5e5' },
      { name: '学习', icon: '📚', color: '#4f8a73', soft: '#e3f0ea' },
      { name: '其他', icon: '📦', color: '#8b8f87', soft: '#eeeee9' },
    ],
    income: [
      { name: '工资', icon: '💼', color: '#2f6b4f', soft: '#e3f0e8' },
      { name: '奖金', icon: '🎁', color: '#c58a31', soft: '#f7eedc' },
      { name: '兼职', icon: '🧑‍💻', color: '#5b86a8', soft: '#e6eef5' },
      { name: '理财', icon: '📈', color: '#7b6bb0', soft: '#ebe7f7' },
      { name: '其他', icon: '💰', color: '#8b8f87', soft: '#eeeee9' },
    ],
  };

  const numberFormatter = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const $ = (id) => document.getElementById(id);
  const els = {
    amount: $('amount'),
    note: $('note'),
    date: $('date'),
    entryForm: $('entry-form'),
    categoryPicker: $('category-picker'),
    formEyebrow: $('form-eyebrow'),
    formTitle: $('form-title'),
    submitBtn: $('submit-btn'),
    cancelEdit: $('btn-cancel-edit'),
    formError: $('form-error'),
    formCard: document.querySelector('.entry-card'),
    monthInput: $('month-input'),
    prevMonth: $('prev-month'),
    nextMonth: $('next-month'),
    btnToday: $('btn-today'),
    summaryBalance: $('summary-balance'),
    summaryTitle: $('summary-title'),
    summaryExpense: $('summary-expense'),
    summaryIncome: $('summary-income'),
    summaryCount: $('summary-count'),
    typeButtons: Array.from(document.querySelectorAll('.type-switch [data-type]')),
    filterButtons: Array.from(document.querySelectorAll('#filter-type [data-filter]')),
    filterCategory: $('filter-category'),
    search: $('search'),
    listRange: $('list-range'),
    listTotal: $('list-total'),
    entryList: $('entry-list'),
    emptyState: $('empty-state'),
    emptyTitle: $('empty-title'),
    emptyText: $('empty-text'),
    emptyAction: $('empty-action'),
    emptyDemo: $('empty-demo'),
    breakdown: $('breakdown'),
    btnExport: $('btn-export'),
    btnImport: $('btn-import'),
    fileImport: $('file-import'),
    confirmDialog: $('confirm-dialog'),
    confirmText: $('confirm-text'),
    confirmCancel: $('confirm-cancel'),
    confirmDelete: $('confirm-delete'),
    toast: $('toast'),
  };

  const state = {
    entries: loadEntries(),
    type: 'expense',
    category: CATEGORIES.expense[0].name,
    editingId: null,
    filterType: 'all',
    filterCategory: 'all',
    search: '',
    month: currentMonth(),
  };

  let pendingDeleteId = null;
  let toastTimer = 0;

  /* ------------------------------------------------------------------ */
  /* date / money helpers                                               */
  /* ------------------------------------------------------------------ */

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function toISODate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  }

  function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  function isValidMonth(value) {
    if (!/^\d{4}-\d{2}$/.test(String(value))) return false;
    const month = Number(String(value).slice(5, 7));
    return month >= 1 && month <= 12;
  }

  function parseDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function monthLabel(month) {
    if (!isValidMonth(month)) return month;
    return `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`;
  }

  function shiftMonth(month, delta) {
    if (!isValidMonth(month)) return currentMonth();
    const [year, monthNumber] = month.split('-').map(Number);
    const date = new Date(year, monthNumber - 1 + delta, 1);
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
  }

  function formatDay(value) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (value === toISODate(yesterday)) return '昨天';

    const date = parseDate(value);
    const year = date.getFullYear() === new Date().getFullYear() ? '' : `${date.getFullYear()}年`;
    return `${year}${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;
  }

  function timeLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function formatMoney(value) {
    return `¥${numberFormatter.format(Math.abs(Number(value) || 0))}`;
  }

  function signedAmount(entry) {
    return `${entry.type === 'expense' ? '-' : '+'}${formatMoney(entry.amount)}`;
  }

  function sumByType(list, type) {
    return list.reduce((sum, entry) => (entry.type === type ? sum + entry.amount : sum), 0);
  }

  function uid() {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch {
      /* file:// 等环境下可能没有 randomUUID */
    }
    return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /* ------------------------------------------------------------------ */
  /* storage                                                            */
  /* ------------------------------------------------------------------ */

  function normalizeEntry(input, regenerateId = false) {
    if (!input || typeof input !== 'object') return null;

    const type = input.type === 'income' ? 'income' : input.type === 'expense' ? 'expense' : null;
    if (!type) return null;

    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;

    const date = isValidDate(input.date) ? String(input.date) : todayISO();
    const categories = CATEGORIES[type];
    const category = categories.some((item) => item.name === input.category)
      ? input.category
      : categories[categories.length - 1].name;

    const createdAt =
      typeof input.createdAt === 'string' && !Number.isNaN(Date.parse(input.createdAt))
        ? input.createdAt
        : new Date().toISOString();

    const id =
      !regenerateId && typeof input.id === 'string' && input.id.length <= 80
        ? input.id
        : uid();

    return {
      id,
      type,
      amount: round2(amount),
      category,
      date,
      note: String(input.note ?? '').slice(0, 60),
      createdAt,
      updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : null,
    };
  }

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.entries)
          ? parsed.entries
          : [];
      return list.map((entry) => normalizeEntry(entry)).filter(Boolean);
    } catch {
      return [];
    }
  }

  function saveEntries() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, entries: state.entries }),
      );
      return true;
    } catch (error) {
      console.warn('保存失败', error);
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* category helpers                                                   */
  /* ------------------------------------------------------------------ */

  function categoryInfo(type, name) {
    const list = CATEGORIES[type] || CATEGORIES.expense;
    return list.find((item) => item.name === name) || list[list.length - 1];
  }

  function allCategoryNames() {
    return Array.from(
      new Set([...CATEGORIES.expense, ...CATEGORIES.income].map((item) => item.name)),
    );
  }

  /* ------------------------------------------------------------------ */
  /* form                                                               */
  /* ------------------------------------------------------------------ */

  function syncTypeButtons() {
    els.typeButtons.forEach((button) => {
      const active = button.dataset.type === state.type;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function renderCategoryPicker() {
    els.categoryPicker.replaceChildren();
    for (const category of CATEGORIES[state.type]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-btn';
      button.dataset.category = category.name;
      button.setAttribute('aria-pressed', String(category.name === state.category));
      button.classList.toggle('active', category.name === state.category);
      button.style.setProperty('--cat-soft', category.soft);

      const icon = document.createElement('span');
      icon.className = 'cat-icon';
      icon.textContent = category.icon;
      const label = document.createElement('span');
      label.textContent = category.name;

      button.append(icon, label);
      els.categoryPicker.append(button);
    }
  }

  function updateFormMode() {
    const editing = Boolean(state.editingId);
    els.formEyebrow.textContent = editing ? '正在修改' : '记一笔';
    els.formTitle.textContent = editing
      ? '改一下这笔记录'
      : state.type === 'expense'
        ? '今天花了什么？'
        : '今天进账了什么？';
    els.submitBtn.textContent = editing ? '保存修改' : '记下来';
    els.cancelEdit.hidden = !editing;
  }

  function setType(type) {
    state.type = type === 'income' ? 'income' : 'expense';
    state.category = CATEGORIES[state.type][0].name;
    syncTypeButtons();
    renderCategoryPicker();
    updateFormMode();
    clearFormError();
  }

  function showFormError(message) {
    els.formError.textContent = message;
  }

  function clearFormError() {
    els.formError.textContent = '';
  }

  function resetForm(options = {}) {
    state.editingId = null;
    if (!options.keepType) state.type = 'expense';
    state.category = CATEGORIES[state.type][0].name;
    els.amount.value = '';
    els.note.value = '';
    els.date.value = todayISO();
    syncTypeButtons();
    renderCategoryPicker();
    updateFormMode();
    clearFormError();
  }

  function startEdit(id) {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;

    state.editingId = entry.id;
    state.type = entry.type;
    state.category = entry.category;
    els.amount.value = entry.amount.toFixed(2);
    els.date.value = entry.date;
    els.note.value = entry.note;
    syncTypeButtons();
    renderCategoryPicker();
    updateFormMode();
    clearFormError();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    els.formCard.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(() => els.amount.focus({ preventScroll: true }), 160);
  }

  function handleSubmit(event) {
    event.preventDefault();
    clearFormError();

    const rawAmount = els.amount.value.trim().replace(/,/g, '');
    const amount = Number(rawAmount);
    if (!rawAmount || !Number.isFinite(amount) || amount <= 0) {
      showFormError('请输入大于 0 的金额');
      els.amount.focus();
      return;
    }
    if (amount > MAX_AMOUNT) {
      showFormError('单笔金额不能超过 9,999,999.99');
      els.amount.focus();
      return;
    }

    const date = els.date.value || todayISO();
    if (!isValidDate(date)) {
      showFormError('日期不对，请重新选择');
      els.date.focus();
      return;
    }

    const category = CATEGORIES[state.type].some((item) => item.name === state.category)
      ? state.category
      : CATEGORIES[state.type][0].name;
    const note = els.note.value.trim().slice(0, 60);
    const now = new Date().toISOString();
    let message = '记下了';

    if (state.editingId) {
      const index = state.entries.findIndex((entry) => entry.id === state.editingId);
      if (index === -1) {
        state.editingId = null;
        updateFormMode();
        showFormError('这条记录不在了，可能已经被删除');
        return;
      }
      state.entries[index] = {
        ...state.entries[index],
        type: state.type,
        amount: round2(amount),
        category,
        date,
        note,
        updatedAt: now,
      };
      message = '已保存修改';
      resetForm({ keepType: true });
    } else {
      state.entries.push({
        id: uid(),
        type: state.type,
        amount: round2(amount),
        category,
        date,
        note,
        createdAt: now,
        updatedAt: null,
      });
      els.amount.value = '';
      els.note.value = '';
    }

    const saved = saveEntries();
    renderAll();
    toast(saved ? message : '保存失败：浏览器存储空间不足');
    els.amount.focus();
  }

  /* ------------------------------------------------------------------ */
  /* filters / list                                                     */
  /* ------------------------------------------------------------------ */

  function syncFilterButtons() {
    els.filterButtons.forEach((button) => {
      const active = button.dataset.filter === state.filterType;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function renderFilterCategories() {
    const names =
      state.filterType === 'all'
        ? allCategoryNames()
        : CATEGORIES[state.filterType].map((item) => item.name);

    if (state.filterCategory !== 'all' && !names.includes(state.filterCategory)) {
      state.filterCategory = 'all';
    }

    const options = [new Option('全部分类', 'all')];
    for (const name of names) options.push(new Option(name, name));
    els.filterCategory.replaceChildren(...options);
    els.filterCategory.value = state.filterCategory;
  }

  function filteredEntries() {
    const query = state.search.toLowerCase();
    return state.entries
      .filter((entry) => entry.date.startsWith(state.month))
      .filter((entry) => state.filterType === 'all' || entry.type === state.filterType)
      .filter(
        (entry) => state.filterCategory === 'all' || entry.category === state.filterCategory,
      )
      .filter(
        (entry) =>
          !query ||
          `${entry.category} ${entry.note} ${formatDay(entry.date)}`
            .toLowerCase()
            .includes(query),
      )
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)),
      );
  }

  function filterLabel() {
    const typeLabel = { all: '全部', expense: '支出', income: '收入' }[state.filterType];
    const parts = [monthLabel(state.month), typeLabel];
    if (state.filterCategory !== 'all') parts.push(state.filterCategory);
    if (state.search) parts.push(`“${state.search.slice(0, 12)}”`);
    return parts.join(' · ');
  }

  function buildEntryRow(entry) {
    const category = categoryInfo(entry.type, entry.category);

    const row = document.createElement('div');
    row.className = 'entry-row';
    row.dataset.id = entry.id;

    const icon = document.createElement('div');
    icon.className = 'entry-icon';
    icon.textContent = category.icon;
    icon.style.setProperty('--cat-soft', category.soft);

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'entry-main';
    main.dataset.editId = entry.id;
    main.setAttribute('aria-label', `编辑 ${category.name} ${signedAmount(entry)}`);

    const title = document.createElement('span');
    title.className = 'entry-title';
    const categoryName = document.createElement('span');
    categoryName.textContent = category.name;
    title.append(categoryName);

    const note = document.createElement('span');
    note.className = 'entry-note';
    note.textContent = entry.note || timeLabel(entry.createdAt) || '—';

    main.append(title, note);

    const amount = document.createElement('span');
    amount.className = `entry-amount ${entry.type === 'expense' ? 'expense' : 'income'}`;
    amount.textContent = signedAmount(entry);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-btn';
    deleteButton.dataset.deleteId = entry.id;
    deleteButton.setAttribute('aria-label', '删除这笔记录');
    deleteButton.textContent = '×';

    row.append(icon, main, amount, deleteButton);
    return row;
  }

  function buildDayGroup(date, entries) {
    const group = document.createElement('section');
    group.className = 'day-group';

    const head = document.createElement('div');
    head.className = 'day-head';

    const dateLabel = document.createElement('span');
    dateLabel.className = 'day-date';
    dateLabel.textContent = formatDay(date);
    if (date === todayISO()) {
      const chip = document.createElement('span');
      chip.className = 'today-chip';
      chip.textContent = '今天';
      dateLabel.append(chip);
    }

    const expense = sumByType(entries, 'expense');
    const income = sumByType(entries, 'income');
    const parts = [];
    if (expense) parts.push(`支出 ${formatMoney(expense)}`);
    if (income) parts.push(`收入 ${formatMoney(income)}`);

    const sum = document.createElement('span');
    sum.className = 'day-sum';
    sum.textContent = parts.join(' · ') || '—';

    head.append(dateLabel, sum);
    group.append(head);

    for (const entry of entries) group.append(buildEntryRow(entry));
    return group;
  }

  function renderSummary() {
    const monthEntries = state.entries.filter((entry) => entry.date.startsWith(state.month));
    const expense = sumByType(monthEntries, 'expense');
    const income = sumByType(monthEntries, 'income');
    const balance = income - expense;

    els.summaryTitle.textContent =
      state.month === currentMonth() ? '本月结余' : `${monthLabel(state.month)}结余`;
    els.summaryBalance.textContent = `${balance < 0 ? '-' : ''}${formatMoney(balance)}`;
    els.summaryBalance.classList.toggle('is-negative', balance < 0);
    els.summaryExpense.textContent = formatMoney(expense);
    els.summaryIncome.textContent = formatMoney(income);
    els.summaryCount.textContent = `${monthEntries.length} 笔记录`;
  }

  function renderList() {
    const entries = filteredEntries();
    const expense = sumByType(entries, 'expense');
    const income = sumByType(entries, 'income');

    els.listRange.textContent = filterLabel();
    els.listTotal.textContent = entries.length
      ? `支出 ${formatMoney(expense)} · 收入 ${formatMoney(income)}`
      : '暂无记录';

    els.entryList.replaceChildren();

    if (!entries.length) {
      const hasEntries = state.entries.length > 0;
      els.entryList.hidden = true;
      els.emptyState.hidden = false;
      els.emptyTitle.textContent = hasEntries ? '没有符合条件的记录' : '还没有账目';
      els.emptyText.textContent = hasEntries
        ? '试试换个月份、类型、分类，或者清空搜索。'
        : '从上面记下第一笔，或者先看看示例数据。';
      els.emptyAction.textContent = hasEntries ? '清除筛选' : '记第一笔';
      els.emptyDemo.hidden = hasEntries;
      return;
    }

    els.emptyState.hidden = true;
    els.entryList.hidden = false;

    const groups = new Map();
    for (const entry of entries) {
      if (!groups.has(entry.date)) groups.set(entry.date, []);
      groups.get(entry.date).push(entry);
    }

    const dates = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));
    for (const date of dates) {
      els.entryList.append(buildDayGroup(date, groups.get(date)));
    }
  }

  function renderBreakdown() {
    const expenses = state.entries.filter(
      (entry) => entry.type === 'expense' && entry.date.startsWith(state.month),
    );

    els.breakdown.replaceChildren();

    if (!expenses.length) {
      const empty = document.createElement('div');
      empty.className = 'breakdown-empty';
      empty.textContent = '这个月还没有支出，记一笔就能看到分布。';
      els.breakdown.append(empty);
      return;
    }

    const totals = new Map();
    for (const entry of expenses) {
      totals.set(entry.category, (totals.get(entry.category) || 0) + entry.amount);
    }

    const total = expenses.reduce((sum, entry) => sum + entry.amount, 0);
    const rows = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    for (const [name, amount] of rows) {
      const category = categoryInfo('expense', name);
      const percent = total > 0 ? (amount / total) * 100 : 0;

      const row = document.createElement('div');
      row.className = 'breakdown-row';
      row.style.setProperty('--cat', category.color);

      const label = document.createElement('div');
      label.className = 'breakdown-label';
      const emoji = document.createElement('span');
      emoji.className = 'breakdown-emoji';
      emoji.textContent = category.icon;
      emoji.style.setProperty('--cat-soft', category.soft);
      const text = document.createElement('span');
      text.textContent = category.name;
      label.append(emoji, text);

      const value = document.createElement('div');
      value.className = 'breakdown-value';
      const money = document.createElement('b');
      money.textContent = formatMoney(amount);
      value.append(money, ` · ${Math.round(percent)}%`);

      const track = document.createElement('div');
      track.className = 'bar-track';
      const fill = document.createElement('div');
      fill.className = 'bar-fill';
      fill.style.width = `${Math.max(percent, 0).toFixed(2)}%`;
      track.append(fill);

      row.append(label, value, track);
      els.breakdown.append(row);
    }
  }

  function renderAll() {
    renderSummary();
    renderList();
    renderBreakdown();
    updateFormMode();
    syncTypeButtons();
  }

  /* ------------------------------------------------------------------ */
  /* delete / toast                                                     */
  /* ------------------------------------------------------------------ */

  function requestDelete(id) {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;

    const category = categoryInfo(entry.type, entry.category);
    pendingDeleteId = id;
    els.confirmText.textContent = `${category.name} ${signedAmount(entry)}${
      entry.note ? ` · ${entry.note}` : ''
    }。删除后不能恢复，建议先导出备份。`;

    if (typeof els.confirmDialog.showModal === 'function') {
      els.confirmDialog.showModal();
    } else if (window.confirm('删除这笔记录？删除后不能恢复。')) {
      deleteEntry(id);
    }
  }

  function deleteEntry(id) {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;

    state.entries = state.entries.filter((item) => item.id !== id);
    if (state.editingId === id) resetForm({ keepType: true });
    const saved = saveEntries();
    renderAll();
    toast(saved ? '已删除' : '删除后保存失败，请检查浏览器存储');
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => els.toast.classList.remove('show'), 2300);
  }

  /* ------------------------------------------------------------------ */
  /* backup / sample                                                    */
  /* ------------------------------------------------------------------ */

  function exportBackup() {
    const payload = {
      app: '简账',
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: state.entries,
    };
    const filename = `简账备份-${todayISO()}.json`;
    const json = JSON.stringify(payload, null, 2);

    // Android WebView 里用原生桥保存到「下载」；浏览器里走 Blob 下载。
    if (window.AndroidLedger && typeof window.AndroidLedger.saveJson === 'function') {
      try {
        const saved = window.AndroidLedger.saveJson(filename, json);
        toast(saved ? '备份已保存到「下载」' : '备份保存失败，请重试');
        return;
      } catch (error) {
        console.warn('Android 备份桥失败，回退到浏览器下载', error);
      }
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 600);
    toast(state.entries.length ? '备份已导出' : '当前没有记录，已导出空备份');
  }

  async function importBackup(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('备份文件太大了（最多 2MB）');
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.entries)
          ? parsed.entries
          : null;

      if (!list) throw new Error('not an entry list');

      const cleaned = list
        .map((entry) => normalizeEntry({ ...entry, id: uid() }, true))
        .filter(Boolean);

      if (list.length > 0 && cleaned.length === 0) throw new Error('no valid entries');

      if (
        !window.confirm(
          `导入 ${cleaned.length} 笔记录，会替换当前 ${state.entries.length} 笔。继续吗？`,
        )
      ) {
        return;
      }

      state.entries = cleaned;
      state.editingId = null;
      state.filterType = 'all';
      state.filterCategory = 'all';
      state.search = '';
      els.search.value = '';
      const latest = cleaned.map((entry) => entry.date).sort().pop();
      state.month = latest ? latest.slice(0, 7) : currentMonth();
      els.monthInput.value = state.month;
      resetForm();
      syncFilterButtons();
      renderFilterCategories();
      const saved = saveEntries();
      renderAll();
      toast(saved ? `已导入 ${cleaned.length} 笔记录` : '导入成功，但保存失败');
    } catch {
      toast('导入失败：文件格式不对');
    }
  }

  function loadSample() {
    if (
      state.entries.length &&
      !window.confirm('会在现有记录后追加 6 笔示例，继续吗？')
    ) {
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const currentDay = now.getDate();

    const makeDate = (daysAgo) => {
      const day = Math.max(1, currentDay - daysAgo);
      return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
    };

    const samples = [
      { daysAgo: 0, type: 'expense', amount: 32.5, category: '餐饮', note: '午饭' },
      { daysAgo: 0, type: 'expense', amount: 4, category: '交通', note: '地铁' },
      { daysAgo: 1, type: 'expense', amount: 129, category: '购物', note: '日用品' },
      { daysAgo: 2, type: 'expense', amount: 45, category: '娱乐', note: '电影票' },
      { daysAgo: 3, type: 'income', amount: 6500, category: '工资', note: '本月工资' },
      { daysAgo: 4, type: 'expense', amount: 68, category: '学习', note: '买书' },
    ].map((item, index) => ({
      id: uid(),
      type: item.type,
      amount: item.amount,
      category: item.category,
      date: makeDate(item.daysAgo),
      note: item.note,
      createdAt: new Date(Date.now() - index * 60000).toISOString(),
      updatedAt: null,
    }));

    state.entries.push(...samples);
    state.month = currentMonth();
    els.monthInput.value = state.month;
    state.filterType = 'all';
    state.filterCategory = 'all';
    state.search = '';
    els.search.value = '';
    syncFilterButtons();
    renderFilterCategories();
    const saved = saveEntries();
    renderAll();
    toast(saved ? '示例数据已加入，可以开始看看' : '示例已加入，但保存失败');
  }

  function clearFilters() {
    state.filterType = 'all';
    state.filterCategory = 'all';
    state.search = '';
    els.search.value = '';
    syncFilterButtons();
    renderFilterCategories();
    renderList();
  }

  /* ------------------------------------------------------------------ */
  /* events                                                             */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    els.typeButtons.forEach((button) => {
      button.addEventListener('click', () => setType(button.dataset.type));
    });

    els.categoryPicker.addEventListener('click', (event) => {
      const button = event.target.closest('.category-btn');
      if (!button) return;
      state.category = button.dataset.category;
      renderCategoryPicker();
      clearFormError();
    });

    els.entryForm.addEventListener('submit', handleSubmit);
    [els.amount, els.date, els.note].forEach((input) => {
      input.addEventListener('input', clearFormError);
    });

    els.amount.addEventListener('blur', () => {
      const value = Number(els.amount.value.replace(/,/g, ''));
      if (Number.isFinite(value) && value > 0) {
        els.amount.value = round2(value).toFixed(2);
      }
    });

    els.cancelEdit.addEventListener('click', () => resetForm({ keepType: true }));

    els.prevMonth.addEventListener('click', () => {
      state.month = shiftMonth(state.month, -1);
      els.monthInput.value = state.month;
      renderAll();
    });

    els.nextMonth.addEventListener('click', () => {
      state.month = shiftMonth(state.month, 1);
      els.monthInput.value = state.month;
      renderAll();
    });

    els.monthInput.addEventListener('change', () => {
      if (!isValidMonth(els.monthInput.value)) {
        els.monthInput.value = state.month;
        return;
      }
      state.month = els.monthInput.value;
      renderAll();
    });

    els.btnToday.addEventListener('click', () => {
      state.month = currentMonth();
      els.monthInput.value = state.month;
      renderAll();
    });

    els.filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.filterType = button.dataset.filter;
        state.filterCategory = 'all';
        syncFilterButtons();
        renderFilterCategories();
        renderList();
      });
    });

    els.filterCategory.addEventListener('change', () => {
      state.filterCategory = els.filterCategory.value;
      renderList();
    });

    els.search.addEventListener('input', () => {
      state.search = els.search.value.trim();
      renderList();
    });

    els.entryList.addEventListener('click', (event) => {
      const deleteButton = event.target.closest('[data-delete-id]');
      if (deleteButton) {
        requestDelete(deleteButton.dataset.deleteId);
        return;
      }
      const editButton = event.target.closest('[data-edit-id]');
      if (editButton) startEdit(editButton.dataset.editId);
    });

    els.emptyAction.addEventListener('click', () => {
      if (state.entries.length) {
        clearFilters();
      } else {
        els.amount.focus();
      }
    });

    els.emptyDemo.addEventListener('click', loadSample);

    els.btnExport.addEventListener('click', exportBackup);
    els.btnImport.addEventListener('click', () => els.fileImport.click());
    els.fileImport.addEventListener('change', () => {
      const [file] = els.fileImport.files || [];
      els.fileImport.value = '';
      importBackup(file);
    });

    els.confirmCancel.addEventListener('click', () => {
      pendingDeleteId = null;
      els.confirmDialog.close();
    });

    els.confirmDelete.addEventListener('click', () => {
      const id = pendingDeleteId;
      pendingDeleteId = null;
      els.confirmDialog.close();
      if (id) deleteEntry(id);
    });

    els.confirmDialog.addEventListener('close', () => {
      pendingDeleteId = null;
    });

    els.confirmDialog.addEventListener('click', (event) => {
      if (event.target === els.confirmDialog) els.confirmDialog.close();
    });
  }

  /* ------------------------------------------------------------------ */
  /* init                                                               */
  /* ------------------------------------------------------------------ */

  function init() {
    els.monthInput.value = state.month;
    els.date.value = todayISO();
    bindEvents();
    syncFilterButtons();
    renderFilterCategories();
    setType('expense');
    renderAll();
  }

  init();
})();
