import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home, FlaskConical, BarChart3, Database, BookOpen, Menu, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const ROUTE_MAP: Record<string, { label: string; icon: React.ReactNode }> = {
  '/': { label: 'Tổng quan nghiên cứu', icon: <Home size={14} /> },
  '/analysis': { label: 'Không gian phân tích', icon: <BarChart3 size={14} /> },
  '/ai-lab': { label: 'AI Research Lab', icon: <FlaskConical size={14} /> },
  '/data-quality': { label: 'Nguồn & chất lượng dữ liệu', icon: <Database size={14} /> },
  '/notebook': { label: 'Sổ tay & báo cáo nghiên cứu', icon: <BookOpen size={14} /> },
};

interface HeaderProps {
  title?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  onToggleMobileMenu?: () => void;
}

export default function Header({ title, actions, badge, onToggleMobileMenu }: HeaderProps) {
  const location = useLocation();
  const current = ROUTE_MAP[location.pathname] || ROUTE_MAP['/'];
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 z-20 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="flex items-center justify-between h-full px-3 sm:px-6">
        {/* Left: Hamburger menu + breadcrumb + title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile hamburger menu */}
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Mở menu"
          >
            <Menu size={18} />
          </button>

          {/* Breadcrumb - ẩn một phần trên màn hình siêu nhỏ */}
          <nav className="hidden sm:flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
            <Link to="/" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              <Home size={13} />
            </Link>
            <ChevronRight size={12} />
            <div className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
              {current.icon}
              <span className="truncate max-w-[140px] sm:max-w-none">{current.label}</span>
            </div>
          </nav>

          {/* Mobile label fallback */}
          <div className="sm:hidden flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
            {current.icon}
            <span className="truncate">{title || current.label}</span>
          </div>

          {/* Divider & Desktop title */}
          {title && (
            <>
              <div className="hidden sm:block w-px h-4 bg-slate-200 dark:bg-slate-700" />
              <h1 className="hidden sm:block text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{title}</h1>
            </>
          )}

          {badge && <div className="ml-1 hidden sm:block">{badge}</div>}
        </div>

        {/* Right: Actions + Theme Toggle Button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {actions}
            </div>
          )}

          {/* Nút bật tắt chế độ Sáng / Tối */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shadow-2xs"
            title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
          >
            {theme === 'dark' ? (
              <Sun size={15} className="text-amber-400" />
            ) : (
              <Moon size={15} className="text-slate-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
