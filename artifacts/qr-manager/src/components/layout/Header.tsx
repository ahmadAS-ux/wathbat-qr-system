import { useLanguage } from '@/hooks/use-language';
import { Button } from '@/components/ui/button';
import { Globe, FileBox } from 'lucide-react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';

export function Header() {
  const { language, setLanguage, t } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/80 backdrop-blur-xl shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo Area */}
          <Link href="/">
            <motion.div 
              className="flex items-center gap-3 cursor-pointer group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent"></div>
                <FileBox className="w-5 h-5 relative z-10" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl leading-tight text-primary tracking-tight">Wathbat</span>
                <span className="text-xs font-medium text-accent tracking-wide">{t('app_title')}</span>
              </div>
            </motion.div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={toggleLanguage}
              className="gap-2 border-primary/10 hover:bg-primary/5 text-primary rounded-full px-5"
            >
              <Globe className="w-4 h-4 text-accent" />
              <span>{language === 'en' ? 'العربية' : 'English'}</span>
            </Button>
          </div>

        </div>
      </div>
    </header>
  );
}
