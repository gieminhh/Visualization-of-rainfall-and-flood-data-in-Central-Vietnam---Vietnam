import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-800 dark:text-slate-100 transition-colors">
      <Sidebar
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />
      <Header onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)} />
      <main className="pt-14 min-h-screen ml-0 md:ml-64 transition-[margin]">
        <div className="p-3 sm:p-5 lg:p-6 page-transition max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
