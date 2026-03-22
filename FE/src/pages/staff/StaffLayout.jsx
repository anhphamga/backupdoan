import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslate } from '../../hooks/useTranslate';

const formatDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function StaffLayout({ children }) {
  const { t } = useTranslate();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notificationOpen, setNotificationOpen] = useState(false);
  const notificationRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setNotificationOpen(false);
      }
    };
    if (notificationOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [notificationOpen]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const sidebarMenu = [
    { to: '/staff', label: t('staff.dashboard'), icon: 'ðŸ“Š' },
    { to: '/staff/shifts', label: t('staff.shiftRegistration'), icon: '📅' },
    { to: '/staff/rent-orders', label: t('staff.rentOrders'), icon: 'ðŸ“‹' },
    { to: '/staff/rent-order', label: t('staff.createRentOrder'), icon: 'âž•' },
    { to: '/staff/sale-order', label: t('staff.createSaleOrder'), icon: 'ðŸ›’' },
    { to: '/staff/fitting', label: t('staff.fittingBookings'), icon: 'ðŸ‘—' },
    { to: '/staff/return', label: t('staff.returns'), icon: 'ðŸ“„' },
  ];

  const notifications = [
    { id: 1, text: 'KhÃ¡ch Ä‘áº·t lá»‹ch thá»­ má»›i - 14:00 ngÃ y 23/02', unread: true },
    { id: 2, text: 'ÄÆ¡n quÃ¡ háº¡n - #HD005 - KhÃ¡ch D', unread: true },
    { id: 3, text: 'ÄÆ¡n #001 - Tráº£ Ä‘á»“ trong 1 ngÃ y', unread: false },
  ];

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="flex w-56 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-5">
          <h1 className="text-xl font-bold text-indigo-600">{t('staff.brand')}</h1>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
          {sidebarMenu.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition ${isActive
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
              end={m.to === '/staff'}
            >
              <span className="text-xl">{m.icon}</span>
              {m.label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-2 border-t border-gray-200 p-4">
          <Link to="/profile" className="flex items-center gap-3 rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-50">
            <span className="text-lg">ðŸ‘¤</span> {t('staff.profile')}
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-red-600 hover:bg-red-50"
          >
            <span className="text-lg">ðŸšª</span> {t('common.logout')}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-8 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl">ðŸ‘¤</span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('staff.greeting')}, {user?.name || t('sidebar.staffRole')} <span className="font-normal text-gray-600">| {t('sidebar.staffRole').toUpperCase()}</span>
              </h2>
              <p className="text-xs text-gray-500">{formatDate(currentTime)}</p>
            </div>
          </div>
          <button
            ref={notificationRef}
            onClick={() => setNotificationOpen(!notificationOpen)}
            className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-gray-300 hover:bg-indigo-50"
          >
            ðŸ””
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                {unreadCount}
              </span>
            )}
            {notificationOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
                <div className="border-b border-gray-200 p-4 font-semibold">{t('staff.notifications')}</div>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`border-b border-gray-100 px-4 py-3 text-sm ${n.unread ? 'bg-indigo-50' : ''}`}
                  >
                    {n.text}
                  </div>
                ))}
              </div>
            )}
          </button>
        </header>

        <main className="flex-1 overflow-auto bg-gray-50 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

