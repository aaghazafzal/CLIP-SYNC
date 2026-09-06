'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { isValidCode } from '@/lib/utils';

interface JoinViewProps {
  onJoin: (code: string) => void;
  isConnecting: boolean;
  errorMsg: string;
}

export function JoinView({ onJoin, isConnecting, errorMsg }: JoinViewProps) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const CHARS = /^[A-Za-z2-9]$/;

  const handleInput = (i: number, value: string) => {
    const char = value.replace(/[^A-Za-z2-9]/g, '').slice(-1).toUpperCase();
    const next = [...digits];
    next[i] = char;
    setDigits(next);
    if (char && i < 3) {
      inputRefs[i + 1].current?.focus();
    }
    // Auto-submit if last digit filled
    if (char && i === 3) {
      const code = [...next].join('');
      if (isValidCode(code)) handleJoin(code);
    }
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs[i - 1].current?.focus();
    }
    if (e.key === 'Enter') {
      const code = digits.join('');
      if (isValidCode(code)) handleJoin(code);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const raw = e.clipboardData.getData('text').replace(/[^A-Za-z2-9]/g, '').toUpperCase().slice(0, 4);
    const next = ['', '', '', ''];
    raw.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputRefs[Math.min(raw.length, 3)].current?.focus();
    if (raw.length === 4 && isValidCode(raw)) {
      setTimeout(() => handleJoin(raw), 50);
    }
  };

  const handleJoin = (code?: string) => {
    const c = code || digits.join('');
    if (isValidCode(c)) onJoin(c);
  };

  const isReady = isValidCode(digits.join(''));

  return (
    <div className="fade-in w-full">
      <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
        Enter room code
      </p>

      {/* 4 digit inputs */}
      <div className="flex items-center gap-2 mb-4">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={inputRefs[i]}
            value={d}
            onChange={e => handleInput(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            maxLength={1}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="mono text-2xl md:text-3xl font-semibold text-center w-14 h-14 md:w-16 md:h-16 rounded-xl uppercase"
            style={{
              background: 'var(--code-bg)',
              border: `1.5px solid ${d ? 'var(--accent)' : 'var(--border)'}`,
              color: 'var(--text)',
              outline: 'none',
              caretColor: 'var(--accent)',
              boxShadow: d ? '0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent)' : 'none',
            }}
          />
        ))}
      </div>

      {/* Error */}
      {errorMsg && (
        <div
          className="flex items-start gap-2 text-sm px-3 py-2.5 rounded-xl mb-3"
          style={{ background: 'var(--error-bg)', color: 'var(--error)' }}
        >
          <svg className="flex-shrink-0 mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {errorMsg}
        </div>
      )}

      {/* Join button */}
      <button
        onClick={() => handleJoin()}
        disabled={!isReady || isConnecting}
        className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
        style={{
          background: isReady && !isConnecting ? 'var(--accent)' : 'var(--surface-2)',
          color: isReady && !isConnecting ? '#fff' : 'var(--text-faint)',
          border: '1px solid transparent',
          cursor: isReady && !isConnecting ? 'pointer' : 'not-allowed',
        }}
        onMouseEnter={e => {
          if (isReady && !isConnecting) {
            (e.currentTarget as HTMLElement).style.background = 'var(--accent-hover)';
          }
        }}
        onMouseLeave={e => {
          if (isReady && !isConnecting) {
            (e.currentTarget as HTMLElement).style.background = 'var(--accent)';
          }
        }}
      >
        {isConnecting ? (
          <>
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Connecting…
          </>
        ) : (
          <>
            Join Room
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}
