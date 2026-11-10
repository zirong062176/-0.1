import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCompletedProjectsPage, renderCompletedTasksPage, renderReadingPage, renderReadingReviewPage, renderWorkPage, workCompletionForm, workTaskForm } from '../src/work-reading-ui.js';

const strategies = { A: '需要做', B: '应该做', C: '做了也不会错', D: '可以接受别人去做', E: '可以省略不做' };

test('阅读页显示按页进度、读完记录和读后感想入口', () => {
  const html = renderReadingPage({ items: [{ id: 'book-1', title: '书名', currentPage: 25, totalPages: 100, status: '在读' }], logs: [] });
  assert.match(html, /25 \/ 100 页/);
  assert.match(html, /读完记录/);
  assert.match(html, /读后感想/);
});

test('读后感想页显示记录内容和具体日期时间', () => {
  const html = renderReadingReviewPage({ items: [{ id: 'book-1', title: '书名', currentPage: 25 }], logs: [{ id: 'log-1', readingItemId: 'book-1', chapter: '第一章', topicTitle: '成功需要努力', page: 25, notes: '需要持续行动。', recordedAt: '2026-11-08T18:10:00.000Z' }] });
  assert.match(html, /成功需要努力/);
  assert.match(html, /书名/);
  assert.match(html, /2026/);
  assert.match(html, /18:10|02:10/);
  assert.doesNotMatch(html, /按阅读项目统计|涉及阅读项目/);
  assert.match(html, /data-edit="readingLogs"/);
});

test('工作页显示进行任务、进度和逾期标记', () => {
  const html = renderWorkPage({ strategies, projects: [{ id: 'p1', title: '项目一', strategy: 'A' }], tasks: [{ id: 't1', title: '任务一', projectId: 'p1', projectName: '项目一', status: '进行中', expectedAt: '2020-01-01T10:00', progress: 30, projectProgress: 20, strategy: 'A' }, { id: 't2', title: '已完成任务', status: '已完成', progress: 100, strategy: 'A' }] });
  assert.match(html, /进行任务/);
  assert.match(html, /任务进度 30%/);
  assert.match(html, /项目进度 20%/);
  assert.match(html, /逾期/);
  assert.match(html, /进行任务 1 \/ 任务 2/);
  assert.match(html, /已完成任务 1/);
  assert.match(html, /已完成任务 1<\/a>/);
  assert.match(html, /data-delete-project="p1"/);
  assert.match(html, /strategy-progress-A/);
});

test('已完成任务页面独立显示，可编辑和撤回，不展示项目', () => {
  const html = renderCompletedTasksPage({ strategies, projects: [{ id: 'p1', title: '项目一' }], tasks: [{ id: 't1', title: '任务一', projectId: 'p1', status: '已完成', progress: 30, expectedAt: '2026-11-08T12:00', submitAt: '2026-11-08T09:00', completedAt: '2026-11-08T18:10:00.000Z', lateReasonType: '原因', lateReason: '临时有事' }] });
  assert.match(html, /任务一/);
  assert.match(html, /编辑/);
  assert.match(html, /撤回/);
  assert.doesNotMatch(html, /归属项目/);
  assert.match(html, /项目一项目进度/);
  assert.match(html, /任务进度 30%/);
  assert.match(html, /task-overdue/);
  assert.match(html, /提交时间/);
  assert.match(html, /原因：临时有事/);
});

test('完成任务表单包含逾期原因选择', () => {
  const html = workCompletionForm({ id: 't1', title: '任务一', progress: 20 });
  assert.match(html, /name="lateReasonType"/);
  assert.match(html, /原因/);
  assert.match(html, /拖延/);
  assert.match(html, /lateReason/);
});

test('编辑已完成任务可以修改完成时间和逾期原因', () => {
  const html = workTaskForm({ id: 't1', title: '任务一', status: '已完成', completedAt: '2026-11-10T16:50', lateReasonType: '拖延' }, [], strategies, '2026-11-10');
  assert.match(html, /name="completedAt"/);
  assert.match(html, /name="lateReasonType"/);
  assert.match(html, /value="拖延"/);
});

test('已完成项目页显示项目进度和已完成任务详情', () => {
  const html = renderCompletedProjectsPage({ projects: [{ id: 'p1', title: '项目一' }], tasks: [{ id: 't1', title: '任务一', projectId: 'p1', status: '已完成', progress: 100, completedAt: '2026-11-08T18:10:00.000Z' }] });
  assert.match(html, /项目一/);
  assert.match(html, /任务一/);
  assert.match(html, /完成时间/);
  assert.match(html, /复盘：未填写复盘内容/);
  assert.match(html, /100%/);
});
