import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../api.js';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center p-6 transition-colors">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 sm:p-10 w-full max-w-md transition-colors">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-slate-800 dark:text-white">Store Room</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xl mt-2">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-600 dark:text-slate-300 font-semibold text-lg">Username</label>
            <input
              ref={usernameRef}
              type="text"
              autoComplete="off"
              className="border-2 border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded-xl px-5 py-4 text-2xl focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="Your Snipe-IT username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-slate-600 dark:text-slate-300 font-semibold text-lg">Password</label>
            <input
              type="password"
              autoComplete="new-password"
              className="border-2 border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded-xl px-5 py-4 text-2xl focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl px-5 py-3 text-red-600 dark:text-red-400 text-lg text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!username.trim() || !password || loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-5 rounded-2xl text-2xl font-bold transition-colors mt-2"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>

      <div className="mt-6">
        <ThemeToggle />
      </div>
    </div>
  );
}
