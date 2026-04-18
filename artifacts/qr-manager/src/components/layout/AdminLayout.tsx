import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import {
  LayoutDashboard, Archive, Wrench, Users, LogOut, Globe,
  Menu, QrCode, Briefcase, Truck, CreditCard,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logo from '@assets/image_1774733777220.png';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { language, setLanguage, t, isRtl } = useLanguage();
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);
  const isAdmin = user?.role === 'Admin';
  const isErpUser = user?.role !== 'Accountant';

  useEffect(() => {
    if (!isErpUser) return;
    fetch('/api/erp/leads/overdue-count')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => setOverdueCount(d.count ?? 0))
      .catch(() => {});
  }, [isErpUser]);

  const navItems = [
    { href: '/admin', label: t('admin_nav'), icon: LayoutDashboard, exact: true },
    { href: '/admin/history', label: t('archive_title'), icon: Archive, exact: false },
    { href: '/admin/requests', label: t('requests_title'), icon: Wrench, exact: false },
    ...(isAdmin ? [{ href: '/admin/users', label: t('users_nav'), icon: Users, exact: false }] : []),
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (href: string, exact: boolean) => {
    if (exact) return location === href;
    return location.startsWith(href);
  };

  function SidebarContent() {
    return (
      <div className="flex flex-col h-full select-none">
        {/* Brand */}
        <div className="px-4 py-5 border-b border-white/10">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer group">
              <img
                src={logo}
                alt="Wathbat"
                className="h-9 w-auto object-contain brightness-0 invert opacity-90 group-hover:opacity-100 transition-opacity"
              />
              <div>
                <p className="text-white font-bold text-sm leading-tight tracking-tight">Wathbat</p>
                <p className="text-white/40 text-xs mt-0.5">wathbat.sa</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {/* QR Asset Manager — pinned first, amber accent */}
          <Link href="/">
            <div
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold mb-2 cursor-pointer transition-all duration-150 border"
              style={{
                color: '#f59e0b',
                background: 'rgba(255,165,0,0.15)',
                borderColor: 'rgba(245,158,11,0.35)',
              }}
            >
              <QrCode className="w-[18px] h-[18px] shrink-0" style={{ color: '#f59e0b' }} />
              <span className="flex-1">{t('app_title')}</span>
            </div>
          </Link>

          <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest px-3 mb-2 pt-1">
            {isRtl ? 'القائمة' : 'Navigation'}
          </p>
          {navItems.map(item => {
            const active = isActive(item.href, item.exact);
            return (
              <Link key={item.href} href={item.href}>
                <div
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer group ${
                    active
                      ? 'bg-white/[0.12] text-white'
                      : 'text-white/55 hover:text-white/90 hover:bg-white/[0.07]'
                  }`}
                >
                  <item.icon
                    className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                      active ? 'text-[#C89B3C]' : 'text-white/40 group-hover:text-white/70'
                    }`}
                  />
                  <span className="flex-1">{item.label}</span>
                  {active && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#C89B3C] shrink-0 ms-auto" />
                  )}
                </div>
              </Link>
            );
          })}

          {/* ERP Section Divider */}
          {isErpUser && (
            <>
              <div className="border-t border-white/[0.08] my-2" />
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">
                {isRtl ? t('erp_section_label') : t('erp_section_label')}
              </p>

              {/* العملاء والمشاريع */}
              <Link href="/erp/leads">
                <div
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer group ${
                    isActive('/erp/leads', false) || isActive('/erp/projects', false)
                      ? 'bg-white/[0.12] text-white'
                      : 'text-white/55 hover:text-white/90 hover:bg-white/[0.07]'
                  }`}
                >
                  <Briefcase
                    className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                      isActive('/erp/leads', false) || isActive('/erp/projects', false)
                        ? 'text-[#C89B3C]'
                        : 'text-white/40 group-hover:text-white/70'
                    }`}
                  />
                  <span className="flex-1">{t('erp_leads_nav')}</span>
                  {overdueCount > 0 && (
                    <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 ms-auto shrink-0">
                      {overdueCount}
                    </span>
                  )}
                </div>
              </Link>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
          {/* Language toggle */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white/80 hover:bg-white/[0.07] transition-all group"
          >
            <Globe className="w-[18px] h-[18px] shrink-0 text-white/30 group-hover:text-white/60" />
            <span>{language === 'en' ? 'العربية' : 'English'}</span>
          </button>

          {/* Divider */}
          <div className="border-t border-white/[0.08] my-1" />

          {/* User row */}
          {user && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl">
              <div className="w-7 h-7 rounded-full bg-[#C89B3C]/20 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C] text-xs font-bold shrink-0">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="text-white/70 text-sm font-medium flex-1 truncate min-w-0">{user.username}</span>
              <button
                onClick={handleLogout}
                className="text-white/30 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-white/[0.07] shrink-0"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F0F2F5]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-[#1B2A4A] sticky top-0 h-screen overflow-y-auto shadow-xl">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: isRtl ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className={`fixed top-0 ${isRtl ? 'right-0' : 'left-0'} z-50 h-full w-60 bg-[#1B2A4A] shadow-2xl lg:hidden overflow-y-auto`}
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl text-[#1B2A4A] hover:bg-slate-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/">
            <img src={logo} alt="Wathbat" className="h-8 w-auto object-contain" />
          </Link>
          <div className="w-9" />
        </div>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
