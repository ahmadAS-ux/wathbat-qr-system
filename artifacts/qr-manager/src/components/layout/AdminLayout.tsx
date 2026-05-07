import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import {
  LayoutDashboard, Archive, FileText, Users, LogOut, Globe,
  Menu, X, FolderOpen, CreditCard, List, Settings, ChevronDown, Search, Package, UserCheck,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '@/lib/api-base';
import { canManageUsers, canViewVendors, canViewPayments, canViewLeads, canCreateProject, canViewQRSystem } from '@/lib/permissions';
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
  // F-04: all 4 sections now read their saved state from localStorage on init
  const [adminCollapsed, setAdminCollapsed] = useState(() => localStorage.getItem('sidebar_admin_collapsed') === 'true');
  const [mfgCollapsed, setMfgCollapsed] = useState(() => localStorage.getItem('sidebar_mfg_collapsed') === 'true');
  const [qrCollapsed, setQrCollapsed] = useState(() => localStorage.getItem('sidebar_qr_collapsed') === 'true');
  const [settingsCollapsed, setSettingsCollapsed] = useState(() => localStorage.getItem('sidebar_settings_collapsed') === 'true');

  // TODO Stage 2: canSearch has no 1:1 helper (negative check: role !== 'Accountant') — left as-is
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
      } catch (err) { console.error('sidebar search failed', err); }
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

  const isAdmin = canManageUsers(user?.role);
  // TODO Stage 2: isErpUser has no 1:1 helper (negative check: role !== 'Accountant') — left as-is
  const isErpUser = user?.role !== 'Accountant';
  // NOTE: isPaymentsUser here = Admin|Accountant = canViewPayments (correct).
  // isPaymentsUser in Admin.tsx = Admin|Accountant|FM (different) — known discrepancy, see USERS_AND_PERMISSIONS.md Known Gaps.
  const isPaymentsUser = canViewPayments(user?.role);
  const isVendorsUser = canViewVendors(user?.role);

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

  // F-07: removed full-page reload on active route — wouter navigate is a no-op on same route
  const handleNavClick = () => {
    setMobileOpen(false);
  };

  const toggleAdmin = () => {
    const next = !adminCollapsed;
    setAdminCollapsed(next);
    localStorage.setItem('sidebar_admin_collapsed', String(next));
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

  const toggleSettings = () => {
    const next = !settingsCollapsed;
    setSettingsCollapsed(next);
    localStorage.setItem('sidebar_settings_collapsed', String(next));
  };

  // F-08: brand accent (golden amber #c8962a) on active item via inline-start border
  const navItem = (active: boolean) =>
    `flex items-center gap-3 px-3 h-10 rounded-lg text-[13px] font-medium transition cursor-pointer group border-s-2 ${
      active
        ? 'bg-[#28303F] text-white border-[#c8962a]'
        : 'text-white/70 hover:text-white hover:bg-[#1E2532] border-transparent'
    }`;

  // F-05: navItemStyle was dead code (both branches returned {}) — removed

  const navIcon = (active: boolean) =>
    `w-5 h-5 shrink-0 transition-colors ${active ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`;

  const sectionBtn = 'w-full flex items-center gap-2 px-3 pt-2 pb-1 text-[10.5px] tracking-[.14em] text-white/40 font-bold hover:text-white/60 transition-colors cursor-pointer';

  // F-02: JSX variable instead of nested function component — prevents remount on every render
  const sidebarContent = (
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
            {/* F-09: explicit dir so Arabic input cursor behaves correctly */}
            <input
              type="text"
              dir={isRtl ? 'rtl' : 'ltr'}
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); if (e.target.value.trim().length >= 2) setSearchOpen(true); }}
              onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQ(''); } }}
              placeholder={t('sidebar_search_placeholder')}
              className="w-full bg-white/[0.07] border border-white/10 rounded-xl ps-8 pe-3 py-2 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:bg-white/[0.10] focus:border-white/20 transition-all"
            />
          </div>
          {searchOpen && (
            // F-10: dir context on dropdown — flex order and text align follow naturally
            <div dir={isRtl ? 'rtl' : 'ltr'} className="absolute start-3 end-3 top-full mt-1 bg-[#FAFAF7] rounded-xl shadow-2xl border border-[#ECEAE2] overflow-hidden z-50">
              {searchResults.length === 0 ? (
                <p className="px-4 py-3 text-xs text-[#6B6A60]">{t('search_no_results')}</p>
              ) : (
                <ul>
                  {searchResults.map(r => (
                    <li key={`${r.type}-${r.id}`}>
                      <button
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#F4F2EB] transition-colors text-start"
                        onClick={() => { navigate(r.url); setSearchOpen(false); setSearchQ(''); setMobileOpen(false); }}
                      >
                        <div className="w-6 h-6 rounded-md bg-[#ECEAE2] flex items-center justify-center shrink-0">
                          {r.type === 'lead' ? <Users className="w-3.5 h-3.5 text-[#6B6A60]" /> : <FolderOpen className="w-3.5 h-3.5 text-[#6B6A60]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#141A24] truncate">{r.name}</p>
                          <p className="text-[10px] text-[#6B6A60] truncate">{r.subtitle}</p>
                        </div>
                        <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${r.type === 'lead' ? 'bg-[#1a3a5c]/10 text-[#1a3a5c]' : 'bg-amber-50 text-amber-700'}`}>
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

        {/* ── ADMINISTRATION ── */}
        <>
          {/* F-13: aria-expanded | F-06: RTL-aware chevron rotation */}
          <button onClick={toggleAdmin} aria-expanded={!adminCollapsed} className={sectionBtn}>
            <span className="flex-1 text-start">{t('admin_section_label')}</span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${adminCollapsed ? (isRtl ? 'rotate-90' : '-rotate-90') : ''}`} />
          </button>
          {!adminCollapsed && (
            <div className="space-y-0.5">
              <Link href="/admin">
                <div onClick={handleNavClick} className={navItem(isActive('/admin', true))}>
                  <LayoutDashboard className={navIcon(isActive('/admin', true))} />
                  <span className="flex-1">{t('admin_nav')}</span>
                </div>
              </Link>
              {canCreateProject(user?.role) && (
                <Link href="/admin/requests">
                  <div onClick={handleNavClick} className={navItem(isActive('/admin/requests', false))}>
                    <FileText className={navIcon(isActive('/admin/requests', false))} />
                    <span className="flex-1">{t('requests_title')}</span>
                  </div>
                </Link>
              )}
            </div>
          )}
        </>

        {/* ── MANUFACTURING SYSTEM ── */}
        {(canViewLeads(user?.role) || isPaymentsUser) && (
          <>
            <button onClick={toggleMfg} aria-expanded={!mfgCollapsed} className={sectionBtn}>
              <span className="flex-1 text-start">{t('erp_section_label')}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${mfgCollapsed ? (isRtl ? 'rotate-90' : '-rotate-90') : ''}`} />
            </button>
            {!mfgCollapsed && (
              <div className="space-y-0.5">
                {canViewLeads(user?.role) && (
                  <Link href="/erp/customers">
                    <div onClick={handleNavClick} className={navItem(isActive('/erp/customers', false))}>
                      <UserCheck className={navIcon(isActive('/erp/customers', false))} />
                      <span className="flex-1">{t('erp_customers_nav')}</span>
                    </div>
                  </Link>
                )}
                {canViewLeads(user?.role) && (
                  <Link href="/erp/leads">
                    <div onClick={handleNavClick} className={navItem(isActive('/erp/leads', false))}>
                      <Users className={navIcon(isActive('/erp/leads', false))} />
                      <span className="flex-1">{t('erp_clients_nav')}</span>
                      {overdueCount > 0 && (
                        <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 ms-auto shrink-0">
                          {overdueCount}
                        </span>
                      )}
                    </div>
                  </Link>
                )}
                {canCreateProject(user?.role) && (
                  <Link href="/erp/projects">
                    <div onClick={handleNavClick} className={navItem(isActive('/erp/projects', false))}>
                      <FolderOpen className={navIcon(isActive('/erp/projects', false))} />
                      <span className="flex-1">{t('erp_projects_nav')}</span>
                    </div>
                  </Link>
                )}
                {isPaymentsUser && (
                  <Link href="/erp/payments">
                    <div onClick={handleNavClick} className={navItem(isActive('/erp/payments', false))}>
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
                    <div onClick={handleNavClick} className={navItem(isActive('/erp/vendors', false))}>
                      <Package className={navIcon(isActive('/erp/vendors', false))} />
                      <span className="flex-1">{t('erp_vendors_nav')}</span>
                    </div>
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        {/* ── DOCUMENT SYSTEM ── */}
        {isAdmin && (
          <>
            <button onClick={toggleQr} aria-expanded={!qrCollapsed} className={sectionBtn}>
              <span className="flex-1 text-start">{t('qr_section_label')}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${qrCollapsed ? (isRtl ? 'rotate-90' : '-rotate-90') : ''}`} />
            </button>
            {!qrCollapsed && (
              <div className="space-y-0.5">
                <Link href="/admin/history">
                  <div onClick={handleNavClick} className={navItem(isActive('/admin/history', false))}>
                    <Archive className={navIcon(isActive('/admin/history', false))} />
                    <span className="flex-1">{t('archive_title')}</span>
                  </div>
                </Link>
              </div>
            )}
          </>
        )}

        {/* ── SETTINGS ── */}
        {canViewQRSystem(user?.role) && (
          <>
            <button onClick={toggleSettings} aria-expanded={!settingsCollapsed} className={sectionBtn}>
              <span className="flex-1 text-start">{t('settings_section_label')}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${settingsCollapsed ? (isRtl ? 'rotate-90' : '-rotate-90') : ''}`} />
            </button>
            {!settingsCollapsed && (
              <div className="space-y-0.5">
                {isAdmin && (
                  <Link href="/erp/settings">
                    <div onClick={handleNavClick} className={navItem(isActive('/erp/settings', false))}>
                      <Settings className={navIcon(isActive('/erp/settings', false))} />
                      <span className="flex-1">{t('erp_settings_nav')}</span>
                    </div>
                  </Link>
                )}
                {/* F-14: Users and Dropdown Editor are admin-only pages — guard their links */}
                {isAdmin && (
                  <Link href="/admin/users">
                    <div onClick={handleNavClick} className={navItem(isActive('/admin/users', false))}>
                      <Users className={navIcon(isActive('/admin/users', false))} />
                      <span className="flex-1">{t('users_nav')}</span>
                    </div>
                  </Link>
                )}
                {isAdmin && (
                  <Link href="/admin/dropdowns">
                    <div onClick={handleNavClick} className={navItem(isActive('/admin/dropdowns', false))}>
                      <List className={navIcon(isActive('/admin/dropdowns', false))} />
                      <span className="flex-1">{t('dropdown_editor_title')}</span>
                    </div>
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </nav>

      {/* Footer — language toggle always visible (F-12), then user card */}
      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        {/* F-12: language toggle moved here so all roles (incl. Accountant) can switch */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className={navItem(false)}
          aria-label={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
        >
          <Globe className={navIcon(false)} />
          <span className="flex-1">{language === 'en' ? 'العربية' : 'English'}</span>
        </button>
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
              <div className="w-8 h-8 rounded-full bg-white/10 ring-1 ring-white/15 flex items-center justify-center text-white text-xs font-bold shrink-0">
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

  return (
    // F-03: explicit dir on layout root so all logical CSS properties work correctly
    <div className="flex min-h-screen bg-[#F4F2EB]" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[260px] shrink-0 bg-[#141A24] sticky top-0 h-screen shadow-xl [overflow-y:auto] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {sidebarContent}
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
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: isRtl ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className={`fixed top-0 ${isRtl ? 'end-0' : 'start-0'} z-50 h-full w-60 bg-[#141A24] shadow-2xl md:hidden [overflow-y:auto] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
            >
              <button
                onClick={() => setMobileOpen(false)}
                className={`absolute top-4 ${isRtl ? 'start-4' : 'end-4'} z-10 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors`}
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* F-11: grid layout centers logo without a spacer div */}
        <div className="md:hidden sticky top-0 z-30 bg-[#FAFAF7] border-b border-[#ECEAE2] px-4 py-3 grid grid-cols-3 items-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl text-[#1B2A4A] hover:bg-[#ECEAE2] transition-colors justify-self-start"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="justify-self-center">
            <img src={logo} alt="Wathbat" className="h-8 w-auto object-contain" />
          </Link>
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
