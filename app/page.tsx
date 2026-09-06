'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { HostView } from '@/components/HostView';
import { JoinView } from '@/components/JoinView';
import { SyncView } from '@/components/SyncView';
import { usePeerSync } from '@/hooks/usePeerSync';
import { isValidCode } from '@/lib/utils';

type Mode = 'choose' | 'host' | 'join';

const FEATURES = [
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    text: 'Instant sync, under 100 ms',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    text: 'End-to-end P2P — nothing stored',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    ),
    text: 'No account, no install needed',
  },
];

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs cursor-pointer mb-5"
      style={{ color: 'var(--text-muted)', background: 'none', border: 'none', padding: 0 }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      Back
    </button>
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('choose');
  const [autoJoinCode, setAutoJoinCode] = useState<string | null>(null);
  const { feed, transfers, sendText, sendFile, status, errorMsg, myCode, initAsHost, joinRoom, disconnect, isHost, autoSync, setAutoSync } = usePeerSync();

  // Check URL for ?room=XXXX on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode && isValidCode(roomCode)) {
      setAutoJoinCode(roomCode.toUpperCase());
      setMode('join');
    }
  }, []);

  useEffect(() => {
    if (autoJoinCode) {
      joinRoom(autoJoinCode);
      setAutoJoinCode(null);
    }
  }, [autoJoinCode]);

  const handleStartHost = () => {
    setMode('host');
    initAsHost();
  };

  const handleJoin = (code: string) => {
    setMode('join');
    joinRoom(code);
  };

  const handleDisconnect = () => {
    disconnect();
    setMode('choose');
    window.history.replaceState({}, '', '/');
  };

  const isConnected = status === 'connected';

  // ── Connected view — full-width centered ──────────────────────────
  if (isConnected) {
    return (
      <div className="flex flex-col min-h-dvh" style={{ background: 'var(--bg)' }}>
        <Header />
        <main className="flex-1 flex items-start md:items-center justify-center px-4 py-8 md:py-12">
          <div className="w-full max-w-2xl">
            <div
              className="rounded-2xl p-5 md:p-6"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              }}
            >
              <SyncView
                feed={feed}
                transfers={transfers}
                onSendText={sendText}
                onSendFile={sendFile}
                code={myCode}
                isHost={isHost}
                onDisconnect={handleDisconnect}
                autoSync={autoSync}
                setAutoSync={setAutoSync}
              />
            </div>
          </div>
        </main>
        <footer
          className="text-center py-5 text-xs"
          style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }}
        >
          ClipSync · No login · No storage · Pure P2P
        </footer>
      </div>
    );
  }

  // ── Pre-connection view — 2-col desktop layout ────────────────────
  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--bg)' }}>
      <Header />

      <main className="flex-1 flex items-start md:items-center justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-5xl">
          <div className="flex flex-col md:flex-row md:items-start gap-8 md:gap-14">

            {/* ── LEFT: Tool card ── */}
            <div className="w-full md:w-5/12">
              <div
                className="rounded-2xl p-5 md:p-6"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                }}
              >
                {/* Choose mode */}
                {mode === 'choose' && (
                  <div className="fade-in">
                    <p className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: 'var(--text-faint)' }}>
                      Get Started
                    </p>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleStartHost}
                        className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold cursor-pointer text-left"
                        style={{ background: 'var(--accent)', color: '#fff', border: '1px solid transparent' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-hover)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; }}
                      >
                        <div>
                          <div className="font-semibold">Create a room</div>
                          <div className="text-xs mt-0.5" style={{ opacity: 0.8 }}>Get a code, share with other device</div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>

                      <button
                        onClick={() => setMode('join')}
                        className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm cursor-pointer text-left"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)';
                          (e.currentTarget as HTMLElement).style.background = 'var(--code-bg)';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                          (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                        }}
                      >
                        <div>
                          <div className="font-semibold">Join a room</div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Enter the 4-digit code</div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Host view */}
                {mode === 'host' && (
                  <>
                    <BackButton onClick={() => { disconnect(); setMode('choose'); }} />
                    <HostView code={myCode} status={status} onInitHost={initAsHost} />
                  </>
                )}

                {/* Join view */}
                {mode === 'join' && (
                  <>
                    <BackButton onClick={() => { disconnect(); setMode('choose'); }} />
                    <JoinView
                      onJoin={handleJoin}
                      isConnecting={status === 'connecting'}
                      errorMsg={errorMsg}
                    />
                  </>
                )}

                {/* Disconnected banner */}
                {status === 'disconnected' && (
                  <div
                    className="mt-4 flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl"
                    style={{ background: 'var(--error-bg)', color: 'var(--error)' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    Other device disconnected
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT: Headline + features ── */}
            <div className="w-full md:w-7/12 md:pt-2 fade-in">
              <h1
                className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-4"
                style={{ color: 'var(--text)' }}
              >
                Copy here.{' '}
                <span style={{ color: 'var(--accent)' }}>Paste there.</span>
                <br />
                Done.
              </h1>
              <p className="text-base leading-relaxed mb-8 max-w-sm" style={{ color: 'var(--text-muted)' }}>
                Sync your clipboard between any two devices in seconds.
                No login, no download, no account.
              </p>

              <div className="flex flex-col gap-3.5 mb-8">
                {FEATURES.map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--accent)',
                      }}
                    >
                      {f.icon}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {f.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* How it works */}
              <div
                className="p-4 rounded-xl"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-faint)' }}>
                  How it works
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    'Open on Device A → click Create a room',
                    'Scan QR or enter 4-digit code on Device B',
                    'Type or paste — syncs instantly to other device',
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span
                        className="mono text-xs font-bold w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'var(--accent)', color: '#fff', fontSize: '10px' }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      <footer
        className="text-center py-5 text-xs"
        style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }}
      >
        ClipSync · No login · No storage · Pure P2P
      </footer>
    </div>
  );
}
