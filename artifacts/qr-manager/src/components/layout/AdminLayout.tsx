import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import {
  LayoutDashboard, Archive, FileText, Users, LogOut, Globe,
  Menu, FolderOpen, CreditCard, List, Settings, Upload, ChevronDown, Search, Package,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
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
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<{ type: string; id: number; name: string; subtitle: string; url: string }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [mfgCollapsed, setMfgCollapsed] = useState(() => localStorage.getItem('sidebar_mfg_collapsed') === 'true');
  const [qrCollapsed, setQrCollapsed] = useState(() => localStorage.getItem('sidebar_qr_collapsed') === 'true');

  const canSearch = user?.role !== 'Accountant';

  useEffect(() => {
    if (!canSearch || searchQ.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/erp/search?q=${encodeURIComponent(searchQ.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setSearchOpen(true);
        }
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ, canSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isAdmin = user?.role === 'Admin';
  const isErpUser = user?.role !== 'Accountant';
  const isPaymentsUser = user?.role === 'Admin' || user?.role === 'Accountant';
  const isVendorsUser = user?.role === 'Admin' || user?.role === 'FactoryManager' || user?.role === 'Employee';

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
        ? 'text-white border-[#B8860B]'
        : 'text-white/55 hover:text-white/90 hover:bg-white/[0.05] border-transparent'
    }`;

  const navItemStyle = (active: boolean): React.CSSProperties =>
    active ? { backgroundColor: 'rgba(184,134,11,0.10)' } : {};

  const navIcon = (active: boolean) =>
    `w-5 h-5 shrink-0 transition-colors ${active ? 'text-[#B8860B]' : 'text-white/40 group-hover:text-white/70'}`;

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

        {/* Search */}
        {canSearch && (
          <div ref={searchRef} className="px-3 pt-3 pb-2 relative">
            <div className="relative">
              <Search className="absolute inset-y-0 start-3 my-auto w-3.5 h-3.5 text-white/30 pointer-events-none" />
              <input
                type="text"
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); if (e.target.value.trim().length >= 2) setSearchOpen(true); }}
                onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQ(''); } }}
                placeholder={t('sidebar_search_placeholder')}
                className="w-full bg-white/[0.07] border border-white/10 rounded-xl ps-8 pe-3 py-2 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:bg-white/[0.10] focus:border-white/20 transition-all"
              />
            </div>
            {searchOpen && (
              <div className="absolute start-3 end-3 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50">
                {searchResults.length === 0 ? (
                  <p className={`px-4 py-3 text-xs text-slate-400 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{t('search_no_results')}</p>
                ) : (
                  <ul>
                    {searchResults.map(r => (
                      <li key={`${r.type}-${r.id}`}>
                        <button
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 transition-colors text-start ${isRtl ? 'flex-row-reverse' : ''}`}
                          onClick={() => { navigate(r.url); setSearchOpen(false); setSearchQ(''); setMobileOpen(false); }}
                        >
                          <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                            {r.type === 'lead' ? <Users className="w-3.5 h-3.5 text-slate-500" /> : <FolderOpen className="w-3.5 h-3.5 text-slate-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold text-slate-800 truncate ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{r.name}</p>
                            <p className={`text-[10px] text-slate-400 truncate ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{r.subtitle}</p>
                          </div>
                          <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${r.type === 'lead' ? 'bg-blue-50 text-blue-600' : 'bg-teal-50 text-teal-600'}`}>
                            {r.type === 'lead' ? t('search_type_lead') : t('search_type_project')}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">

          {/* Dashboard — always first */}
          <Link href="/admin">
            <div onClick={() => handleNavClick('/admin', true)} className={navItem(isActive('/admin', true))} style={navItemStyle(isActive('/admin', true))}>
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
                    <>
                      <Link href="/erp/leads">
                        <div
                          onClick={() => handleNavClick('/erp/leads', false)}
                          className={navItem(isActive('/erp/leads', false))}
                          style={navItemStyle(isActive('/erp/leads', false))}
                        >
                          <Users className={navIcon(isActive('/erp/leads', false))} />
                          <span className="flex-1">{t('erp_clients_nav')}</span>
                          {overdueCount > 0 && (
                            <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 ms-auto shrink-0">
                              {overdueCount}
                            </span>
                          )}
                        </div>
                      </Link>
                      <Link href="/erp/projects">
                        <div
                          onClick={() => handleNavClick('/erp/projects', false)}
                          className={navItem(isActive('/erp/projects', false))}
                          style={navItemStyle(isActive('/erp/projects', false))}
                        >
                          <FolderOpen className={navIcon(isActive('/erp/projects', false))} />
                          <span className="flex-1">{t('erp_projects_nav')}</span>
                        </div>
                      </Link>
                    </>
                  )}
                  {isPaymentsUser && (
                    <Link href="/erp/payments">
                      <div
                        onClick={() => handleNavClick('/erp/payments', false)}
                        className={navItem(isActive('/erp/payments', false))}
                        style={navItemStyle(isActive('/erp/payments', false))}
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
                  {isVendorsUser && (
                    <Link href="/erp/vendors">
                      <div
                        onClick={() => handleNavClick('/erp/vendors', false)}
                        className={navItem(isActive('/erp/vendors', false))}
                        style={navItemStyle(isActive('/erp/vendors', false))}
                      >
                        <Package className={navIcon(isActive('/erp/vendors', false))} />
                        <span className="flex-1">{t('erp_vendors_nav')}</span>
                      </div>
                    </Link>
                  )}
                  {isAdmin && (
                    <Link href="/erp/settings">
                      <div
                        onClick={() => handleNavClick('/erp/settings', false)}
                        className={navItem(isActive('/erp/settings', false))}
                        style={navItemStyle(isActive('/erp/settings', false))}
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
                    <div onClick={() => handleNavClick('/qr/upload', true)} className={navItem(isActive('/qr/upload', true))} style={navItemStyle(isActive('/qr/upload', true))}>
                      <Upload className={navIcon(isActive('/qr/upload', true))} />
                      <span className="flex-1">{t('qr_upload_nav')}</span>
                    </div>
                  </Link>
                )}
                <Link href="/admin/history">
                  <div onClick={() => handleNavClick('/admin/history', false)} className={navItem(isActive('/admin/history', false))} style={navItemStyle(isActive('/admin/history', false))}>
                    <Archive className={navIcon(isActive('/admin/history', false))} />
                    <span className="flex-1">{t('archive_title')}</span>
                  </div>
                </Link>
                <Link href="/admin/requests">
                  <div onClick={() => handleNavClick('/admin/requests', false)} className={navItem(isActive('/admin/requests', false))} style={navItemStyle(isActive('/admin/requests', false))}>
                    <FileText className={navIcon(isActive('/admin/requests', false))} />
                    <span className="flex-1">{t('requests_title')}</span>
                  </div>
                </Link>
                {isAdmin && (
                  <Link href="/admin/users">
                    <div onClick={() => handleNavClick('/admin/users', false)} className={navItem(isActive('/admin/users', false))} style={navItemStyle(isActive('/admin/users', false))}>
                      <Users className={navIcon(isActive('/admin/users', false))} />
                      <span className="flex-1">{t('users_nav')}</span>
                    </div>
                  </Link>
                )}
                {isAdmin && (
                  <Link href="/admin/dropdowns">
                    <div onClick={() => handleNavClick('/admin/dropdowns', false)} className={navItem(isActive('/admin/dropdowns', false))} style={navItemStyle(isActive('/admin/dropdowns', false))}>
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

          {user && (() => {
            const roleLabels: Record<string, string> = {
              Admin: t('role_admin'),
              FactoryManager: t('role_factory_manager'),
              Employee: t('role_employee'),
              SalesAgent: t('role_sales_agent'),
              Accountant: t('role_accountant'),
            };
            return (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-[#B8860B]/20 border border-[#B8860B]/30 flex items-center justify-center text-[#B8860B] text-xs font-bold shrink-0">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm font-medium truncate">{user.username}</p>
                  <p className="text-white/35 text-[10px] truncate">{roleLabels[user.role] ?? user.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-white/30 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-white/[0.07] shrink-0"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F0F2F5]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col min-w-[220px] w-56 shrink-0 bg-[#1B2A4A] sticky top-0 h-screen shadow-xl [overflow-y:auto] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
              className={`fixed top-0 ${isRtl ? 'end-0' : 'start-0'} z-50 h-full w-60 bg-[#1B2A4A] shadow-2xl lg:hidden [overflow-y:auto] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
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
