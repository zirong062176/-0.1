import { applyWalletRecord, calcLoanBalances, getWalletAssets, getWalletBalance, getWalletCategoryBreakdown, getWalletMonthlySeries } from './data.js';

const safe = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (value) => Number(value || 0).toLocaleString('en-US');
const monthLabel = (month) => month.replace('-', '年') + '月';
const nextMonth = (month) => { const date = new Date(`${month}-01T12:00:00`); date.setMonth(date.getMonth() + 1); return date.toISOString().slice(0, 7); };
const colors = ['#7681ee', '#e6b86a', '#e89191', '#8bc8b3', '#a88be4', '#85b7d5', '#c8a990', '#a6aebb'];

const button = (text, action, cls = 'ghost') => `<button class="button ${cls}" data-action="${action}">${text}</button>`;
const badge = (text, cls = '') => `<span class="badge ${cls}">${safe(text)}</span>`;
const empty = (text, action = '') => `<div class="empty"><div class="empty-mark">○</div><p>${text}</p>${action}</div>`;

function donutStyle(items) {
  if (!items.length) return 'background:#edf0f5';
  let cursor = 0; const pieces = items.map((item, index) => { const start = cursor; cursor += item.percent; return `${colors[index % colors.length]} ${start}% ${cursor}%`; });
  return `background:conic-gradient(${pieces.join(',')})`;
}

function categoryBars(items) {
  return items.length ? items.map((item, index) => `<div class="category-stat"><div class="category-line"><span class="category-name"><i style="background:${colors[index % colors.length]}"></i>${safe(item.category)}</span><b>${item.percent.toFixed(1)}%</b></div><div class="category-track"><i style="width:${item.percent}%;background:${colors[index % colors.length]}"></i></div><small>${money(item.amount)} K</small></div>`).join('') : '<p class="muted">这个月还没有可分析的记录。</p>';
}

export function renderWalletPage({ records, settings, month, filter = 'all' }) {
  const activeRecords = records.filter((r) => !r.deletedAt).sort((a, b) => `${a.date}${a.createdAt || ''}`.localeCompare(`${b.date}${b.createdAt || ''}`));
  const monthRows = activeRecords.filter((r) => r.date?.startsWith(month));
  const shownRows = filter === 'loan' ? monthRows.filter((r) => ['借出', '还入'].includes(r.type)) : filter === 'daily' ? monthRows.filter((r) => !['借出', '还入'].includes(r.type)) : monthRows;
  const balanceBefore = getWalletBalance(activeRecords, `${month}-01`); let balance = balanceBefore;
  const balances = new Map(monthRows.map((r) => { balance = applyWalletRecord(balance, r); return [r.id, { ...balance }]; }));
  const tableRows = shownRows.map((r) => ({ ...r, running: balances.get(r.id) || balanceBefore })).reverse();
  const income = monthRows.filter((r) => r.type === '收入').reduce((n, r) => n + Number(r.mmk || 0), 0);
  const expense = monthRows.filter((r) => r.type === '支出').reduce((n, r) => n + Number(r.mmk || 0), 0);
  const periodRecords = activeRecords.filter((r) => r.date < `${nextMonth(month)}-01`);
  const monthBalance = getWalletBalance(periodRecords);
  const assets = getWalletAssets(periodRecords, settings.manualRate || 3500);
  const kind = filter === 'income' ? '收入' : '支出';
  const breakdown = getWalletCategoryBreakdown(activeRecords, month, kind);
  const series = getWalletMonthlySeries(activeRecords, month);
  const maxTrend = Math.max(1, ...series.map((x) => Math.max(x.income, x.expense)));
  const loans = activeRecords.filter((r) => ['借出', '还入'].includes(r.type));
  const loanPeople = [...new Set(loans.map((r) => r.consumer || '未命名'))];
  const categories = settings.walletCategories || [];
  return `<div class="module-header wallet-header"><div><span class="eyebrow">PERSONAL FINANCE</span><h2>钱包流水</h2><p>所有收入、支出、兑换和借还款，集中在一张清晰的账本里。</p></div><div class="module-actions">${button('钱包年度分析 →', 'wallet-stats')}${button('+ 添加流水', 'new-wallet', 'primary')}</div></div>
    <div class="wallet-summary-grid">
      <div class="wallet-stat income"><span>本月收入</span><b>${money(income)} K</b><small>+$ ${money(monthRows.filter(r => r.type === '收入').reduce((n, r) => n + Number(r.usd || 0), 0))}</small></div>
      <div class="wallet-stat expense"><span>本月支出</span><b>${money(expense)} K</b><small>-$ ${money(monthRows.filter(r => r.type === '支出').reduce((n, r) => n + Number(r.usd || 0), 0))}</small></div>
      <div class="wallet-stat balance"><span>本月结余</span><b>${money(monthBalance.mmk)} K</b><small>含上月结余与借还款现金流</small></div>
      <div class="wallet-stat asset"><span>总缅币资产</span><b>${money(assets.mmkAsset)} K</b><small>美元资产 × 汇率 + 结余 + 未还借款</small></div>
      <div class="wallet-stat asset"><span>总美元资产</span><b>$ ${money(assets.usdAsset)}</b><small>当前汇率 ${money(assets.rate)} · 含未收回借款</small></div>
    </div>
    <div class="wallet-toolbar"><div class="wallet-month"><button class="button ghost" data-wallet-month="prev">←</button><strong>${monthLabel(month)}</strong><button class="button ghost" data-wallet-month="next">→</button></div><div class="wallet-actions">${button('＋ 兑换', 'new-exchange')} ${button('导出备份', 'backup')}</div></div>
    <div class="wallet-filter-bar"><button class="pill ${filter === 'all' ? 'active' : ''}" data-wallet-filter="all">全部</button><button class="pill ${filter === 'daily' ? 'active' : ''}" data-wallet-filter="daily">日常流水</button><button class="pill ${filter === 'loan' ? 'active' : ''}" data-wallet-filter="loan">借还款</button><button class="pill ${filter === 'income' ? 'active' : ''}" data-wallet-filter="income">收入分析</button><button class="pill ${filter === 'expense' ? 'active' : ''}" data-wallet-filter="expense">支出分析</button></div>
    <div class="wallet-analytics-grid"><div class="panel trend-panel"><div class="panel-title"><div><h3>月度结余趋势</h3><small class="muted">收入与支出变化</small></div><span class="trend-legend"><i class="legend-income"></i>收入 <i class="legend-expense"></i>支出</span></div><div class="trend-chart">${series.map((item) => `<div class="trend-column"><div class="trend-bars"><i class="trend-income" style="height:${item.income / maxTrend * 100}%" title="收入 ${money(item.income)} K"></i><i class="trend-expense" style="height:${item.expense / maxTrend * 100}%" title="支出 ${money(item.expense)} K"></i></div><small>${item.month.slice(5)}月</small></div>`).join('')}</div></div><div class="panel analysis-panel"><div class="panel-title"><div><h3>${kind === '支出' ? '支出分类占比' : '收入分类占比'}</h3><small class="muted">${monthLabel(month)} · 缅币</small></div><div class="analysis-toggle"><button class="${kind === '支出' ? 'active' : ''}" data-wallet-filter="expense">支出</button><button class="${kind === '收入' ? 'active' : ''}" data-wallet-filter="income">收入</button></div></div><div class="donut-layout"><div class="wallet-donut" style="${donutStyle(breakdown)}"><span>${breakdown.length ? `${breakdown[0].percent.toFixed(1)}%` : '—'}</span></div><div class="category-bars">${categoryBars(breakdown)}</div></div></div></div>
    <div class="exchange-card"><div><b>货币兑换</b><small>美元 × 当前汇率 = 缅币；修改汇率会立即作为资产换算汇率</small></div><input id="exchange-usd" type="number" placeholder="美元"><span>×</span><input id="exchange-rate" type="number" value="${settings.manualRate || 3500}" aria-label="当前汇率"><span>=</span><output id="exchange-mmk">0 K</output><button class="button primary" data-action="exchange">记录兑换</button></div>
    <div class="panel wallet-table-panel"><div class="panel-title"><div><h3>流水明细</h3><small class="muted">${shownRows.length} 条记录 · 最新记录在上</small></div></div>${tableRows.length ? `<div class="wallet-table"><div class="table-head wallet-grid"><span>日期</span><span>姓名</span><span>分类</span><span>类型</span><span>缅币</span><span>美元</span><span>结余(K)</span><span>结余($)</span><span>备注</span><span>操作</span></div>${tableRows.map((x) => `<div class="table-row wallet-grid"><span>${safe(x.date)}</span><span>${safe(x.consumer || '—')}</span><span>${safe(x.category || x.reason || '其他')}</span><span>${badge(x.type)}</span><span class="amount ${['支出', '借出'].includes(x.type) ? 'negative' : 'positive'}">${['支出', '借出'].includes(x.type) ? '-' : '+'}${money(x.mmk)} K</span><span class="amount ${['支出', '借出', '兑换'].includes(x.type) ? 'negative' : 'positive'}">${['支出', '借出', '兑换'].includes(x.type) ? '-' : '+'}$${money(Math.abs(x.usd))}</span><span>${money(x.running.mmk)} K</span><span>$${money(x.running.usd)}</span><span class="note-cell" title="${safe(x.note)}">${safe(x.note || '—')}</span><span class="row-actions"><button class="link-button" data-edit="walletRecords" data-id="${x.id}">编辑</button><button class="link-button danger-text" data-delete-wallet="${x.id}">删除</button></span></div>`).join('')}</div>` : empty('这个月还没有钱包流水', button('添加第一笔', 'new-wallet', 'primary'))}</div></div>
    <div class="panel loan-panel"><div class="panel-title"><div><h3>未还借款</h3><small class="muted">借出记为负数，还入会抵消欠款；负数就是对方还欠你的金额</small></div><b>总未还 ${money(calcLoanBalances(loans).mmk)} K / $${money(calcLoanBalances(loans).usd)}</b></div>${loanPeople.length ? `<div class="loan-summary-grid">${loanPeople.map((name) => { const owed = calcLoanBalances(loans, name); return `<div class="loan-person"><strong>${safe(name)}</strong><span>${money(owed.mmk)} K<br>$${money(owed.usd)}</span></div>`; }).join('')}</div>` : '<p class="muted">暂无借还款记录。</p>'}</div>`;
}

export function walletRecordForm(x, categories, today) {
  const esc = safe; const id = x.id || ''; const options = (categories || []).map((c) => `<option value="${esc(c)}" ${c === (x.category || x.reason) ? 'selected' : ''}>${esc(c)}</option>`).join('');
  return `<div class="modal-backdrop"><form class="modal" data-record-form><div class="modal-head"><h2>${id ? '编辑钱包流水' : '添加钱包流水'}</h2><button class="more" type="button" data-close>×</button></div><label>日期*<input name="date" type="date" value="${esc(x.date || today)}" required></label><div class="form-grid"><label>姓名<input name="consumer" value="${esc(x.consumer)}"></label><label>分类<select name="category">${options}</select></label><label>类型<select name="type"><option ${x.type === '支出' || !x.type ? 'selected' : ''}>支出</option><option ${x.type === '收入' ? 'selected' : ''}>收入</option><option ${x.type === '借出' ? 'selected' : ''}>借出</option><option ${x.type === '还入' ? 'selected' : ''}>还入</option></select></label><label>缅币金额<input name="mmk" type="number" value="${Number(x.mmk || 0)}"></label><label>美元金额<input name="usd" type="number" step="0.01" value="${Number(x.usd || 0)}"></label><label>本笔汇率<input name="rate" type="number" value="${Number(x.rate || 3500)}"></label></div><label>备注<textarea name="note">${esc(x.note)}</textarea><input type="hidden" name="collection" value="walletRecords"><input type="hidden" name="recordId" value="${id}"><div class="form-actions"><button type="button" class="button ghost" data-close>取消</button><button class="button primary">保存流水</button></div></form></div>`;
}
