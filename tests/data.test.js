import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, MemoryStore, LocalStore, makeBackup, validateBackup, applyWalletRecord, getWalletBalance, calcLoanBalance, calcLoanBalances, getWalletAssets, getProjectProgress, getReadingProgress, isTaskOverdue, getWalletCategoryBreakdown, getWalletMonthlySeries } from '../src/data.js';

test('初始数据包含全部模块', () => {
  const data = emptyData();
  for (const key of ['dailyPlans', 'memos', 'dietEntries', 'fitnessSessions', 'workProjects', 'workTasks', 'walletRecords', 'readingItems']) assert.ok(key in data);
});

test('MemoryStore 不会暴露内部引用', () => {
  const store = new MemoryStore(); const copy = store.snapshot(); copy.dailyPlans.push({ id: 'x' });
  assert.equal(store.snapshot().dailyPlans.length, 0);
});

test('LocalStore 可以新增、更新、软删除', () => {
  const values = new Map(); const storage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const store = new LocalStore('test', storage); const item = store.add('memos', { text: '记得备份' });
  assert.equal(store.active('memos').length, 1); store.update('memos', item.id, { processed: true }); assert.equal(store.active('memos')[0].processed, true);
  store.remove('memos', item.id); assert.equal(store.active('memos').length, 0);
});

test('备份可以生成并校验，错误备份会拒绝', () => {
  const backup = makeBackup(emptyData()); assert.equal(validateBackup(backup), true);
  assert.throws(() => validateBackup({ schemaVersion: 99, data: {} }), /无效/);
});

test('钱包流水按收入支出兑换规则计算双币余额', () => {
  let balance = { mmk: 0, usd: 0 };
  balance = applyWalletRecord(balance, { type: '收入', mmk: 10000, usd: 3 });
  balance = applyWalletRecord(balance, { type: '支出', mmk: 2000, usd: 1 });
  balance = applyWalletRecord(balance, { type: '兑换', mmk: 3500, usd: -1 });
  assert.deepEqual(balance, { mmk: 11500, usd: 1 });
});

test('钱包余额支持按日期计算，借还款按人计算净借出', () => {
  const records = [
    { date: '2026-01-01', type: '收入', mmk: 100, usd: 1 },
    { date: '2026-02-01', type: '支出', mmk: 20, usd: 0 },
    { date: '2026-02-02', type: '借出', consumer: '小明', mmk: 50, usd: 2 },
    { date: '2026-02-03', type: '还入', consumer: '小明', mmk: 10, usd: 0 }
  ];
  assert.deepEqual(getWalletBalance(records, '2026-02-01'), { mmk: 100, usd: 1 });
  assert.equal(calcLoanBalance(records, '小明'), -40);
  assert.deepEqual(calcLoanBalances(records, '小明'), { mmk: -40, usd: -2 });
});

test('下个月结余会承接上月余额，资产会把未还借款计入当前汇率换算', () => {
  const records = [
    { date: '2026-11-30', type: '收入', mmk: 4109720, usd: 1000 },
    { date: '2026-12-01', type: '收入', mmk: 50000, usd: 0 },
    { date: '2026-12-02', type: '借出', consumer: '小王', mmk: 300000, usd: 500 },
    { date: '2026-12-03', type: '还入', consumer: '小王', mmk: 0, usd: 400 }
  ];
  assert.deepEqual(getWalletBalance(records, '2026-12-01'), { mmk: 4109720, usd: 1000 });
  assert.deepEqual(getWalletBalance(records, '2027-01-01'), { mmk: 3859720, usd: 900 });
  assert.equal(getWalletMonthlySeries(records, '2026-12', 2)[1].balance, 3859720);
  const assets = getWalletAssets(records, 3770);
  assert.deepEqual(assets.loan, { mmk: -300000, usd: -100 });
  assert.deepEqual(assets.receivable, { mmk: 300000, usd: 100 });
  assert.equal(assets.usdAsset, 1000);
  assert.equal(assets.mmkAsset, 4159720 + 1000 * 3770);
});

test('钱包分类分析会按月份计算金额和占比', () => {
  const rows = [
    { date: '2026-11-01', type: '支出', category: '生活', mmk: 300 },
    { date: '2026-11-02', type: '支出', category: '娱乐', mmk: 100 },
    { date: '2026-11-03', type: '收入', category: '工作', mmk: 500 }
  ];
  assert.deepEqual(getWalletCategoryBreakdown(rows, '2026-11', '支出'), [
    { category: '生活', amount: 300, percent: 75 },
    { category: '娱乐', amount: 100, percent: 25 }
  ]);
});

test('钱包月度趋势返回连续六个月收入支出', () => {
  const series = getWalletMonthlySeries([{ date: '2026-11-01', type: '收入', mmk: 500 }, { date: '2026-11-02', type: '支出', mmk: 200 }], '2026-11', 3);
  assert.deepEqual(series.map(x => x.month), ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual(series[2], { month: '2026-11', income: 500, expense: 200, balance: 300 });
});

test('阅读进度优先按当前页和总页数计算', () => {
  assert.equal(getReadingProgress({ currentPage: 25, totalPages: 100 }), 25);
  assert.equal(getReadingProgress({ progress: 40 }), 40);
  assert.equal(getReadingProgress({ currentPage: 120, totalPages: 100 }), 100);
});

test('项目进度累计已完成任务进度并限制为100%', () => {
  const tasks = [
    { projectId: 'p1', status: '已完成', progress: 35 },
    { projectId: 'p1', status: '已完成', progress: 70 },
    { projectId: 'p1', status: '进行中', progress: 90 },
    { projectId: 'p2', status: '已完成', progress: 20, deletedAt: '2026-01-01' }
  ];
  assert.equal(getProjectProgress('p1', tasks), 100);
  assert.equal(getProjectProgress('p2', tasks), 0);
});

test('进行任务超过预期完成时间会标记逾期，完成后不再逾期', () => {
  const reference = new Date('2026-11-08T12:00:00');
  assert.equal(isTaskOverdue({ status: '进行中', expectedAt: '2026-11-08T11:59' }, reference), true);
  assert.equal(isTaskOverdue({ status: '已完成', expectedAt: '2026-11-08T11:59' }, reference), false);
  assert.equal(isTaskOverdue({ status: '进行中', expectedAt: '2026-11-08T13:00' }, reference), false);
});
