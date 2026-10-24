import React from 'react';
import { cn } from '../../utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({ children, className, style, onClick, hoverable }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border',
        hoverable && 'cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5',
        onClick && 'cursor-pointer',
        className
      )}
      style={{ borderColor: '#E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color?: string;
  trend?: { value: number; label: string };
}

export function StatCard({ label, value, sub, icon, color = '#2563EB', trend }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#64748B' }}>
            {label}
          </div>
          <div className="text-2xl font-bold mt-1" style={{ color: '#1E293B' }}>
            {value}
          </div>
          {sub && <div className="text-xs mt-1.5" style={{ color: '#94A3B8' }}>{sub}</div>}
          {trend && (
            <div className={cn('text-xs font-medium mt-1.5 flex items-center gap-1',
              trend.value >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              <span>{trend.value >= 0 ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}% {trend.label}</span>
            </div>
          )}
        </div>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}15` }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
    </Card>
  );
}

interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}

export function SectionHeader({ title, description, actions, badge }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold" style={{ color: '#1E293B' }}>{title}</h2>
          {badge}
        </div>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function DemoBadge({ text = 'DỮ LIỆU MINH HỌA' }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' }}>
      ⚠ {text}
    </span>
  );
}

export function DemoBanner() {
  return (
    <div className="rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm mb-4"
      style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
      <span className="text-base">⚠️</span>
      <span>
        <strong>Chế độ minh họa:</strong> Biểu đồ sử dụng dữ liệu mô phỏng dựa trên cấu trúc CSV thực tế.
        Các giá trị chưa phản ánh phân tích chính xác từ dataset gốc.
      </span>
    </div>
  );
}

interface TabsProps {
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex border-b" style={{ borderColor: '#E2E8F0' }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === tab.id
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export function Select({ label, value, onChange, options, className }: SelectProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && <label className="text-xs font-medium" style={{ color: '#64748B' }}>{label}</label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-sm rounded-lg px-3 py-2 border outline-none transition-colors focus:ring-2 focus:ring-blue-200"
        style={{
          borderColor: '#E2E8F0',
          backgroundColor: '#FFFFFF',
          color: '#1E293B',
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}

export function Button({ children, onClick, variant = 'secondary', size = 'md', disabled, className, type = 'button' }: ButtonProps) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
  const variants = {
    primary: 'text-white hover:opacity-90',
    secondary: 'border hover:bg-slate-50',
    ghost: 'hover:bg-slate-100',
    danger: 'text-red-600 border border-red-200 hover:bg-red-50',
  };
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: { backgroundColor: '#2563EB' },
    secondary: { borderColor: '#E2E8F0', color: '#475569', backgroundColor: '#FFFFFF' },
    ghost: { color: '#64748B' },
    danger: {},
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(base, sizes[size], variants[variant], className)}
      style={variantStyles[variant]}
    >
      {children}
    </button>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'slate';
}

export function Badge({ children, color = 'blue' }: BadgeProps) {
  const colors = {
    blue: { backgroundColor: '#EFF6FF', color: '#2563EB' },
    green: { backgroundColor: '#F0FDF4', color: '#059669' },
    yellow: { backgroundColor: '#FFFBEB', color: '#D97706' },
    red: { backgroundColor: '#FEF2F2', color: '#DC2626' },
    slate: { backgroundColor: '#F1F5F9', color: '#64748B' },
  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={colors[color]}>
      {children}
    </span>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-4xl mb-3">{icon}</div>}
      <div className="font-semibold text-base" style={{ color: '#64748B' }}>{title}</div>
      {description && <div className="text-sm mt-1" style={{ color: '#94A3B8' }}>{description}</div>}
    </div>
  );
}
