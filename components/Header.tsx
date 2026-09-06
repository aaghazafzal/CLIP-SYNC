'use client';

import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header
      className="w-full flex items-center justify-between px-5 py-4 md:px-8 md:py-5"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        {/* Icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="4" rx="1" />
            <path d="M4 6h16a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" />
            <line x1="9" y1="12" x2="15" y2="12" />
            <line x1="9" y1="16" x2="13" y2="16" />
          </svg>
        </div>
        <span
          className="text-[15px] font-700 tracking-tight select-none"
          style={{ color: 'var(--text)', fontWeight: 700 }}
        >
          ClipSync
        </span>
      </div>

      <ThemeToggle />
    </header>
  );
}
