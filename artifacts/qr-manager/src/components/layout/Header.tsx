import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Globe, LayoutDashboard, ArrowLeft, ArrowRight, LogOut, Users } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import logo from '@assets/image_1774733777220.png';

export function Header() {
  const { language, setLanguage, t, isRtl } = useLanguage();
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const isAdmin = location.startsWith('/admin');

  const toggleLanguage = () => setLanguage(language === 'en' ? 'ar' : 'en');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/90 backdrop-blur-xl shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 py-3">

          {/* Logo */}
          <Link href="/">
            <motion.div
              className="flex items-center gap-3 cursor-pointer group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <img
                src={logo}
                alt="Wathbat Logo"
                className="h-10 w-auto object-contain"
              />
              <span className="text-xs font-medium text-[#C89B3C] tracking-wide hidden sm:block">{t('app_title')}</span>
            </motion.div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Back to main app — only shown on admin page */}
            {isAdmin && (
              <Link href="/">
                <button className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full transition-all border text-[#1B2A4A] border-[#1B2A4A]/20 hover:bg-[#1B2A4A]/5">
                  {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                  <span className="hidden sm:inline">{t('app_title')}</span>
                </button>
              </Link>
            )}

            {/* Admin link — only shown when NOT on admin page */}
            {!isAdmin && (
              <Link href="/admin">
                <button className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full transition-all border text-[#1B2A4A] border-[#1B2A4A]/15 hover:bg-[#1B2A4A]/5">
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('admin_nav')}</span>
                </button>
              </Link>
            )}

            {/* Users link — admin only */}
            {user?.role === 'Admin' && isAdmin && (
              <Link href="/admin/users">
                <button className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-full border text-[#1B2A4A] border-[#1B2A4A]/15 hover:bg-[#1B2A4A]/5 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('users_nav')}</span>
                </button>
              </Link>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              className="gap-2 border-[#1B2A4A]/10 hover:bg-[#1B2A4A]/5 text-[#1B2A4A] rounded-full px-5"
            >
              <Globe className="w-4 h-4 text-[#C89B3C]" />
              <span>{language === 'en' ? 'العربية' : 'English'}</span>
            </Button>

            {/* User info + logout */}
            {user && (
              <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <span className="text-xs font-medium text-muted-foreground hidden sm:block">{user.username}</span>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-[#1B2A4A]/15 text-[#1B2A4A] hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
