import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWalletPage } from '../src/wallet-ui.js';

test('钱包流水页面提供钱包年度分析入口', () => {
  const html = renderWalletPage({ records: [], settings: { manualRate: 3500, walletCategories: [] }, month: '2026-11' });
  assert.match(html, /钱包年度分析/);
  assert.match(html, /data-action="wallet-stats"/);
});
