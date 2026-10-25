import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  HelpCircle,
  ChevronDown,
  Cpu,
  RefreshCw,
  Check,
  Trash2,
  Clock,
  SquarePen,
  PanelLeftClose,
  PanelLeft,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  Download,
  Search,
  X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../utils';
import { Button } from '../ui';
import {
  askGemini,
  getStoredApiKey,
  getStoredModel,
  saveStoredModel,
  fetchAvailableModelsFromApi,
  POPULAR_MODELS
} from '../../services/geminiService';
import type { ChatMessage, ContextData, ModelOption } from '../../services/geminiService';

export interface ChatSession {
  id: string;
  title: string;
  station: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

interface AIAssistantTabProps {
  context: ContextData;
}

const ON_DEVICE_SESSIONS_STORAGE_KEY = 'cfr_ondevice_chat_sessions_v1';
const ON_DEVICE_ACTIVE_SESSION_KEY = 'cfr_ondevice_active_session_id_v1';
const LEGACY_STORAGE_KEY_PREFIX = 'cfr_ai_chat_history_v1';

const QUICK_QUESTIONS = [
  'Đặc điểm mùa mưa và các đợt mưa cực đoan của trạm này?',
  'Giải thích ý nghĩa chỉ số MAE, RMSE và R² ở đây?',
  'Nhận xét về kết quả dự báo trong các tháng tới?',
  'Tại sao không nên dự báo lượng mưa cho trạm Cam Ranh?',
];

function createDefaultSession(stationName: string, provinceName?: string): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: 'Khảo sát khí hậu trạm ' + stationName,
    station: stationName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: `Xin chào! Tôi là **Trợ lý AI Nghiên cứu Mưa lũ miền Trung**.\n\nTôi có thể giúp bạn giải thích kết quả mô hình dự báo, phân tích đặc điểm khí tượng trạm **${stationName}** (${provinceName ?? 'Miền Trung'}), đánh giá sai số (MAE, RMSE, $R^2$) hoặc đối chiếu các sự kiện mưa cực đoan lịch sử từ 48.187 bản ghi.\n\n🔒 **Lưu ý riêng tư:** Toàn bộ lịch sử trò chuyện này được lưu trữ hoàn toàn **on-device** trên máy tính của bạn, không lưu trên máy chủ hệ thống.`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ],
  };
}

export function AIAssistantTab({ context }: AIAssistantTabProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') return window.innerWidth < 768;
    return false;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') return window.innerWidth >= 768;
    return true;
  });
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Model selector states
  const [models, setModels] = useState<ModelOption[]>(POPULAR_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>(getStoredModel());
  const [scanningModels, setScanningModels] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // Responsive resize watcher
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // On-device Chat Sessions State
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const stored = localStorage.getItem(ON_DEVICE_SESSIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      
      const legacy = localStorage.getItem(`${LEGACY_STORAGE_KEY_PREFIX}_${context.station}`);
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          return [{
            id: crypto.randomUUID(),
            title: `Hội thoại trạm ${context.station}`,
            station: context.station,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: parsedLegacy,
          }];
        }
      }
    } catch {
      // ignore
    }
    return [createDefaultSession(context.station, context.stationInfo?.province_name)];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const activeStored = localStorage.getItem(ON_DEVICE_ACTIVE_SESSION_KEY);
      if (activeStored) return activeStored;
    } catch {
      // ignore
    }
    return sessions[0]?.id || '';
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [];

  useEffect(() => {
    try {
      localStorage.setItem(ON_DEVICE_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    } catch {
      // ignore
    }
  }, [sessions]);

  useEffect(() => {
    try {
      if (activeSessionId) {
        localStorage.setItem(ON_DEVICE_ACTIVE_SESSION_KEY, activeSessionId);
      }
    } catch {
      // ignore
    }
  }, [activeSessionId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setScanningModels(true);
    try {
      const key = getStoredApiKey();
      const list = await fetchAvailableModelsFromApi(key);
      setModels(list);
      if (!list.some(m => m.id === selectedModel) && list.length > 0) {
        handleSelectModel(list[0].id);
      }
    } finally {
      setScanningModels(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    saveStoredModel(modelId);
    setShowModelDropdown(false);
  };

  const handleNewChat = () => {
    const newSession = createDefaultSession(context.station, context.stationInfo?.province_name);
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    if (isMobile) setIsSidebarOpen(false);
  };

  const handleStartRename = (s: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(s.id);
    setEditingTitleText(s.title);
  };

  const handleSaveRename = () => {
    if (!editingSessionId) return;
    const finalTitle = editingTitleText.trim() || 'Hội thoại';
    setSessions(prev =>
      prev.map(s => (s.id === editingSessionId ? { ...s, title: finalTitle, updatedAt: Date.now() } : s))
    );
    setEditingSessionId(null);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      const fresh = createDefaultSession(context.station, context.stationInfo?.province_name);
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
      return;
    }

    const remaining = sessions.filter(s => s.id !== sessionId);
    setSessions(remaining);
    if (activeSessionId === sessionId) {
      setActiveSessionId(remaining[0].id);
    }
  };

  const handleClearAllSessions = () => {
    setShowMoreMenu(false);
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử trò chuyện on-device không? Thao tác này sẽ dọn dẹp sạch bộ nhớ trình duyệt.')) {
      const fresh = createDefaultSession(context.station, context.stationInfo?.province_name);
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
      localStorage.removeItem(ON_DEVICE_SESSIONS_STORAGE_KEY);
      localStorage.removeItem(ON_DEVICE_ACTIVE_SESSION_KEY);
    }
  };

  const handleExportSessions = () => {
    setShowMoreMenu(false);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sessions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `lich-su-hoi-thoai-on-device-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSend = async (questionText?: string) => {
    const textToSend = questionText || input;
    if (!textToSend.trim() || loading || !activeSession) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    let shouldUpdateTitle = false;
    let autoTitle = activeSession.title;
    if (
      activeSession.title.startsWith('Khảo sát') ||
      activeSession.title.startsWith('Hội thoại') ||
      activeSession.title === 'Cuộc trò chuyện mới' ||
      activeSession.messages.filter(m => m.role === 'user').length === 0
    ) {
      shouldUpdateTitle = true;
      const cleanQ = textToSend.trim().replace(/^[\W_]+/, '');
      autoTitle = cleanQ.length > 34 ? cleanQ.slice(0, 34) + '...' : cleanQ;
    }

    const updatedMessages = [...activeSession.messages, userMsg];

    setSessions(prev =>
      prev.map(s => {
        if (s.id === activeSession.id) {
          return {
            ...s,
            title: shouldUpdateTitle ? autoTitle : s.title,
            messages: updatedMessages,
            updatedAt: Date.now(),
          };
        }
        return s;
      })
    );

    if (!questionText) setInput('');
    setLoading(true);

    try {
      const reply = await askGemini(textToSend, updatedMessages, context, selectedModel);
      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };

      setSessions(prev =>
        prev.map(s => {
          if (s.id === activeSession.id) {
            return {
              ...s,
              messages: [...s.messages, botMsg],
              updatedAt: Date.now(),
            };
          }
          return s;
        })
      );
    } catch (e) {
      const errReply: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Lỗi khi xử lý câu hỏi: ${String(e)}`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setSessions(prev =>
        prev.map(s => {
          if (s.id === activeSession.id) {
            return {
              ...s,
              messages: [...s.messages, errReply],
              updatedAt: Date.now(),
            };
          }
          return s;
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const currentModelObj = models.find(m => m.id === selectedModel) || {
    id: selectedModel,
    name: selectedModel,
  };

  const filteredSessions = sessions.filter(s =>
    searchFilter ? s.title.toLowerCase().includes(searchFilter.toLowerCase()) : true
  );

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm flex h-[540px] sm:h-[620px] relative transition-colors">
      {/* Mobile Backdrop for sidebar drawer */}
      {isMobile && isSidebarOpen && (
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-2xs z-30 animate-fadeIn"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ============================================================== */}
      {/* THANH BÊN LỊCH SỬ ON-DEVICE (RESPONSIVE + SÁNG/TỐI)            */}
      {/* ============================================================== */}
      {isSidebarOpen && (
        <div
          className={cn(
            'bg-slate-50/95 dark:bg-[#0c0e14] text-slate-700 dark:text-slate-200 flex flex-col flex-shrink-0 border-r border-slate-200 dark:border-slate-800 transition-all duration-200 select-none',
            isMobile
              ? 'absolute inset-y-0 left-0 z-40 w-72 max-w-[85%] shadow-2xl animate-fadeIn'
              : 'w-64'
          )}
        >
          {/* Header của thanh bên */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-white/70 dark:bg-slate-900/60">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="flex items-center gap-1.5 font-semibold text-xs text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group"
              title="Tìm kiếm cuộc trò chuyện"
            >
              <span>Gần đây</span>
              <ChevronDown size={13} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform" />
            </button>

            <div className="flex items-center gap-0.5">
              {/* Menu tùy chọn ... */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="p-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  title="Tùy chọn lịch sử"
                >
                  <MoreHorizontal size={14} />
                </button>

                {showMoreMenu && (
                  <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-1 z-50 text-xs text-slate-700 dark:text-slate-200 animate-fadeIn">
                    <button
                      onClick={handleExportSessions}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200"
                    >
                      <Download size={13} />
                      <span>Xuất lịch sử (JSON)</span>
                    </button>
                    <button
                      onClick={handleClearAllSessions}
                      className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/50 flex items-center gap-2 text-red-600 dark:text-red-400 border-t border-slate-100 dark:border-slate-800"
                    >
                      <Trash2 size={13} />
                      <span>Xóa tất cả hội thoại</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Nút thu gọn Sidebar */}
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                title="Thu gọn lịch sử"
              >
                <PanelLeftClose size={14} />
              </button>

              {/* Nút Đoạn chat mới */}
              <button
                onClick={handleNewChat}
                className="p-1.5 rounded-md hover:bg-cyan-50 dark:hover:bg-cyan-950/50 text-slate-500 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-400 transition-colors"
                title="Cuộc trò chuyện mới"
              >
                <SquarePen size={14} />
              </button>
            </div>
          </div>

          {/* Ô tìm kiếm nhanh */}
          {showSearch && (
            <div className="px-2.5 pt-2 pb-1.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 bg-white dark:bg-slate-900">
              <Search size={12} className="text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Tìm cuộc hội thoại..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="w-full bg-transparent text-[11px] text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                autoFocus
              />
              {searchFilter && (
                <button onClick={() => setSearchFilter('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={11} />
                </button>
              )}
            </div>
          )}

          {/* Danh sách các phiên trò chuyện */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 text-xs custom-scrollbar">
            {filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-[11px]">
                Không có cuộc trò chuyện nào
              </div>
            ) : (
              filteredSessions.map(s => {
                const isActive = s.id === activeSession?.id;
                const isEditing = editingSessionId === s.id;

                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      if (!isEditing) {
                        setActiveSessionId(s.id);
                        if (isMobile) setIsSidebarOpen(false);
                      }
                    }}
                    className={`group relative flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                      isActive
                        ? 'bg-cyan-50/90 dark:bg-cyan-950/60 text-cyan-900 dark:text-cyan-200 font-medium border border-cyan-200/80 dark:border-cyan-800/80 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 w-full" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingTitleText}
                          onChange={e => setEditingTitleText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveRename();
                            if (e.key === 'Escape') setEditingSessionId(null);
                          }}
                          onBlur={handleSaveRename}
                          autoFocus
                          className="w-full bg-white dark:bg-slate-800 border border-cyan-500 rounded px-1.5 py-0.5 text-xs text-slate-800 dark:text-slate-100 outline-none shadow-xs"
                        />
                        <button
                          onClick={handleSaveRename}
                          className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="truncate flex-1 text-[12px] pr-2 leading-tight">
                          {s.title}
                        </span>

                        <div className="hidden group-hover:flex items-center gap-1 opacity-70 hover:opacity-100 flex-shrink-0">
                          <button
                            onClick={e => handleStartRename(s, e)}
                            className="p-1 hover:text-cyan-600 dark:hover:text-cyan-400 text-slate-400 transition-colors"
                            title="Đổi tên"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={e => handleDeleteSession(s.id, e)}
                            className="p-1 hover:text-red-600 dark:hover:text-red-400 text-slate-400 transition-colors"
                            title="Xóa"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Badge cam kết bảo mật On-Device */}
          <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-black/40 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div className="min-w-0 leading-tight">
              <div className="font-medium text-slate-700 dark:text-slate-200">Lưu on-device</div>
              <div className="truncate text-slate-400 dark:text-slate-500 text-[9px]">Chỉ lưu trên trình duyệt của bạn</div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VÙNG CHAT CHÍNH (RIGHT SIDE)                                   */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0b0f19]">
        {/* Header bar của vùng chat */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-wrap">
            {/* Nút mở sidebar nếu đang thu gọn */}
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 shadow-xs transition-all cursor-pointer"
                title="Mở lịch sử cuộc trò chuyện gần đây"
              >
                <PanelLeft size={14} className="text-cyan-600 dark:text-cyan-400" />
                <span className="font-medium text-xs">Lịch sử ({sessions.length})</span>
              </button>
            )}

            {/* Model Selector Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-cyan-500 shadow-xs font-semibold text-slate-800 dark:text-slate-100 transition-all cursor-pointer text-xs"
              >
                <Cpu size={13} className="text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
                <span className="max-w-[110px] sm:max-w-[140px] truncate">{currentModelObj.name}</span>
                {currentModelObj.badge && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 font-normal hidden sm:inline-block">
                    {currentModelObj.badge}
                  </span>
                )}
                <ChevronDown size={13} className="text-slate-400" />
              </button>

              {showModelDropdown && (
                <div className="absolute left-0 top-full mt-1.5 w-72 max-h-80 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-fadeIn">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
                    <span>Mô hình AI nghiên cứu</span>
                    {scanningModels && <RefreshCw size={11} className="animate-spin text-cyan-600" />}
                  </div>

                  {models.map(m => {
                    const isSelected = m.id === selectedModel;
                    return (
                      <button
                        key={m.id}
                        onClick={() => handleSelectModel(m.id)}
                        className={`w-full text-left px-3 py-2 text-xs flex items-start gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${
                          isSelected ? 'bg-cyan-50/70 dark:bg-cyan-950/60 text-cyan-900 dark:text-cyan-200 font-semibold' : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <div className="mt-0.5">
                          {isSelected ? <Check size={14} className="text-cyan-600 dark:text-cyan-400" /> : <div className="w-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{m.name}</span>
                            {m.badge && (
                              <span className="text-[9px] px-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-normal">
                                {m.badge}
                              </span>
                            )}
                          </div>
                          {m.description && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5 font-normal">
                              {m.description}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Trạm & Chỉ số nạp */}
            <div className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1.5 truncate">
              <span>Trạm:</span>
              <strong className="text-slate-800 dark:text-slate-100">{context.station}</strong>
              {context.result?.metrics?.mae !== null && context.result?.metrics?.mae !== undefined && (
                <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded text-[10px] font-medium hidden md:inline-block">
                  ✓ MAE: {context.result.metrics.mae.toFixed(1)}mm
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AI Online
            </span>
          </div>
        </div>

        {/* Danh sách tin nhắn */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 sm:gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-sm ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-cyan-600 text-white'
                }`}
              >
                {msg.role === 'user' ? 'Bạn' : <Bot size={15} />}
              </div>

              <div
                className={`max-w-[90%] sm:max-w-[85%] rounded-2xl p-3 sm:p-3.5 text-xs leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 rounded-tl-none'
                }`}
              >
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                ) : (
                  <div className="markdown-chat-body break-words prose prose-xs dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
                <div
                  className={`text-[10px] mt-2 flex items-center gap-1 justify-end ${
                    msg.role === 'user' ? 'text-blue-200' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <Clock size={10} />
                  <span>{msg.timestamp}</span>
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="w-7 h-7 rounded-full bg-cyan-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Bot size={15} />
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl rounded-tl-none p-3.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <RefreshCw size={13} className="animate-spin text-cyan-600 dark:text-cyan-400" />
                Đang đối chiếu dữ liệu trạm {context.station} và phân tích qua <strong>{currentModelObj.name}</strong>...
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Câu hỏi gợi ý nhanh */}
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800/70 bg-slate-50/70 dark:bg-slate-900/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-shrink-0">
            <HelpCircle size={12} /> Gợi ý:
          </span>
          {QUICK_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              disabled={loading}
              className="text-[11px] px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 hover:text-cyan-700 dark:hover:text-cyan-400 text-slate-600 dark:text-slate-300 whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Ô nhập tin nhắn */}
        <div className="p-2.5 sm:p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Hỏi ${currentModelObj.name} về lượng mưa, kiểm định sai số trạm ${context.station}...`}
            className="flex-1 text-xs px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-cyan-200 dark:focus:ring-cyan-900"
            disabled={loading}
          />
          <Button
            size="sm"
            variant="primary"
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="px-3.5 py-2.5"
          >
            <Send size={13} />
            <span className="hidden sm:inline">Gửi</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
