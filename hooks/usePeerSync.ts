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

// PeerJS config with explicit ICE servers for better NAT traversal
const PEER_CONFIG = {
  debug: 2, // 0=none 1=errors 2=warnings 3=all
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      // Free TURN servers for when STUN doesn't work (symmetric NAT)
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
  },
};

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

  const attachConnHandlers = useCallback((conn: any) => {
    connRef.current = conn;

    conn.on('open', () => {
      console.log('[ClipSync] ✅ Connection opened!');
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
      console.log('[ClipSync] Connection closed');
      setStatus('disconnected');
      connRef.current = null;
    });

    conn.on('error', (err: Error) => {
      console.error('[ClipSync] Connection error:', err);
      setError(err.message || 'Connection error');
      setStatus('error');
    });
  }, []);

  // ── HOST ────────────────────────────────────────────────
  const initAsHost = useCallback(async () => {
    cleanup();
    setStatus('initializing');
    setError('');
    setIsHost(true);

    const code = generateRoomCode();
    setMyCode(code);
    const peerId = toPeerId(code);

    try {
      const { Peer } = await import('peerjs');
      console.log('[ClipSync] Host creating peer with ID:', peerId);
      
      const peer = new Peer(peerId, PEER_CONFIG);
      peerRef.current = peer;

      peer.on('open', (id: string) => {
        console.log('[ClipSync] ✅ Host registered on PeerJS server. ID:', id);
        setStatus('waiting');
      });

      peer.on('connection', (conn: any) => {
        console.log('[ClipSync] 🔔 Incoming connection from:', conn.peer);
        attachConnHandlers(conn);
      });

      peer.on('error', (err: any) => {
        console.error('[ClipSync] Host error:', err?.type, err?.message);
        if (err?.type === 'unavailable-id') {
          // ID already taken — generate a new one and retry
          console.log('[ClipSync] ID taken, retrying with new code...');
          cleanup();
          setTimeout(() => initAsHost(), 500);
          return;
        }
        setError(err?.message || 'Peer error');
        setStatus('error');
      });

      peer.on('disconnected', () => {
        console.log('[ClipSync] ⚠️ Host disconnected from signaling server, reconnecting...');
        // Try to reconnect to the signaling server
        try { peer.reconnect(); } catch (_) {}
      });

    } catch (err: any) {
      setError(err?.message || 'Failed to start');
      setStatus('error');
    }
  }, [cleanup, attachConnHandlers]);

  // ── JOIN ────────────────────────────────────────────────
  const joinRoom = useCallback(async (code: string) => {
    cleanup();
    setStatus('connecting');
    setError('');
    setIsHost(false);
    setMyCode(code.toUpperCase());

    const hostPeerId = toPeerId(code);

    try {
      const { Peer } = await import('peerjs');
      console.log('[ClipSync] Joiner creating peer...');
      
      const peer = new Peer(PEER_CONFIG);
      peerRef.current = peer;

      peer.on('open', (myId: string) => {
        console.log('[ClipSync] ✅ Joiner registered. My ID:', myId);
        console.log('[ClipSync] 🔗 Connecting to host:', hostPeerId);
        
        const conn = peer.connect(hostPeerId, { 
          reliable: true,
          serialization: 'json',
        });
        attachConnHandlers(conn);

        // Timeout if host not reachable within 20 seconds
        const timer = setTimeout(() => {
          if (connRef.current?.open !== true) {
            console.error('[ClipSync] ❌ Connection timeout');
            setError('Could not reach the host. Make sure the code is correct and the other device still has the page open.');
            setStatus('error');
          }
        }, 20_000);

        conn.on('open', () => clearTimeout(timer));
        conn.on('error', () => clearTimeout(timer));
      });

      peer.on('error', (err: any) => {
        console.error('[ClipSync] Joiner peer error:', err?.type, err?.message);
        let msg: string;
        switch (err?.type) {
          case 'peer-unavailable':
            msg = 'Room not found. The host may have left or the code is wrong.';
            break;
          case 'network':
            msg = 'Network error. Check your internet connection.';
            break;
          case 'server-error':
            msg = 'Signaling server error. Please try again in a moment.';
            break;
          default:
            msg = err?.message || 'Could not connect. Try again.';
        }
        setError(msg);
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

  useEffect(() => () => cleanup(), [cleanup]);

  return { text, sendText, status, errorMsg, myCode, initAsHost, joinRoom, disconnect, isHost };
}
