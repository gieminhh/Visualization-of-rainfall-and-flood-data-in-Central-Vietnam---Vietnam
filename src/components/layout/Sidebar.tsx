import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FlaskConical, Database, BookOpen,
  BarChart3, ChevronRight, Droplets, Activity, Circle
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

export default function Sidebar() {
  const location = useLocation();
  const [sourceCounts, setSourceCounts] = useState('Đang đọc dữ liệu nguồn');
  useEffect(() => {
    let active = true;
    dataService.getManifest().then(manifest => {
      if (active) setSourceCounts(`${manifest.output_rows.daily_records.toLocaleString('vi-VN')} bản ghi · ${manifest.output_rows.stations} trạm`);
    }).catch(() => { if (active) setSourceCounts('Chưa tải được dữ liệu nguồn'); });
    return () => { active = false; };
  }, []);

  return (
    <aside className="fixed left-0 top-0 h-full w-64 flex flex-col z-30"
      style={{ backgroundColor: '#12304A', borderRight: '1px solid #1e4060' }}>

      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: '#1e4060' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: '#0891B2' }}>
            <Droplets size={18} color="white" />
          </div>
          <div>
            <div className="font-bold text-sm text-white leading-tight">CENTRAL FLOOD</div>
            <div className="text-xs" style={{ color: '#93C5FD' }}>RESEARCH PLATFORM</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-3 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>
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
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                    isActive
                      ? 'text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  )}
                  style={isActive ? { backgroundColor: '#0891B2' } : {}}
                >
                  <Icon size={17} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span className="flex-1 leading-snug">{item.label}</span>
                  {isActive && <ChevronRight size={14} className="opacity-70" />}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t" style={{ borderColor: '#1e4060' }}>
        <div className="rounded-lg px-3 py-3 space-y-2" style={{ backgroundColor: '#0d2035' }}>
          <div className="flex items-center gap-2">
            <Activity size={13} style={{ color: '#0891B2' }} />
            <span className="text-xs font-medium" style={{ color: '#93C5FD' }}>Đề tài nghiên cứu</span>
          </div>
          <div className="text-xs" style={{ color: '#475569' }}>Mưa lũ miền Trung</div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#475569' }}>
            <span className="px-1.5 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: '#1e3a5f', color: '#60A5FA' }}>
              v0.1 DEMO
            </span>
            <span>Frontend giai đoạn 1</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Circle size={6} fill="#059669" color="#059669" />
            <span className="text-xs" style={{ color: '#6B7280' }}>{sourceCounts}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
