'use client';

import { useState, useRef, useCallback } from 'react';

interface SyncViewProps {
  text: string;
  onTextChange: (t: string) => void;
  code: string;
  isHost: boolean;
  onDisconnect: () => void;
}

export function SyncView({ text, onTextChange, code, isHost, onDisconnect }: SyncViewProps) {
  const [copied, setCopied] = useState(false);
  const [cleared, setCleared] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const copyToClipboard = useCallback(() => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  const clearText = useCallback(() => {
    onTextChange('');
    setCleared(true);
    setTimeout(() => setCleared(false), 1200);
    textareaRef.current?.focus();
  }, [onTextChange]);

  const charCount = text.length;
  const lineCount = text ? text.split('\n').length : 0;

  return (
    <div className="fade-in w-full flex flex-col gap-4">
      {/* Connected bar */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5 rounded-xl"
        style={{ background: 'var(--connected-bg)', border: '1px solid color-mix(in srgb, var(--connected) 20%, transparent)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: 'var(--connected)', animation: 'pulse-dot 2.5s ease-in-out infinite' }}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--connected)' }}>
            Connected
          </span>
          <span className="text-xs" style={{ color: 'var(--connected)', opacity: 0.7 }}>
            · Room {code}
          </span>
        </div>
        <button
          onClick={onDisconnect}
          className="text-xs font-medium cursor-pointer px-2 py-1 rounded-lg"
          style={{
            color: 'var(--text-muted)',
            background: 'transparent',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = 'var(--error)';
            (e.currentTarget as HTMLElement).style.background = 'var(--error-bg)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          Disconnect
        </button>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => onTextChange(e.target.value)}
          placeholder="Type or paste anything here — it syncs instantly to the other device…"
          rows={10}
          className="mono w-full resize-none rounded-xl text-sm leading-relaxed p-4"
          style={{
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            color: 'var(--text)',
            outline: 'none',
            minHeight: '220px',
          }}
          onFocus={e => {
            (e.target as HTMLElement).style.borderColor = 'var(--accent)';
            (e.target as HTMLElement).style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent)';
          }}
          onBlur={e => {
            (e.target as HTMLElement).style.borderColor = 'var(--border)';
            (e.target as HTMLElement).style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        {/* Char / line count */}
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
          {charCount > 0
            ? `${charCount.toLocaleString()} char${charCount !== 1 ? 's' : ''}${lineCount > 1 ? ` · ${lineCount} lines` : ''}`
            : 'Start typing or paste…'}
        </span>

        <div className="flex items-center gap-2">
          {/* Clear */}
          {text && (
            <button
              onClick={clearText}
              className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: cleared ? 'var(--connected)' : 'var(--text-muted)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--error)';
                (e.currentTarget as HTMLElement).style.background = 'var(--error-bg)';
                (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--error) 30%, transparent)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = cleared ? 'var(--connected)' : 'var(--text-muted)';
                (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
              }}
            >
              Clear
            </button>
          )}

          {/* Copy */}
          <button
            onClick={copyToClipboard}
            disabled={!text}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
            style={{
              background: text ? (copied ? 'var(--connected-bg)' : 'var(--accent)') : 'var(--surface-2)',
              border: '1px solid transparent',
              color: text ? (copied ? 'var(--connected)' : '#fff') : 'var(--text-faint)',
              cursor: text ? 'pointer' : 'not-allowed',
            }}
            onMouseEnter={e => {
              if (text && !copied) {
                (e.currentTarget as HTMLElement).style.background = 'var(--accent-hover)';
              }
            }}
            onMouseLeave={e => {
              if (text && !copied) {
                (e.currentTarget as HTMLElement).style.background = 'var(--accent)';
              }
            }}
          >
            {copied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Role hint */}
      <p className="text-xs text-center" style={{ color: 'var(--text-faint)' }}>
        {isHost ? 'You are the host · ' : 'You joined · '}
        Changes sync instantly to the other device
      </p>
    </div>
  );
}
