import { useTheme } from '../ThemeContext.jsx';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
        bg-slate-700 hover:bg-slate-600 text-slate-200
        dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200
        ${className}`}
    >
      {theme === 'dark' ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14A7 7 0 0012 5z" />
          </svg>
          Light
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
          </svg>
          Dark
        </>
      )}
    </button>
  );
}
