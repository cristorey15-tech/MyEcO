import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { ToastContainer } from '@/components/ui/toast';
import { OfflineBanner } from '@/components/ui/offline-banner';

export function Layout() {
  return (
    <>
      <OfflineBanner />
      <ToastContainer />
      <Sidebar />
      <main className="layout-main pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </>
  );
}
