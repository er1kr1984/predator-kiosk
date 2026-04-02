import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../api.js';
import { version } from '../../package.json';

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

function KioskIllustration() {
  return (
    <div className="flex justify-center mb-10">
      <div className="relative">
        {/* Decorative side dots */}
        <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#3a3a3a]" />
        <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#3a3a3a]" />
        {/* Card */}
        <div className="bg-[#363636] rounded-2xl px-8 py-6 flex flex-col items-center gap-3">
          {/* Person icon */}
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="12" r="7" fill="#5a5a5a" />
            <path d="M4 30c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="#5a5a5a" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {/* Form lines */}
          <div className="flex flex-col gap-2 w-28">
            <div className="h-2 bg-[#5a5a5a] rounded-full" />
            <div className="h-2 bg-[#4a4a4a] rounded-full w-4/5" />
            <div className="h-2 bg-[#404040] rounded-full w-3/5 mt-1" />
          </div>
        </div>
      </div>
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
    <div className="min-h-screen bg-[#2a2a2a] flex flex-col items-center justify-center p-6">

      <div className="w-full max-w-sm">

        <KioskIllustration />

        {/* Heading */}
        <h1 className="text-center text-3xl font-bold text-white mb-8 leading-snug">
          Sign in to Storeroom Kiosk<span className="text-brand">.</span>
        </h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-7">

          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-slate-400 font-medium">Username</label>
            <input
              ref={usernameRef}
              type="text"
              autoComplete="off"
              style={{ caretColor: '#F5B700' }}
              className="bg-transparent border-b-2 border-slate-600 focus:border-brand text-white text-xl py-2 focus:outline-none transition-colors placeholder-slate-700"
              placeholder="your.username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-slate-400 font-medium">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                style={{ caretColor: '#F5B700' }}
                className="bg-transparent border-b-2 border-slate-600 focus:border-brand text-white text-xl py-2 w-full focus:outline-none transition-colors placeholder-slate-700 pr-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm text-center -mt-2">{error}</p>
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
      <div className="mt-16 flex items-center gap-3 text-slate-600 text-xs">
        <span className="brand-badge">E2E</span>
        <span>Storeroom Kiosk v{version}</span>
      </div>
    </div>
  );
}
