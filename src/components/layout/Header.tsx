import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home, FlaskConical, BarChart3, Database, BookOpen } from 'lucide-react';

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
}

export default function Header({ title, actions, badge }: HeaderProps) {
  const location = useLocation();
  const current = ROUTE_MAP[location.pathname] || ROUTE_MAP['/'];

  return (
    <header className="fixed top-0 right-0 z-20 h-14"
      style={{
        left: '256px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
      }}>
      <div className="flex items-center justify-between h-full px-6">
        {/* Left: breadcrumb + title */}
        <div className="flex items-center gap-3">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-xs" style={{ color: '#94A3B8' }}>
            <Link to="/" className="hover:text-slate-600 transition-colors">
              <Home size={13} />
            </Link>
            <ChevronRight size={12} />
            <div className="flex items-center gap-1.5 font-medium" style={{ color: '#64748B' }}>
              {current.icon}
              <span>{current.label}</span>
            </div>
          </nav>

          {/* Divider */}
          {title && (
            <>
              <div className="w-px h-4" style={{ backgroundColor: '#E2E8F0' }} />
              <h1 className="text-sm font-semibold" style={{ color: '#1E293B' }}>{title}</h1>
            </>
          )}

          {badge && <div className="ml-1">{badge}</div>}
        </div>

        {/* Right: actions */}
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
