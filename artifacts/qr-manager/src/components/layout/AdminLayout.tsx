import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import {
  LayoutDashboard, Archive, Wrench, Users, LogOut, Globe,
  Menu, Briefcase, CreditCard, List, Settings, Upload, ChevronDown,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/api-base';
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
  const [overduePaymentsCount, setOverduePaymentsCount] = useState(0);
  const [mfgCollapsed, setMfgCollapsed] = useState(() => localStorage.getItem('sidebar_mfg_collapsed') === 'true');
  const [qrCollapsed, setQrCollapsed] = useState(() => localStorage.getItem('sidebar_qr_collapsed') === 'true');

  const isAdmin = user?.role === 'Admin';
  const isErpUser = user?.role !== 'Accountant';
  const isPaymentsUser = user?.role === 'Admin' || user?.role === 'Accountant';

  useEffect(() => {
    if (!isErpUser) return;
    fetch(`${API_BASE}/api/erp/leads/overdue-count`)
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => setOverdueCount(d.count ?? 0))
      .catch(() => {});
  }, [isErpUser]);

  useEffect(() => {
    if (!isPaymentsUser) return;
    fetch(`${API_BASE}/api/erp/payments/overdue-count`)
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => setOverduePaymentsCount(d.count ?? 0))
      .catch(() => {});
  }, [isPaymentsUser]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (href: string, exact: boolean) => {
    if (exact) return location === href;
    return location.startsWith(href);
  };

  const handleNavClick = (href: string, exact: boolean) => {
    setMobileOpen(false);
    const active = exact ? location === href : location.startsWith(href);
    if (active) {
      window.location.href = href;
    }
  };

  const toggleMfg = () => {
    const next = !mfgCollapsed;
    setMfgCollapsed(next);
    localStorage.setItem('sidebar_mfg_collapsed', String(next));
  };

  const toggleQr = () => {
    const next = !qrCollapsed;
    setQrCollapsed(next);
    localStorage.setItem('sidebar_qr_collapsed', String(next));
  };

  const navItem = (active: boolean) =>
    `flex items-center gap-3 px-3 min-h-[44px] rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer group border-s-[3px] ${
      active
        ? 'bg-white/[0.12] text-white border-[#C89B3C]'
        : 'text-white/55 hover:text-white/90 hover:bg-white/[0.07] border-transparent'
    }`;

  const navIcon = (active: boolean) =>
    `w-5 h-5 shrink-0 transition-colors ${active ? 'text-[#C89B3C]' : 'text-white/40 group-hover:text-white/70'}`;

  const sectionBtn = 'w-full flex items-center gap-1 px-3 mt-4 mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/30 hover:text-white/50 transition-colors cursor-pointer';

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
        <nav className="flex-1 px-3 py-4 overflow-y-auto">

          {/* Dashboard — always first */}
          <Link href="/admin">
            <div onClick={() => handleNavClick('/admin', true)} className={navItem(isActive('/admin', true))}>
              <LayoutDashboard className={navIcon(isActive('/admin', true))} />
              <span className="flex-1">{t('admin_nav')}</span>
            </div>
          </Link>

          {/* ── MANUFACTURING SYSTEM ── */}
          {(isErpUser || isPaymentsUser) && (
            <>
              <button onClick={toggleMfg} className={sectionBtn}>
                <span className="flex-1 text-start">{t('erp_section_label')}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${mfgCollapsed ? '-rotate-90' : ''}`} />
              </button>
              {!mfgCollapsed && (
                <div className="space-y-0.5">
                  {isErpUser && (
                    <Link href="/erp/leads">
                      <div
                        onClick={() => handleNavClick('/erp/leads', false)}
                        className={navItem(isActive('/erp/leads', false) || isActive('/erp/projects', false))}
                      >
                        <Briefcase className={navIcon(isActive('/erp/leads', false) || isActive('/erp/projects', false))} />
                        <span className="flex-1">{t('erp_leads_nav')}</span>
                        {overdueCount > 0 && (
                          <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 ms-auto shrink-0">
                            {overdueCount}
                          </span>
                        )}
                      </div>
                    </Link>
                  )}
                  {isPaymentsUser && (
                    <Link href="/erp/payments">
                      <div
                        onClick={() => handleNavClick('/erp/payments', false)}
                        className={navItem(isActive('/erp/payments', false))}
                      >
                        <CreditCard className={navIcon(isActive('/erp/payments', false))} />
                        <span className="flex-1">{t('erp_payments_nav')}</span>
                        {overduePaymentsCount > 0 && (
                          <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 ms-auto shrink-0">
                            {overduePaymentsCount}
                          </span>
                        )}
                      </div>
                    </Link>
                  )}
                  {isAdmin && (
                    <Link href="/erp/settings">
                      <div
                        onClick={() => handleNavClick('/erp/settings', false)}
                        className={navItem(isActive('/erp/settings', false))}
                      >
                        <Settings className={navIcon(isActive('/erp/settings', false))} />
                        <span className="flex-1">{t('erp_settings_nav')}</span>
                      </div>
                    </Link>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── QR SYSTEM ── */}
          <>
            <button onClick={toggleQr} className={sectionBtn}>
              <span className="flex-1 text-start">{t('qr_section_label')}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${qrCollapsed ? '-rotate-90' : ''}`} />
            </button>
            {!qrCollapsed && (
              <div className="space-y-0.5">
                {isAdmin && (
                  <Link href="/qr/upload">
                    <div onClick={() => handleNavClick('/qr/upload', true)} className={navItem(isActive('/qr/upload', true))}>
                      <Upload className={navIcon(isActive('/qr/upload', true))} />
                      <span className="flex-1">{t('qr_upload_nav')}</span>
                    </div>
                  </Link>
                )}
                <Link href="/admin/history">
                  <div onClick={() => handleNavClick('/admin/history', false)} className={navItem(isActive('/admin/history', false))}>
                    <Archive className={navIcon(isActive('/admin/history', false))} />
                    <span className="flex-1">{t('archive_title')}</span>
                  </div>
                </Link>
                <Link href="/admin/requests">
                  <div onClick={() => handleNavClick('/admin/requests', false)} className={navItem(isActive('/admin/requests', false))}>
                    <Wrench className={navIcon(isActive('/admin/requests', false))} />
                    <span className="flex-1">{t('requests_title')}</span>
                  </div>
                </Link>
                {isAdmin && (
                  <Link href="/admin/users">
                    <div onClick={() => handleNavClick('/admin/users', false)} className={navItem(isActive('/admin/users', false))}>
                      <Users className={navIcon(isActive('/admin/users', false))} />
                      <span className="flex-1">{t('users_nav')}</span>
                    </div>
                  </Link>
                )}
                {isAdmin && (
                  <Link href="/admin/dropdowns">
                    <div onClick={() => handleNavClick('/admin/dropdowns', false)} className={navItem(isActive('/admin/dropdowns', false))}>
                      <List className={navIcon(isActive('/admin/dropdowns', false))} />
                      <span className="flex-1">{t('dropdown_editor_title')}</span>
                    </div>
                  </Link>
                )}
              </div>
            )}
          </>
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="w-full flex items-center gap-3 px-3 min-h-[44px] rounded-xl text-sm font-medium text-white/40 hover:text-white/80 hover:bg-white/[0.07] transition-all group"
          >
            <Globe className="w-5 h-5 shrink-0 text-white/30 group-hover:text-white/60" />
            <span>{language === 'en' ? 'العربية' : 'English'}</span>
          </button>

          <div className="border-t border-white/[0.08] my-1" />

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
      <aside className="hidden lg:flex flex-col min-w-[220px] w-56 shrink-0 bg-[#1B2A4A] sticky top-0 h-screen overflow-y-auto shadow-xl">
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
              className={`fixed top-0 ${isRtl ? 'end-0' : 'start-0'} z-50 h-full w-60 bg-[#1B2A4A] shadow-2xl lg:hidden overflow-y-auto`}
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

        {/* Version footer */}
        <footer className="mt-auto border-t border-border px-6 py-4">
          <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <div>Wathbat Aluminum · <span dir="ltr" className="ltr">wathbat.sa</span></div>
            <div dir="ltr" className="ltr">
              v{__APP_VERSION__} · Build {__APP_COMMIT__} · {__APP_BUILD_DATE__}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
