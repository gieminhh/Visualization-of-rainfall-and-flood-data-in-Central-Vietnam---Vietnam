import React, { useState, useEffect } from 'react';
import {
  BookOpen, Plus, Trash2, ChevronDown, ChevronUp,
  Save, GripVertical, Edit3, CheckSquare, FlaskConical,
  BarChart2, FileText, MessageSquare, Lightbulb, FileOutput
} from 'lucide-react';
import { Card, SectionHeader, Button, Badge } from '../components/ui';
import type { NotebookBlock, BlockType, ResearchSession } from '../types';
import { generateId } from '../utils';

// ─── Block type config ────────────────────────────────────────────────────────
const BLOCK_TYPES: { type: BlockType; label: string; icon: React.ReactNode; placeholder: string; color: string }[] = [
  { type: 'research_question', label: 'Câu hỏi nghiên cứu', icon: <Lightbulb size={14} />, placeholder: 'Câu hỏi nghiên cứu cần trả lời...', color: '#7C3AED' },
  { type: 'dataset_methodology', label: 'Dữ liệu & Phương pháp', icon: <FlaskConical size={14} />, placeholder: 'Mô tả dữ liệu sử dụng và phương pháp phân tích...', color: '#0891B2' },
  { type: 'visualization', label: 'Trực quan hóa', icon: <BarChart2 size={14} />, placeholder: 'Mô tả biểu đồ và kết quả trực quan...', color: '#2563EB' },
  { type: 'statistical_results', label: 'Kết quả thống kê', icon: <CheckSquare size={14} />, placeholder: 'Kết quả phân tích thống kê (mean, median, trend...)...', color: '#059669' },
  { type: 'research_notes', label: 'Ghi chú nghiên cứu', icon: <MessageSquare size={14} />, placeholder: 'Ghi chú, nhận xét, quan sát trong quá trình nghiên cứu...', color: '#D97706' },
  { type: 'conclusion', label: 'Kết luận', icon: <FileText size={14} />, placeholder: 'Kết luận (chỉ ghi khi có cơ sở từ dữ liệu thực tế)...', color: '#12304A' },
];

// ─── Single Block ─────────────────────────────────────────────────────────────
function NotebookBlockEditor({ block, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: {
  block: NotebookBlock;
  onUpdate: (b: NotebookBlock) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const typeConfig = BLOCK_TYPES.find(t => t.type === block.type)!;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
      {/* Block header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b"
        style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}>
        <GripVertical size={14} style={{ color: '#CBD5E1' }} className="cursor-grab" />
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: typeConfig.color }} />
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: typeConfig.color }}>
          {typeConfig.icon} {typeConfig.label}
        </span>

        <input
          value={block.title}
          onChange={e => onUpdate({ ...block, title: e.target.value, updated_at: new Date().toISOString() })}
          placeholder="Tiêu đề block..."
          className="flex-1 text-sm font-medium bg-transparent outline-none ml-2"
          style={{ color: '#1E293B' }}
        />

        <div className="flex items-center gap-1 ml-auto">
          <button onClick={onMoveUp} disabled={isFirst} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30">
            <ChevronUp size={13} style={{ color: '#64748B' }} />
          </button>
          <button onClick={onMoveDown} disabled={isLast} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30">
            <ChevronDown size={13} style={{ color: '#64748B' }} />
          </button>
          <button onClick={() => setCollapsed(c => !c)} className="p-1 rounded hover:bg-slate-200">
            {collapsed ? <ChevronDown size={13} style={{ color: '#64748B' }} /> : <ChevronUp size={13} style={{ color: '#64748B' }} />}
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-100 ml-1">
            <Trash2 size={13} style={{ color: '#EF4444' }} />
          </button>
        </div>
      </div>

      {/* Block content */}
      {!collapsed && (
        <div className="p-4">
          {block.type === 'visualization' ? (
            <div>
              <textarea
                value={block.content}
                onChange={e => onUpdate({ ...block, content: e.target.value, updated_at: new Date().toISOString() })}
                placeholder={typeConfig.placeholder}
                className="w-full text-sm rounded-lg border p-3 outline-none resize-y"
                style={{ borderColor: '#E2E8F0', color: '#1E293B', minHeight: 80 }}
              />
              <div className="mt-2 rounded-lg p-3 text-xs"
                style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1' }}>
                📊 Chức năng "Thêm biểu đồ từ Không gian phân tích" sẽ khả dụng sau khi tích hợp API.
              </div>
            </div>
          ) : (
            <textarea
              value={block.content}
              onChange={e => onUpdate({ ...block, content: e.target.value, updated_at: new Date().toISOString() })}
              placeholder={typeConfig.placeholder}
              className="w-full text-sm rounded-lg border p-3 outline-none resize-y"
              style={{ borderColor: '#E2E8F0', color: '#1E293B', minHeight: block.type === 'conclusion' ? 100 : 80 }}
            />
          )}
          {block.type === 'conclusion' && (
            <div className="mt-2 text-xs" style={{ color: '#94A3B8' }}>
              ⚠️ Chỉ ghi kết luận khi có cơ sở từ phân tích dữ liệu thực tế. Không khái quát từ dữ liệu mô phỏng.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({ session, isActive, onOpen, onDelete }: {
  session: ResearchSession;
  isActive: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md"
      style={{
        borderColor: isActive ? '#2563EB' : '#E2E8F0',
        backgroundColor: isActive ? '#EFF6FF' : '#FFFFFF',
      }}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: '#1E293B' }}>{session.title}</div>
          <div className="text-xs mt-0.5 truncate" style={{ color: '#94A3B8' }}>{session.description}</div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs" style={{ color: '#94A3B8' }}>{session.blocks.length} block</span>
            {session.tags.map(t => (
              <span key={t} className="px-1.5 py-0.5 rounded text-xs"
                style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>{t}</span>
            ))}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded hover:bg-red-100 flex-shrink-0">
          <Trash2 size={12} style={{ color: '#EF4444' }} />
        </button>
      </div>
      <div className="text-xs mt-2" style={{ color: '#CBD5E1' }}>
        Cập nhật: {new Date(session.updated_at).toLocaleDateString('vi-VN')}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'cfr_research_sessions';

const createDefaultSession = (): ResearchSession => ({
  id: generateId(),
  title: 'Phiên nghiên cứu mới',
  description: 'Mô tả đề tài nghiên cứu...',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  blocks: [],
  tags: ['mưa lũ', 'miền Trung'],
});

export default function NotebookPage() {
  const [sessions, setSessions] = useState<ResearchSession[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    sessions.length > 0 ? sessions[0].id : null
  );
  const [saved, setSaved] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch { /* quota exceeded */ }
  }, [sessions]);

  const createSession = () => {
    const s = createDefaultSession();
    setSessions(prev => [s, ...prev]);
    setActiveSessionId(s.id);
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const updateActiveSession = (updated: ResearchSession) => {
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const addBlock = (type: BlockType) => {
    if (!activeSession) return;
    const newBlock: NotebookBlock = {
      id: generateId(),
      type,
      title: BLOCK_TYPES.find(t => t.type === type)?.label || '',
      content: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    updateActiveSession({
      ...activeSession,
      blocks: [...activeSession.blocks, newBlock],
      updated_at: new Date().toISOString(),
    });
    setAddingBlock(false);
  };

  const updateBlock = (blockId: string, updated: NotebookBlock) => {
    if (!activeSession) return;
    updateActiveSession({
      ...activeSession,
      blocks: activeSession.blocks.map(b => b.id === blockId ? updated : b),
      updated_at: new Date().toISOString(),
    });
  };

  const deleteBlock = (blockId: string) => {
    if (!activeSession) return;
    updateActiveSession({
      ...activeSession,
      blocks: activeSession.blocks.filter(b => b.id !== blockId),
      updated_at: new Date().toISOString(),
    });
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    if (!activeSession) return;
    const newBlocks = [...activeSession.blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    updateActiveSession({ ...activeSession, blocks: newBlocks });
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4 max-w-[1400px]">
      <div>
        <div className="flex items-center gap-2.5">
          <BookOpen size={22} style={{ color: '#0891B2' }} />
          <h1 className="text-xl font-bold" style={{ color: '#12304A' }}>Sổ tay & báo cáo nghiên cứu</h1>
        </div>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>
          Tạo và quản lý phiên nghiên cứu — lưu trữ bằng localStorage
        </p>
      </div>

      <div className="grid grid-cols-4 gap-5">
        {/* Sessions list */}
        <div className="col-span-1 space-y-3">
          <Button variant="primary" className="w-full justify-center" onClick={createSession}>
            <Plus size={14} /> Tạo phiên mới
          </Button>

          {sessions.length === 0 ? (
            <div className="text-center py-8 text-xs" style={{ color: '#94A3B8' }}>
              Chưa có phiên nghiên cứu.<br />Nhấn "Tạo phiên mới" để bắt đầu.
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <SessionCard
                  key={s.id}
                  session={s}
                  isActive={s.id === activeSessionId}
                  onOpen={() => setActiveSessionId(s.id)}
                  onDelete={() => deleteSession(s.id)}
                />
              ))}
            </div>
          )}

          <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <div className="font-semibold mb-1" style={{ color: '#475569' }}>Xuất báo cáo PDF</div>
            <div style={{ color: '#94A3B8' }}>Chưa hỗ trợ — sẽ khả dụng sau khi tích hợp backend</div>
            <div className="mt-1">
              <Badge color="slate">Chưa triển khai</Badge>
            </div>
          </div>
        </div>

        {/* Notebook editor */}
        <div className="col-span-3">
          {!activeSession ? (
            <Card className="flex flex-col items-center justify-center py-20">
              <BookOpen size={40} style={{ color: '#CBD5E1' }} className="mb-3" />
              <div className="font-semibold" style={{ color: '#94A3B8' }}>Chưa có phiên nghiên cứu</div>
              <div className="text-sm mt-1 mb-4" style={{ color: '#CBD5E1' }}>Tạo phiên mới để bắt đầu ghi chép</div>
              <Button variant="primary" onClick={createSession}>
                <Plus size={14} /> Tạo phiên đầu tiên
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Session header */}
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <input
                      value={activeSession.title}
                      onChange={e => updateActiveSession({ ...activeSession, title: e.target.value, updated_at: new Date().toISOString() })}
                      className="text-lg font-bold w-full bg-transparent outline-none border-b-2 border-transparent focus:border-blue-300 pb-0.5"
                      style={{ color: '#12304A' }}
                    />
                    <input
                      value={activeSession.description}
                      onChange={e => updateActiveSession({ ...activeSession, description: e.target.value, updated_at: new Date().toISOString() })}
                      className="text-sm w-full bg-transparent outline-none"
                      style={{ color: '#64748B' }}
                      placeholder="Mô tả đề tài..."
                    />
                    <div className="flex items-center gap-2 text-xs" style={{ color: '#94A3B8' }}>
                      <span>Tạo: {new Date(activeSession.created_at).toLocaleDateString('vi-VN')}</span>
                      <span>·</span>
                      <span>Cập nhật: {new Date(activeSession.updated_at).toLocaleTimeString('vi-VN')}</span>
                      <span>·</span>
                      <span>{activeSession.blocks.length} block</span>
                    </div>
                  </div>
                  <Button variant={saved ? 'primary' : 'secondary'} onClick={handleSave} size="sm">
                    <Save size={13} />
                    {saved ? 'Đã lưu!' : 'Lưu (localStorage)'}
                  </Button>
                </div>
              </Card>

              {/* Blocks */}
              <div className="space-y-3">
                {activeSession.blocks.map((block, idx) => (
                  <NotebookBlockEditor
                    key={block.id}
                    block={block}
                    onUpdate={updated => updateBlock(block.id, updated)}
                    onDelete={() => deleteBlock(block.id)}
                    onMoveUp={() => moveBlock(idx, 'up')}
                    onMoveDown={() => moveBlock(idx, 'down')}
                    isFirst={idx === 0}
                    isLast={idx === activeSession.blocks.length - 1}
                  />
                ))}
              </div>

              {/* Add block */}
              {addingBlock ? (
                <Card className="p-4">
                  <div className="text-sm font-semibold mb-3" style={{ color: '#1E293B' }}>Thêm block mới</div>
                  <div className="grid grid-cols-3 gap-2">
                    {BLOCK_TYPES.map(bt => (
                      <button
                        key={bt.type}
                        onClick={() => addBlock(bt.type)}
                        className="flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs font-medium transition-all hover:shadow-sm"
                        style={{
                          borderColor: '#E2E8F0',
                          color: bt.color,
                          backgroundColor: `${bt.color}08`,
                        }}
                      >
                        <span style={{ color: bt.color }}>{bt.icon}</span>
                        {bt.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setAddingBlock(false)} className="text-xs mt-3" style={{ color: '#94A3B8' }}>
                    Hủy
                  </button>
                </Card>
              ) : (
                <button
                  onClick={() => setAddingBlock(true)}
                  className="w-full py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-colors hover:border-blue-400 hover:text-blue-600"
                  style={{ borderColor: '#CBD5E1', color: '#94A3B8' }}
                >
                  <Plus size={16} className="inline mr-1.5" />
                  Thêm block mới
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
