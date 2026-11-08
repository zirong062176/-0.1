export const SCHEMA_VERSION = 1;

export const emptyData = () => ({
  settings: { theme: 'light', weekStartsOn: 1, manualRate: 3500, dashboardCards: ['diet', 'fitness', 'work', 'wallet', 'reading'] },
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
  load() { try { const raw = this.storage?.getItem(this.key); return raw ? { ...emptyData(), ...JSON.parse(raw) } : emptyData(); } catch { return emptyData(); } }
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

export const calcLoanBalance = (records, name = '') => records.filter(r => !r.deletedAt && ['借出', '还入'].includes(r.type) && (!name || r.consumer === name)).reduce((sum, r) => sum + (r.type === '借出' ? 1 : -1) * Number(r.mmk || 0), 0);

export const validateBackup = (backup) => {
  if (!backup || typeof backup !== 'object' || backup.schemaVersion !== SCHEMA_VERSION || !backup.data) throw new Error('备份文件格式或版本无效');
  const required = Object.keys(emptyData());
  for (const key of required) if (!(key in backup.data) || !Array.isArray(backup.data[key]) && key !== 'settings') throw new Error(`备份缺少数据：${key}`);
  return true;
};
