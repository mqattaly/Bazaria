import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar, SidebarMenu } from './Sidebar';
import { Modal } from '../ui/Modal';

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <a
        className="sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[120] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
        href="#main-content"
      >
        رفتن به محتوای اصلی
      </a>
      <div className="min-h-screen lg:flex">
        <Sidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((current) => !current)} />
        <div className="min-h-screen min-w-0 flex-1">
          <Header onOpenNavigation={() => setMobileNavigationOpen(true)} />
          <main className="mx-auto w-full max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8" id="main-content" tabIndex={-1}>
            <Outlet />
          </main>
          <footer className="mx-auto max-w-screen-2xl px-4 pb-6 text-xs text-muted sm:px-6 lg:px-8">
            بازاریا · سامانهٔ مدیریت فروشگاه
          </footer>
        </div>
      </div>

      <Modal
        description="دسترسی سریع به بخش‌های بازاریا"
        onOpenChange={setMobileNavigationOpen}
        open={mobileNavigationOpen}
        title="منوی اصلی"
        variant="drawer"
      >
        <SidebarMenu onNavigate={() => setMobileNavigationOpen(false)} />
      </Modal>
    </div>
  );
}
