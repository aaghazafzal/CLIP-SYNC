'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateRoomCode } from '@/lib/utils';

export type SyncStatus =
  | 'idle'
  | 'initializing'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

interface UsePeerSyncReturn {
  text: string;
  sendText: (t: string) => void;
  status: SyncStatus;
  errorMsg: string;
  myCode: string;
  initAsHost: () => Promise<void>;
  joinRoom: (code: string) => Promise<void>;
  disconnect: () => void;
  isHost: boolean;
}

export function usePeerSync(): UsePeerSyncReturn {
  const [text, setText]       = useState('');
  const [status, setStatus]   = useState<SyncStatus>('idle');
  const [errorMsg, setError]  = useState('');
  const [myCode, setMyCode]   = useState('');
  const [isHost, setIsHost]   = useState(false);

  const peerRef   = useRef<any>(null);
  const connRef   = useRef<any>(null);
  const isSending = useRef(false);

  const cleanup = useCallback(() => {
    try { connRef.current?.close(); } catch (_) {}
    try { peerRef.current?.destroy(); } catch (_) {}
    connRef.current = null;
    peerRef.current = null;
  }, []);

  /* ── Shared connection handler (same as ShareBridge setupConn) ── */
  const setupConn = useCallback((c: any) => {
    connRef.current = c;

    c.on('open', () => {
      console.log('[ClipSync] conn open');
      setStatus('connected');
    });

    c.on('data', (data: unknown) => {
      // Handle string messages (clipboard text)
      if (typeof data === 'string') {
        isSending.current = true;
        setText(data);
        setTimeout(() => { isSending.current = false; }, 50);
      }
    });

    c.on('close', () => {
      console.log('[ClipSync] conn closed');
      setStatus('disconnected');
      connRef.current = null;
    });

    c.on('error', (err: Error) => {
      console.error('[ClipSync] conn error', err);
      setError(err.message || 'Connection error');
      setStatus('error');
    });
  }, []);

  /* ── HOST: Exact same pattern as ShareBridge startShare() ── */
  const initAsHost = useCallback(async () => {
    cleanup();
    setStatus('initializing');
    setError('');
    setIsHost(true);

    const code = generateRoomCode();
    setMyCode(code);

    try {
      const { Peer } = await import('peerjs');

      // ShareBridge uses: new Peer(myCode, { debug: 0 })
      // Using code directly as peer ID — no prefix, no extra config
      const peer = new Peer(code, { debug: 0 });
      peerRef.current = peer;

      peer.on('open', (id: string) => {
        console.log('[ClipSync] peer open:', id);
        setStatus('waiting');
      });

      peer.on('error', (err: any) => {
        console.error('[ClipSync] peer error', err);
        if (err.type === 'unavailable-id') {
          // Code taken — regenerate (same as ShareBridge)
          peer.destroy();
          peerRef.current = null;
          setTimeout(() => initAsHost(), 300);
          return;
        }
        setError('Connection error: ' + (err.message || 'Unknown'));
        setStatus('error');
      });

      peer.on('connection', (dataConn: any) => {
        console.log('[ClipSync] incoming connection');
        setupConn(dataConn);
      });

    } catch (err: any) {
      setError(err?.message || 'Failed to start');
      setStatus('error');
    }
  }, [cleanup, setupConn]);

  /* ── JOIN: Exact same pattern as ShareBridge doConnect() ── */
  const joinRoom = useCallback(async (code: string) => {
    cleanup();
    setStatus('connecting');
    setError('');
    setIsHost(false);
    const upperCode = code.toUpperCase();
    setMyCode(upperCode);

    try {
      const { Peer } = await import('peerjs');

      // ShareBridge uses: new Peer({ debug: 0 }) — no ID, let PeerJS assign one
      const peer = new Peer({ debug: 0 } as any);
      peerRef.current = peer;

      peer.on('error', (e: any) => {
        console.error('[ClipSync] peer error', e);
        setError('Peer error: ' + (e.message || 'Unknown'));
        setStatus('error');
      });

      const attempt = () => {
        console.log('[ClipSync] attempting to connect to:', upperCode);
        // ShareBridge uses: peer.connect(code, { reliable:true, serialization:'binary' })
        const c = peer.connect(upperCode, { reliable: true, serialization: 'binary' });
        setupConn(c);

        // Timeout
        setTimeout(() => {
          if (connRef.current && !connRef.current.open) {
            setError('Could not reach the host. Check the code and try again.');
            setStatus('error');
          }
        }, 15000);
      };

      // Same as ShareBridge: if peer already has ID, attempt immediately, otherwise wait
      if (peer.id) {
        attempt();
      } else {
        peer.on('open', attempt);
      }

    } catch (err: any) {
      setError(err?.message || 'Failed to join');
      setStatus('error');
    }
  }, [cleanup, setupConn]);

  const sendText = useCallback((newText: string) => {
    setText(newText);
    if (connRef.current?.open && !isSending.current) {
      connRef.current.send(newText);
    }
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    setStatus('disconnected');
    setText('');
    setMyCode('');
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  return { text, sendText, status, errorMsg, myCode, initAsHost, joinRoom, disconnect, isHost };
}
