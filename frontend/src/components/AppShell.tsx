import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { ChangePasswordModal } from './ChangePasswordModal';
import { AdminAuditModal } from './AdminAuditModal';

export const AppShell = () => {
  const [isAdminAuditOpen, setIsAdminAuditOpen] = useState(false);

  return (
    <div className="min-h-screen w-full flex flex-col transition-colors duration-300 relative">
      <ChangePasswordModal />
      <AdminAuditModal
        isOpen={isAdminAuditOpen}
        onClose={() => setIsAdminAuditOpen(false)}
      />

      {/* Floating macOS-Style Header */}
      <Navbar onOpenAdminAudit={() => setIsAdminAuditOpen(true)} />

      {/* Main Content Pane */}
      <main className="flex-1 w-full mx-auto px-4 sm:px-8 md:px-[2cm] pt-28 sm:pt-32 pb-16">
        <Outlet />
      </main>
    </div>
  );
};
