import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F6F9FC' }}>
      <Sidebar />
      <Header />
      <main
        className="pt-14 min-h-screen"
        style={{ marginLeft: '256px' }}
      >
        <div className="p-6 page-transition">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
