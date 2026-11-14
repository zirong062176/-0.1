import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWalletPage } from '../src/wallet-ui.js';
import { renderWalletStatsPage } from '../src/wallet-stats.js';

test('钱包流水页面提供钱包年度分析入口', () => {
  const html = renderWalletPage({ records: [], settings: { manualRate: 3500, walletCategories: [] }, month: '2026-11' });
  assert.match(html, /钱包年度分析/);
  assert.match(html, /data-action="wallet-stats"/);
});

test('钱包年度分析统一统计五类资金并单独分析兑换', () => {
  const html = renderWalletStatsPage({ year: 2026, settings: { manualRate: 3500 }, records: [
    { date: '2026-11-01', type: '收入', category: '工作', mmk: 1000, usd: 1 },
    { date: '2026-11-02', type: '支出', category: '生活', mmk: 200 },
    { date: '2026-11-03', type: '兑换', mmk: 3500, usd: -1, rate: 3500 },
    { date: '2026-11-04', type: '借出', mmk: 500, usd: 0 },
    { date: '2026-11-05', type: '还入', mmk: 300, usd: 0 },
    { date: '2026-11-06', type: '兑换', mmk: 3770, usd: -1, rate: 3770 }
  ] });
  assert.match(html, /全年资金流向/);
  assert.match(html, /收入/);
  assert.match(html, /支出/);
  assert.match(html, /兑换/);
  assert.match(html, /借出/);
  assert.match(html, /还入/);
  assert.match(html, /兑换汇率分析/);
  assert.match(html, /\+270/);
  assert.match(html, /annual-loan-out/);
  assert.match(html, /annual-exchange/);
});
