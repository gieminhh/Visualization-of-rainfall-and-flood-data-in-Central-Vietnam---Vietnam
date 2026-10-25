import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FlaskConical, Database, BookOpen,
  BarChart3, ChevronRight, Droplets, Activity, Circle, X
} from 'lucide-react';
import { cn } from '../../utils';
import { dataService } from '../../services/dataService';

const NAV_ITEMS = [
  { path: '/', label: 'Tổng quan nghiên cứu', icon: LayoutDashboard, end: true },
  { path: '/analysis', label: 'Không gian phân tích', icon: BarChart3, end: false },
  { path: '/ai-lab', label: 'AI Research Lab', icon: FlaskConical, end: false },
  { path: '/data-quality', label: 'Nguồn & chất lượng dữ liệu', icon: Database, end: false },
  { path: '/notebook', label: 'Sổ tay & báo cáo nghiên cứu', icon: BookOpen, end: false },
];

interface SidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ isOpenMobile, onCloseMobile }: SidebarProps) {
  const location = useLocation();
  const [sourceCounts, setSourceCounts] = useState('Đang đọc dữ liệu nguồn');
  const [sourceStatus, setSourceStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sourceLabel, setSourceLabel] = useState('Dữ liệu CSV');

  useEffect(() => {
    let active = true;
    dataService.getManifest().then(manifest => {
      if (active) {
        setSourceCounts(`${manifest.output_rows.daily_records.toLocaleString('vi-VN')} bản ghi · ${manifest.output_rows.stations} trạm`);
        setSourceStatus('ready');
        setSourceLabel(manifest.imported_at ? 'CSV đã nhập' : 'CSV của dự án');
      }
    }).catch(() => {
      if (active) {
        setSourceCounts('Chưa tải được dữ liệu nguồn');
        setSourceStatus('error');
      }
    });
    return () => { active = false; };
  }, []);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-2xs z-40 md:hidden animate-fadeIn"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-64 flex flex-col z-50 transition-transform duration-200 ease-in-out md:translate-x-0 bg-[#12304A] dark:bg-[#0b1b2b] border-r border-[#1e4060] dark:border-[#14283d] text-white',
          isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        )}
      >
        {/* Logo & Close button on mobile */}
        <div className="px-5 py-4 border-b border-[#1e4060] dark:border-[#14283d] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cyan-600 shadow-sm">
              <Droplets size={18} color="white" />
            </div>
            <div>
              <div className="font-bold text-sm text-white leading-tight">CENTRAL FLOOD</div>
              <div className="text-[11px] text-blue-200 font-medium">RESEARCH PLATFORM</div>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Đóng menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="px-3 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Modules
            </span>
          </div>
          <ul className="space-y-0.5 px-2">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = item.end
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);

              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.end}
                    onClick={onCloseMobile}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                      isActive
                        ? 'text-white bg-cyan-600 shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    )}
                  >
                    <Icon size={17} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'} />
                    <span className="flex-1 leading-snug">{item.label}</span>
                    {isActive && <ChevronRight size={14} className="opacity-80" />}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-[#1e4060] dark:border-[#14283d]">
          <div className="rounded-lg px-3 py-3 space-y-2 bg-[#0d2035] dark:bg-[#071321]">
            <div className="flex items-center gap-2">
              <Activity size={13} className="text-cyan-500" />
              <span className="text-xs font-medium text-blue-200">Đề tài nghiên cứu</span>
            </div>
            <div className="text-xs text-slate-400">Mưa lũ miền Trung</div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-[#1e3a5f] text-blue-300">
                {sourceLabel}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Circle
                size={6}
                fill={sourceStatus === 'ready' ? '#059669' : sourceStatus === 'error' ? '#DC2626' : '#94A3B8'}
                color={sourceStatus === 'ready' ? '#059669' : sourceStatus === 'error' ? '#DC2626' : '#94A3B8'}
              />
              <span className="text-xs text-slate-400 truncate">{sourceCounts}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
