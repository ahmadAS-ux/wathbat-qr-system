import { useState, FormEvent } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Loader2, Lock, User, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import logo from '@assets/image_1774733777220.png';

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const { t, language, setLanguage, isRtl } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (result.ok) {
      navigate('/');
    } else {
      setError(result.error || t('login_error'));
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center px-4 relative overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Background decoration */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#4A6FA5]/[0.07] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-[#1B2A4A]/[0.04] rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Card */}
        <div className="bg-white rounded-3xl border border-border/50 shadow-xl shadow-[#1B2A4A]/5 overflow-hidden">
          {/* Header */}
          <div className="bg-[#1B2A4A] px-8 py-8 text-center">
            <img src={logo} alt="Wathbat" className="h-12 w-auto object-contain mx-auto mb-4 brightness-0 invert" />
            <h1 className="text-white font-bold text-lg tracking-tight">{t('login_title')}</h1>
            <p className="text-white/60 text-sm mt-1">{t('login_subtitle')}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-[#1B2A4A] mb-2">{t('login_username')}</label>
              <div className="relative">
                <User className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isRtl ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder={t('login_username')}
                  required
                  autoFocus
                  className={`w-full border border-border rounded-xl py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30 ${isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'}`}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-[#1B2A4A] mb-2">{t('login_password')}</label>
              <div className="relative">
                <Lock className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isRtl ? 'right-3' : 'left-3'}`} />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={`w-full border border-border rounded-xl py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30 ${isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'}`}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1B2A4A] hover:bg-[#142240] disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('login_btn')}
            </button>

            {/* Language toggle */}
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="w-full text-center text-sm text-muted-foreground hover:text-[#1B2A4A] transition-colors"
            >
              {language === 'en' ? 'العربية' : 'English'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
