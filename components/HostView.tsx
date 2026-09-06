'use client';

import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { buildJoinUrl } from '@/lib/utils';
import { SyncStatus } from '@/hooks/usePeerSync';

interface HostViewProps {
  code: string;
  status: SyncStatus;
  onInitHost: () => void;
}

export function HostView({ code, status, onInitHost }: HostViewProps) {
  const [joinUrl, setJoinUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (code) setJoinUrl(buildJoinUrl(code));
  }, [code]);

  const copyCode = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    });
  };

  const codeDigits = code.split('');

  return (
    <div className="fade-in w-full">
      {/* Status badge */}
      <div className="flex items-center gap-2 mb-6">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
          style={
            status === 'waiting'
              ? { background: 'var(--connected-bg)', color: 'var(--connected)' }
              : { background: 'var(--surface-2)', color: 'var(--text-muted)' }
          }
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: status === 'waiting' ? 'var(--connected)' : 'var(--text-faint)',
              ...(status === 'waiting' ? { animation: 'pulse-dot 2s ease-in-out infinite' } : {}),
            }}
          />
          {status === 'initializing' ? 'Starting up…' : 'Waiting for device'}
        </span>
      </div>

      {/* 4-digit code */}
      <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
        Share this code
      </p>
      <div className="flex items-center gap-2 mb-5">
        {codeDigits.map((ch, i) => (
          <div
            key={i}
            className="mono text-3xl md:text-4xl font-semibold w-14 h-14 md:w-16 md:h-16 flex items-center justify-center rounded-xl select-all"
            style={{
              background: 'var(--code-bg)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              letterSpacing: '0.05em',
            }}
          >
            {ch}
          </div>
        ))}
        {/* Copy code button */}
        <button
          onClick={copyCode}
          className="ml-1 w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer flex-shrink-0"
          style={{
            background: copied ? 'var(--connected-bg)' : 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: copied ? 'var(--connected)' : 'var(--text-muted)',
          }}
          title="Copy code"
          onMouseEnter={e => {
            if (!copied) {
              (e.currentTarget as HTMLElement).style.color = 'var(--text)';
            }
          }}
          onMouseLeave={e => {
            if (!copied) {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            }
          }}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>or scan QR</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>

      {/* QR code */}
      {joinUrl && (
        <div className="flex justify-center mb-5">
          <div
            className="p-3 rounded-2xl"
            style={{ background: '#FFFFFF', border: '1px solid var(--border)' }}
          >
            <QRCodeCanvas
              value={joinUrl}
              size={152}
              bgColor="#FFFFFF"
              fgColor="#1C1916"
              level="M"
              style={{ display: 'block' }}
            />
          </div>
        </div>
      )}

      {/* Copy link */}
      {joinUrl && (
        <button
          onClick={copyUrl}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium cursor-pointer"
          style={{
            background: copiedUrl ? 'var(--connected-bg)' : 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: copiedUrl ? 'var(--connected)' : 'var(--text-muted)',
          }}
          onMouseEnter={e => {
            if (!copiedUrl) {
              (e.currentTarget as HTMLElement).style.color = 'var(--text)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)';
            }
          }}
          onMouseLeave={e => {
            if (!copiedUrl) {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
            }
          }}
        >
          {copiedUrl ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Link copied!
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Copy join link
            </>
          )}
        </button>
      )}
    </div>
  );
}
