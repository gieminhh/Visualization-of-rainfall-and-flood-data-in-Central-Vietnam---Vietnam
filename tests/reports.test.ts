import test from 'node:test';
import assert from 'node:assert/strict';
import { reportHtml, reportMarkdown } from '../src/services/reports.ts';
import type { ResearchSession } from '../src/types/index.ts';

test('report keeps Vietnamese content and block order while escaping user HTML', () => {
  const session: ResearchSession = { id: 'test', title: '<script>alert(1)</script>', description: 'Nghiên cứu mưa lũ', created_at: '2026-10-25', updated_at: '2026-10-25', tags: ['<img onerror=alert(1)>'], blocks: [
    { id: '1', type: 'research_notes', title: 'Ghi chú thứ nhất', content: 'Mưa 0 mm\nKhông có dữ liệu: null', created_at: '', updated_at: '' },
    { id: '2', type: 'conclusion', title: 'Kết luận', content: '<iframe src="evil"></iframe>', created_at: '', updated_at: '' },
  ] };
  const html = reportHtml(session);
  assert.ok(html.includes('Nghiên cứu mưa lũ'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<iframe'));
  assert.ok(html.indexOf('Ghi chú thứ nhất') < html.indexOf('Kết luận'));
  assert.ok(reportMarkdown(session).includes('Mưa 0 mm\nKhông có dữ liệu: null'));
});
