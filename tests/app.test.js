import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../src/data.js';

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.location = { hash: '' };
globalThis.window = { addEventListener: () => {} };
globalThis.document = { querySelector: () => ({ innerHTML: '' }), addEventListener: () => {} };
const { navItems, strategy, getStats, escapeHtml } = await import('../src/app.js');

test('导航包含 PRD 要求的八个页面', () => {
  assert.deepEqual(navItems.map(x => x[0]), ['dashboard', 'daily', 'diet', 'fitness', 'work', 'wallet', 'reading', 'settings']);
  assert.equal(navItems.find(x => x[0] === 'daily')[1], '关联全部计划');
});

test('A-E 战略分类文字完整', () => {
  assert.equal(Object.keys(strategy).join(''), 'ABCDE');
  assert.equal(strategy.A, '需要做');
  assert.equal(strategy.D, '可以接受别人去做');
  assert.equal(strategy.E, '可以省略不做');
});

test('统计会汇总计划、工作、健身和阅读记录', () => {
  const data = emptyData();
  data.dailyPlans = [{ status: '已完成' }, { status: '待处理' }];
  data.workTasks = [{}, {}, {}];
  data.fitnessSessions = [{}];
  data.readingLogs = [{ minutes: 30 }, { minutes: 15 }];
  assert.deepEqual(getStats(data), { plans: 2, completed: 1, work: 3, fitness: 1, readingMinutes: 45 });
});

test('页面文本转义避免把用户输入当成 HTML', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});
