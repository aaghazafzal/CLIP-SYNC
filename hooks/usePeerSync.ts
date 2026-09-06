'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateRoomCode, toPeerId } from '@/lib/utils';

export type SyncStatus =
  | 'idle'
  | 'initializing'
  | 'waiting'      // host: peer ready, waiting for joiner
  | 'connecting'   // joiner: connecting to host
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

  // Refs so callbacks always have fresh references
  const peerRef   = useRef<any>(null);
  const connRef   = useRef<any>(null);
  const isSending = useRef(false);   // prevent echo loop

  const cleanup = useCallback(() => {
    try { connRef.current?.close(); } catch (_) {}
    try { peerRef.current?.destroy(); } catch (_) {}
    connRef.current = null;
    peerRef.current = null;
  }, []);

  const attachConnHandlers = useCallback((conn: any) => {
    connRef.current = conn;

    conn.on('open', () => {
      setStatus('connected');
    });

    conn.on('data', (data: unknown) => {
      if (typeof data === 'string') {
        isSending.current = true;
        setText(data);
        setTimeout(() => { isSending.current = false; }, 50);
      }
    });

    conn.on('close', () => {
      setStatus('disconnected');
      connRef.current = null;
    });

    conn.on('error', (err: Error) => {
      setError(err.message || 'Connection error');
      setStatus('error');
    });
  }, []);

  const initAsHost = useCallback(async () => {
    cleanup();
    setStatus('initializing');
    setError('');
    setIsHost(true);

    const code = generateRoomCode();
    setMyCode(code);

    try {
      const { Peer } = await import('peerjs');
      const peer = new Peer(toPeerId(code));
      peerRef.current = peer;

      peer.on('open', () => setStatus('waiting'));

      peer.on('connection', (conn: any) => {
        attachConnHandlers(conn);
      });

      peer.on('error', (err: any) => {
        const msg = err?.type === 'unavailable-id'
          ? 'Room code taken. Refreshing…'
          : err?.message || 'Peer error';
        setError(msg);
        setStatus('error');
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to start');
      setStatus('error');
    }
  }, [cleanup, attachConnHandlers]);

  const joinRoom = useCallback(async (code: string) => {
    cleanup();
    setStatus('connecting');
    setError('');
    setIsHost(false);
    setMyCode(code.toUpperCase());

    try {
      const { Peer } = await import('peerjs');
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', () => {
        const conn = peer.connect(toPeerId(code), { reliable: true });
        attachConnHandlers(conn);

        // Timeout if host not found
        const timer = setTimeout(() => {
          if (connRef.current?.open !== true) {
            setError('Could not reach the host. Check the code and try again.');
            setStatus('error');
          }
        }, 10_000);

        conn.on('open', () => clearTimeout(timer));
      });

      peer.on('error', (err: any) => {
        setError(err?.message || 'Could not connect');
        setStatus('error');
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to join');
      setStatus('error');
    }
  }, [cleanup, attachConnHandlers]);

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

  // Cleanup on unmount
  useEffect(() => () => cleanup(), [cleanup]);

  return { text, sendText, status, errorMsg, myCode, initAsHost, joinRoom, disconnect, isHost };
}
