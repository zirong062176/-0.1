export const SCHEMA_VERSION = 1;

export const emptyData = () => ({
  settings: { theme: 'light', weekStartsOn: 1, manualRate: 3500, walletCategories: ['生活', '娱乐', '工作', '家人', '交通', '住房', '医疗', '学习', '旅行', '其他'], dashboardCards: ['diet', 'fitness', 'work', 'wallet', 'reading'] },
  dailyPlans: [], memos: [], dietEntries: [], fitnessSessions: [], fitnessExercises: [],
  workProjects: [], workTasks: [], walletRecords: [], readingItems: [], readingLogs: [],
  reviewRecords: [], backupLogs: []
});

export const createId = (prefix = 'item') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const now = () => new Date().toISOString();

export class MemoryStore {
  constructor(seed = emptyData()) { this.data = structuredClone(seed); }
  snapshot() { return structuredClone(this.data); }
}

export class LocalStore {
  constructor(key = 'personal-life-app-v1', storage = globalThis.localStorage) { this.key = key; this.storage = storage; this.data = this.load(); }
  load() { try { const raw = this.storage?.getItem(this.key); if (!raw) return emptyData(); const saved = JSON.parse(raw); return { ...emptyData(), ...saved, settings: { ...emptyData().settings, ...(saved.settings || {}) } }; } catch { return emptyData(); } }
  save() { this.storage?.setItem(this.key, JSON.stringify(this.data)); return this.data; }
  replace(data) { this.data = structuredClone(data); this.save(); return this.data; }
  snapshot() { return structuredClone(this.data); }
  add(collection, value) { this.data[collection].push({ id: createId(collection.slice(0, -1)), createdAt: now(), updatedAt: now(), ...value }); this.save(); return this.data[collection].at(-1); }
  update(collection, id, patch) { const item = this.data[collection].find((x) => x.id === id); if (!item) return null; Object.assign(item, patch, { updatedAt: now() }); this.save(); return item; }
  remove(collection, id) { const item = this.data[collection].find((x) => x.id === id); if (!item) return false; item.deletedAt = now(); item.updatedAt = now(); this.save(); return true; }
  active(collection) { return this.data[collection].filter((x) => !x.deletedAt); }
}

export const makeBackup = (data, appVersion = '1.0.0') => ({ schemaVersion: SCHEMA_VERSION, appVersion, exportedAt: now(), data: structuredClone(data) });

export const applyWalletRecord = (balance, record) => {
  const sign = ['收入', '兑换', '还入'].includes(record.type) ? 1 : -1;
  return { mmk: balance.mmk + sign * Number(record.mmk || 0), usd: balance.usd + sign * Number(record.usd || 0) };
};

export const getWalletBalance = (records, beforeDate = '') => records.filter(r => !r.deletedAt && (!beforeDate || r.date < beforeDate)).sort((a, b) => a.date.localeCompare(b.date)).reduce(applyWalletRecord, { mmk: 0, usd: 0 });

export const calcLoanBalances = (records, name = '') => records.filter(r => !r.deletedAt && ['借出', '还入'].includes(r.type) && (!name || r.consumer === name)).reduce((sum, r) => { const sign = r.type === '借出' ? -1 : 1; return { mmk: sum.mmk + sign * Number(r.mmk || 0), usd: sum.usd + sign * Number(r.usd || 0) }; }, { mmk: 0, usd: 0 });

export const calcLoanBalance = (records, name = '') => calcLoanBalances(records, name).mmk;

export const clampProgress = (value) => Math.max(0, Math.min(100, Number(value || 0)));

export const getReadingProgress = (item = {}) => {
  const totalPages = Number(item.totalPages || 0);
  if (totalPages > 0) return clampProgress(Number(item.currentPage || 0) / totalPages * 100);
  return clampProgress(item.progress);
};

export const getProjectProgress = (projectId, tasks = []) => clampProgress(tasks.filter((task) => !task.deletedAt && task.projectId === projectId && task.status === '已完成').reduce((sum, task) => sum + clampProgress(task.projectProgress ?? task.progress), 0));

export const isTaskOverdue = (task = {}, reference = new Date()) => {
  if (!task || task.status === '已完成') return false;
  const deadline = task.expectedAt || task.expectedCompletionAt || task.expectedDate || task.dueDate;
  if (!deadline) return false;
  const normalized = String(deadline).length === 10 ? `${deadline}T23:59:59` : deadline;
  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) && timestamp < new Date(reference).getTime();
};

export const isTaskLate = (task = {}, reference = new Date()) => {
  const deadline = task.expectedAt || task.expectedCompletionAt || task.expectedDate || task.dueDate;
  if (!deadline) return false;
  const normalized = String(deadline).length === 10 ? `${deadline}T23:59:59` : deadline;
  const deadlineTime = new Date(normalized).getTime();
  if (!Number.isFinite(deadlineTime)) return false;
  if (task.status === '已完成') return Boolean(task.completedAt) && new Date(task.completedAt).getTime() > deadlineTime;
  return deadlineTime < new Date(reference).getTime();
};

export const getTaskDelayMs = (task = {}) => {
  const deadline = task.expectedAt || task.expectedCompletionAt || task.expectedDate || task.dueDate;
  const completedAt = task.completedAt;
  if (!deadline || !completedAt) return 0;
  const deadlineTime = new Date(String(deadline).length === 10 ? `${deadline}T23:59:59` : deadline).getTime();
  const completedTime = new Date(completedAt).getTime();
  return Number.isFinite(deadlineTime) && Number.isFinite(completedTime) ? Math.max(0, completedTime - deadlineTime) : 0;
};

export const classifyTaskTiming = (task = {}) => {
  const delayMs = getTaskDelayMs(task);
  if (task.lateReasonType === '拖延') return 'procrastination';
  if (task.lateReasonType === '原因') return 'reason';
  if (delayMs >= 24 * 60 * 60 * 1000) return 'severe';
  if (delayMs >= 60 * 60 * 1000) return 'minor';
  return 'normal';
};

export const getWorkExecutionAnalytics = (tasks = [], reference = new Date()) => {
  const rows = tasks.filter((task) => !task.deletedAt);
  const completed = rows.filter((task) => task.status === '已完成');
  const activeOverdue = rows.filter((task) => isTaskOverdue(task, reference));
  const counts = { normal: 0, minor: 0, severe: 0, reason: 0, procrastination: 0 };
  let delayMs = 0;
  completed.forEach((task) => { const kind = classifyTaskTiming(task); counts[kind] += 1; delayMs += getTaskDelayMs(task); });
  const byStrategy = Object.fromEntries(['A', 'B', 'C', 'D', 'E'].map((key) => {
    const group = rows.filter((task) => task.strategy === key); const done = group.filter((task) => task.status === '已完成');
    return [key, { total: group.length, completed: done.length, completionRate: group.length ? done.length / group.length * 100 : 0, normal: done.filter((task) => classifyTaskTiming(task) === 'normal').length, late: done.filter((task) => classifyTaskTiming(task) !== 'normal').length, overdue: group.filter((task) => isTaskOverdue(task, reference)).length }];
  }));
  return { total: rows.length, completed: completed.length, activeOverdue: activeOverdue.length, completionRate: rows.length ? completed.length / rows.length * 100 : 0, normalRate: completed.length ? counts.normal / completed.length * 100 : 0, lateRate: completed.length ? (completed.length - counts.normal) / completed.length * 100 : 0, counts, averageDelayMs: completed.length ? delayMs / completed.length : 0, maxDelayMs: completed.reduce((max, task) => Math.max(max, getTaskDelayMs(task)), 0), byStrategy };
};

export const getWalletAssets = (records, manualRate = 3500) => {
  const cash = getWalletBalance(records);
  const loan = calcLoanBalances(records);
  const receivable = { mmk: -loan.mmk, usd: -loan.usd };
  const usdAsset = cash.usd + receivable.usd;
  const mmkAsset = usdAsset * Number(manualRate || 3500) + cash.mmk + receivable.mmk;
  return { cash, loan, receivable, usdAsset, mmkAsset, rate: Number(manualRate || 3500) };
};

export const getWalletCategoryBreakdown = (records, month, kind = '支出') => {
  const rows = records.filter(r => !r.deletedAt && r.date?.startsWith(month) && r.type === kind);
  const totals = rows.reduce((map, row) => { const key = row.category || '其他'; map[key] = (map[key] || 0) + Number(row.mmk || 0); return map; }, {});
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  return Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount, percent: total ? amount / total * 100 : 0 }));
};

export const getWalletMonthlySeries = (records, endMonth, count = 6) => {
  const end = new Date(`${endMonth}-01T12:00:00`); const result = [];
  for (let i = count - 1; i >= 0; i -= 1) { const date = new Date(end); date.setMonth(end.getMonth() - i); const month = date.toISOString().slice(0, 7); const next = new Date(date); next.setMonth(date.getMonth() + 1); const nextMonth = next.toISOString().slice(0, 7); const rows = records.filter(r => !r.deletedAt && r.date?.startsWith(month)); const income = rows.filter(r => r.type === '收入').reduce((n, r) => n + Number(r.mmk || 0), 0); const expense = rows.filter(r => r.type === '支出').reduce((n, r) => n + Number(r.mmk || 0), 0); const balance = getWalletBalance(records, nextMonth).mmk; result.push({ month, income, expense, balance }); }
  return result;
};

export const validateBackup = (backup) => {
  if (!backup || typeof backup !== 'object' || backup.schemaVersion !== SCHEMA_VERSION || !backup.data) throw new Error('备份文件格式或版本无效');
  const required = Object.keys(emptyData());
  for (const key of required) if (!(key in backup.data) || !Array.isArray(backup.data[key]) && key !== 'settings') throw new Error(`备份缺少数据：${key}`);
  return true;
};
