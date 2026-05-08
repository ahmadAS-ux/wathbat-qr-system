import { useState, FormEvent } from 'react';
import { useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { API_BASE } from '@/lib/api-base';

export default function ChangePassword() {
  const [, navigate] = useLocation();
  const { t, isRtl } = useLanguage();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError(t('change_password_mismatch'));
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        navigate('/login');
        return;
      }

      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      if (res.ok) {
        // Force full reload so /auth/me re-fetches with mustChangePassword=false
        window.location.href = '/';
      } else {
        const data = await res.json();
        setError(data.error || t('change_password_default_err'));
      }
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen flex items-center justify-center bg-[#F8F9FB] p-4"
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-[#1B2A4A]/5 border border-border/50 overflow-hidden">
        <div className="bg-[#1B2A4A] px-8 py-8 text-center">
          <h1 className={`text-white font-bold text-lg tracking-tight ${isRtl ? 'font-[Tajawal]' : ''}`}>
            {t('change_password_title')}
          </h1>
          <p className={`text-white/60 text-sm mt-1 ${isRtl ? 'font-[Tajawal]' : ''}`}>
            {isRtl ? 'يجب تغيير كلمة المرور قبل المتابعة' : 'You must change your password before continuing.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
          <div>
            <label className={`block text-sm font-semibold text-[#1B2A4A] mb-2 ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {t('change_password_new')}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-border rounded-xl py-2.5 px-4 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30"
              autoFocus
              minLength={6}
              required
            />
          </div>

          <div>
            <label className={`block text-sm font-semibold text-[#1B2A4A] mb-2 ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {t('change_password_confirm')}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-border rounded-xl py-2.5 px-4 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30"
              minLength={6}
              required
            />
          </div>

          {error && (
            <p className={`text-xs text-red-600 ${isRtl ? 'font-[Tajawal]' : ''}`}>{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full bg-[#1B2A4A] hover:bg-[#142240] disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
          >
            {submitting ? '...' : t('change_password_submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
