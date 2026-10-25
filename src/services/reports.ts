import type { ResearchSession } from '../types/index.ts';

export function downloadText(filename: string, text: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function reportHtml(session: ResearchSession) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escape(session.title)}</title>
<style>@page{size:A4;margin:20mm}body{font:14px/1.6 Arial,sans-serif;color:#12304a;max-width:800px;margin:32px auto;padding:0 20px}h1{font-size:26px}h2{font-size:18px;border-bottom:1px solid #dbe4eb;padding-bottom:6px}p,pre{white-space:pre-wrap;overflow-wrap:anywhere}pre{font:inherit}small{color:#64748b}section{margin:24px 0}h2{break-after:avoid}img{max-width:100%}footer{margin-top:32px;border-top:1px solid #dbe4eb;font-size:11px}</style></head><body>
<small>CENTRAL FLOOD RESEARCH · BÁO CÁO NGHIÊN CỨU</small><h1>${escape(session.title)}</h1><p>${escape(session.description)}</p>
<small>Cập nhật: ${escape(session.updated_at)} · Nhãn: ${escape(session.tags.join(', '))}</small>
${session.blocks.map(block => `<section><h2>${escape(block.title)}</h2><pre>${escape(block.content)}</pre></section>`).join('')}
<footer>Báo cáo từ sổ tay nghiên cứu. Nội dung ghi chú do người dùng biên soạn; kết quả dự báo là ước lượng thống kê, không phải cảnh báo thời tiết.</footer></body></html>`;
}

export function reportMarkdown(session: ResearchSession) {
  return `# ${session.title}\n\n${session.description}\n\nCập nhật: ${session.updated_at}\n\n${session.blocks.map(block => `## ${block.title}\n\n${block.content}`).join('\n\n')}\n`;
}

export function printReport(session: ResearchSession) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;bottom:0';
  frame.title = 'Bản in báo cáo nghiên cứu';
  frame.onload = () => {
    const target = frame.contentWindow;
    if (!target) { frame.remove(); return; }
    target.addEventListener('afterprint', () => frame.remove(), { once: true });
    target.focus(); target.print();
  };
  frame.srcdoc = reportHtml(session);
  document.body.appendChild(frame);
}

export const NOTEBOOK_KEY = 'cfr_research_sessions';
export function saveResearchSession(session: ResearchSession) {
  const stored: unknown = JSON.parse(localStorage.getItem(NOTEBOOK_KEY) ?? '[]');
  if (!Array.isArray(stored)) throw new Error('Sổ tay đã lưu không đúng cấu trúc. Hãy kiểm tra trước khi thêm phiên mới.');
  localStorage.setItem(NOTEBOOK_KEY, JSON.stringify([session, ...stored]));
}
