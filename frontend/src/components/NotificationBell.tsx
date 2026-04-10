import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';

export const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    notifications,
    unreadCount,
    startPolling,
    stopPolling,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  useEffect(() => {
    if (user) {
      startPolling(30000);
    }

    return () => {
      stopPolling();
    };
  }, [user, startPolling, stopPolling]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notification: any) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    setIsOpen(false);

    const caseId = notification.caseId || notification.case?.id || notification.data?.caseId;

    if (notification.type === 'alert') {
      if (user?.role === 'supervisor') {
        navigate(caseId ? `/supervisor/case/${caseId}` : '/supervisor');
      } else if (user?.role === 'investigating_officer') {
        navigate(caseId ? `/io/case/${caseId}` : '/io');
      } else {
        navigate('/admin/cases');
      }
      return;
    }

    if (notification.type === 'case_assignment') {
      if (user?.role === 'supervisor') {
        navigate(caseId ? `/supervisor/cases?reviewCase=${caseId}` : '/supervisor/cases');
      } else if (user?.role === 'investigating_officer') {
        navigate(caseId ? `/io/case/${caseId}` : '/io');
      } else {
        navigate('/admin/cases');
      }
      return;
    }

    if (notification.type === 'case_review' || notification.type === 'case_revision') {
      if (user?.role === 'admin') {
        navigate('/admin/cases');
      } else if (user?.role === 'supervisor') {
        navigate(caseId ? `/supervisor/cases?reviewCase=${caseId}` : '/supervisor/cases');
      } else {
        navigate(caseId ? `/io/case/${caseId}` : '/io');
      }
      return;
    }

    if (user?.role === 'admin') {
      navigate('/admin');
    } else if (user?.role === 'supervisor') {
      navigate('/supervisor');
    } else {
      navigate('/io');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="relative rounded-full p-2 text-gray-500 transition hover:bg-gray-100"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0 inline-flex min-w-[1.25rem] translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                <Bell className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                No notifications yet
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex cursor-pointer gap-3 p-4 transition hover:bg-gray-50 ${
                      !notification.isRead ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div
                      className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${
                        !notification.isRead ? 'bg-blue-600' : 'bg-transparent'
                      }`}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {notification.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(notification.created_at).toLocaleString()}
                        {notification.sender && ` | From ${notification.sender.fullName}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
