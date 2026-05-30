import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { ToastContainer } from '@/components/ui/toast';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { InstallBanner } from '@/components/ui/install-banner';
import { PwaWelcome } from '@/components/ui/pwa-welcome';
import { SwUpdatePrompt } from '@/components/ui/sw-update-prompt';

export function Layout() {
  return (
    <>
      <SwUpdatePrompt />
      <PwaWelcome />
      <OfflineBanner />
      <ToastContainer />
      <InstallBanner />
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
