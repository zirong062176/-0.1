import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCompletedProjectsPage, renderReadingPage, renderReadingReviewPage, renderWorkPage } from '../src/work-reading-ui.js';

const strategies = { A: '需要做', B: '应该做', C: '做了也不会错', D: '可以接受别人去做', E: '可以省略不做' };

test('阅读页显示按页进度、读完记录和读后感想入口', () => {
  const html = renderReadingPage({ items: [{ id: 'book-1', title: '书名', currentPage: 25, totalPages: 100, status: '在读' }], logs: [] });
  assert.match(html, /25 \/ 100 页/);
  assert.match(html, /读完记录/);
  assert.match(html, /读后感想/);
});

test('读后感想页显示记录内容和具体日期时间', () => {
  const html = renderReadingReviewPage({ items: [{ id: 'book-1', title: '书名', currentPage: 25 }], logs: [{ readingItemId: 'book-1', chapter: '第一章', topicTitle: '成功需要努力', page: 25, notes: '需要持续行动。', recordedAt: '2026-11-08T18:10:00.000Z' }] });
  assert.match(html, /成功需要努力/);
  assert.match(html, /2026/);
  assert.match(html, /18:10|02:10/);
});

test('工作页显示进行任务、进度和逾期标记', () => {
  const html = renderWorkPage({ strategies, projects: [{ id: 'p1', title: '项目一' }], tasks: [{ id: 't1', title: '任务一', projectId: 'p1', projectName: '项目一', status: '进行中', expectedAt: '2020-01-01T10:00', progress: 30, strategy: 'A' }] });
  assert.match(html, /进行任务/);
  assert.match(html, /任务进度 30%/);
  assert.match(html, /逾期/);
});

test('已完成项目页显示项目进度和已完成任务详情', () => {
  const html = renderCompletedProjectsPage({ projects: [{ id: 'p1', title: '项目一' }], tasks: [{ id: 't1', title: '任务一', projectId: 'p1', status: '已完成', progress: 100, completedAt: '2026-11-08T18:10:00.000Z' }] });
  assert.match(html, /项目一/);
  assert.match(html, /任务一/);
  assert.match(html, /完成时间/);
  assert.match(html, /100%/);
});
