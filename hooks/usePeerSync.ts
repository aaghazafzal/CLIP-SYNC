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

// ── Relay server URL ─────────────────────────────────────
// In production: your Render.com deployed URL
// In development: local server
let RELAY_URL =
  process.env.NEXT_PUBLIC_RELAY_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'ws://localhost:8080'
    : 'wss://clipsync-relay.onrender.com');

// Ensure the protocol is ws or wss, not http or https
if (RELAY_URL.startsWith('http://')) {
  RELAY_URL = RELAY_URL.replace('http://', 'ws://');
} else if (RELAY_URL.startsWith('https://')) {
  RELAY_URL = RELAY_URL.replace('https://', 'wss://');
}

export function usePeerSync(): UsePeerSyncReturn {
  const [text, setText]       = useState('');
  const [status, setStatus]   = useState<SyncStatus>('idle');
  const [errorMsg, setError]  = useState('');
  const [myCode, setMyCode]   = useState('');
  const [isHost, setIsHost]   = useState(false);

  const wsRef      = useRef<WebSocket | null>(null);
  const isSending  = useRef(false);
  const keepAlive  = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (keepAlive.current) {
      clearInterval(keepAlive.current);
      keepAlive.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(1000); } catch (_) {}
      wsRef.current = null;
    }
  }, []);

  /* ── Connect to relay server and join a room ── */
  const connectToRelay = useCallback((code: string, asHost: boolean) => {
    cleanup();
    setStatus(asHost ? 'initializing' : 'connecting');
    setError('');
    setIsHost(asHost);
    setMyCode(code.toUpperCase());

    const ws = new WebSocket(RELAY_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[ClipSync] WebSocket connected to relay');
      // Join the room
      ws.send(JSON.stringify({ type: 'join', code: code.toUpperCase() }));
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch (_) { return; }

      switch (msg.type) {
        case 'joined':
          console.log(`[ClipSync] Joined room ${msg.code}, ${msg.peers} peer(s)`);
          if (asHost) {
            setStatus(msg.peers > 1 ? 'connected' : 'waiting');
          } else {
            setStatus(msg.peers > 1 ? 'connected' : 'connecting');
          }
          break;

        case 'peer-count':
          console.log(`[ClipSync] Peer count update: ${msg.peers}`);
          if (msg.peers >= 2) {
            setStatus('connected');
          } else if (msg.peers <= 1) {
            // Other device left
            if (status === 'connected') {
              setStatus('disconnected');
            } else if (asHost) {
              setStatus('waiting');
            }
          }
          break;

        case 'text':
          // Received clipboard text from other device
          isSending.current = true;
          setText(msg.text || '');
          setTimeout(() => { isSending.current = false; }, 50);
          break;

        case 'pong':
          // Keepalive response, ignore
          break;
      }
    };

    ws.onerror = (err) => {
      console.error('[ClipSync] WebSocket error:', err);
      setError('Connection error. Please try again.');
      setStatus('error');
    };

    ws.onclose = (event) => {
      console.log('[ClipSync] WebSocket closed:', event.code, event.reason);
      if (status !== 'error' && status !== 'idle') {
        setStatus('disconnected');
      }
    };

    // Keepalive ping every 25s (Render.com closes idle connections after 60s)
    keepAlive.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }, [cleanup, status]);

  const initAsHost = useCallback(async () => {
    const code = generateRoomCode();
    connectToRelay(code, true);
  }, [connectToRelay]);

  const joinRoom = useCallback(async (code: string) => {
    connectToRelay(code, false);
  }, [connectToRelay]);

  const sendText = useCallback((newText: string) => {
    setText(newText);
    if (wsRef.current?.readyState === WebSocket.OPEN && !isSending.current) {
      wsRef.current.send(JSON.stringify({ type: 'text', text: newText }));
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
