import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../api.js';
const version = __APP_VERSION__;
import { useTheme } from '../ThemeContext.jsx';

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14A7 7 0 0012 5z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
    </svg>
  );
}

function KioskIllustration() {
  return (
    <div className="flex justify-center mb-10">
      <img
        src="/storeroom_icon.png"
        alt="Storeroom"
        className="w-56 h-auto opacity-90"
      />
    </div>
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef(null);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setUsername('');
    setPassword('');
    setError('');
    usernameRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const result = await loginUser(username.trim(), password);
      sessionStorage.setItem('kioskUser', JSON.stringify(result.user));
      sessionStorage.setItem('kioskIsAdmin', result.isAdmin ? 'true' : 'false');
      navigate('/kiosk');
    } catch (e) {
      setError(e.response?.data?.error || 'Login failed. Please try again.');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-100 dark:bg-[#2a2a2a] flex flex-col items-center justify-center p-6 transition-colors">

      {/* Theme toggle — top right */}
      <button
        onClick={toggleTheme}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#363636] transition-colors"
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>

      <div className="w-full max-w-sm">

        <KioskIllustration />

        {/* Heading */}
        <h1 className="text-center text-3xl font-lubalin font-bold text-slate-800 dark:text-white mb-8 leading-snug">
          Sign in to Storeroom Kiosk<span className="text-brand">.</span>
        </h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-7">

          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-slate-500 dark:text-slate-400 font-medium">Username</label>
            <input
              ref={usernameRef}
              type="text"
              autoComplete="off"
              style={{ caretColor: '#F5B700' }}
              className="bg-transparent border-b-2 border-slate-300 dark:border-slate-600 focus:border-brand text-slate-800 dark:text-white text-xl py-2 focus:outline-none transition-colors placeholder-slate-300 dark:placeholder-slate-700"
              placeholder="your.username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-slate-500 dark:text-slate-400 font-medium">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                style={{ caretColor: '#F5B700' }}
                className="bg-transparent border-b-2 border-slate-300 dark:border-slate-600 focus:border-brand text-slate-800 dark:text-white text-xl py-2 w-full focus:outline-none transition-colors placeholder-slate-300 dark:placeholder-slate-700 pr-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-500 dark:text-red-400 text-sm text-center -mt-2">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!username.trim() || !password || loading}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-40 text-slate-900 py-4 rounded-lg text-lg font-bold transition-colors mt-1"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

        </form>
      </div>

      {/* Footer */}
      <div className="mt-16 flex items-center gap-3 text-slate-400 dark:text-slate-600 text-xs">
        <span className="brand-badge">E2E</span>
        <span>Storeroom Kiosk v{version}</span>
      </div>
    </div>
  );
}
