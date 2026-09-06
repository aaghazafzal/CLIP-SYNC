'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateRoomCode } from '@/lib/utils';
import Peer, { DataConnection } from 'peerjs';

export type SyncStatus =
  | 'idle'
  | 'initializing'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export type FeedItem = {
  id: string;
  type: 'text' | 'image' | 'file';
  content?: string;
  fileName?: string;
  fileSize?: number;
  fileUrl?: string;
  mimeType?: string;
  sender: 'me' | 'other';
  timestamp: number;
};

export type TransferProgress = {
  fileId: string;
  fileName: string;
  totalSize: number;
  transferred: number;
  type: 'upload' | 'download';
};

interface UsePeerSyncReturn {
  feed: FeedItem[];
  transfers: Record<string, TransferProgress>;
  sendText: (t: string) => void;
  sendFile: (file: File) => Promise<void>;
  status: SyncStatus;
  errorMsg: string;
  myCode: string;
  initAsHost: () => Promise<void>;
  joinRoom: (code: string) => Promise<void>;
  disconnect: () => void;
  isHost: boolean;
  autoSync: boolean;
  setAutoSync: (val: boolean) => void;
}

const RELAY_URL =
  process.env.NEXT_PUBLIC_RELAY_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'ws://localhost:8080'
    : 'wss://clipsync-relay-wthr.onrender.com');

export function usePeerSync(): UsePeerSyncReturn {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [transfers, setTransfers] = useState<Record<string, TransferProgress>>({});
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [errorMsg, setError] = useState('');
  const [myCode, setMyCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [autoSync, setAutoSyncState] = useState(false);

  // References for connections
  const wsRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const keepAlive = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load auto-sync preference on mount
  useEffect(() => {
    const saved = localStorage.getItem('clipsync_auto_sync');
    if (saved === 'true') setAutoSyncState(true);
  }, []);

  const setAutoSync = useCallback((val: boolean) => {
    setAutoSyncState(val);
    localStorage.setItem('clipsync_auto_sync', String(val));
  }, []);

  const cleanup = useCallback(() => {
    if (keepAlive.current) {
      clearInterval(keepAlive.current);
      keepAlive.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(1000); } catch (_) {}
      wsRef.current = null;
    }
    if (connRef.current) {
      try { connRef.current.close(); } catch (_) {}
      connRef.current = null;
    }
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch (_) {}
      peerRef.current = null;
    }
  }, []);

  const addFeedItem = useCallback((item: Omit<FeedItem, 'id' | 'timestamp'>) => {
    const newItem: FeedItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    };
    setFeed((prev) => [newItem, ...prev]);
    return newItem;
  }, []);

  // ── Connection Logic (WebSocket + PeerJS) ──
  const connectToRoom = useCallback((code: string, asHost: boolean) => {
    cleanup();
    setStatus(asHost ? 'initializing' : 'connecting');
    setError('');
    setIsHost(asHost);
    setMyCode(code.toUpperCase());

    let wsUrl = RELAY_URL;
    if (wsUrl.startsWith('http://')) wsUrl = wsUrl.replace('http://', 'ws://');
    if (wsUrl.startsWith('https://')) wsUrl = wsUrl.replace('https://', 'wss://');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', code: code.toUpperCase() }));
    };

    ws.onmessage = async (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch (_) { return; }

      switch (msg.type) {
        case 'joined':
          if (asHost) setStatus(msg.peers > 1 ? 'connected' : 'waiting');
          else setStatus(msg.peers > 1 ? 'connected' : 'connecting');
          break;
        case 'peer-count':
          if (msg.peers >= 2) setStatus('connected');
          else if (msg.peers <= 1 && status === 'connected') setStatus('disconnected');
          else if (asHost && msg.peers <= 1) setStatus('waiting');
          break;
        case 'text':
          addFeedItem({ type: 'text', content: msg.text, sender: 'other' });
          if (autoSync && document.hasFocus()) {
            try {
              await navigator.clipboard.writeText(msg.text);
              console.log('[AutoSync] Copied to clipboard!');
            } catch (err) {
              console.error('[AutoSync] Write failed', err);
            }
          }
          break;
      }
    };

    ws.onerror = () => {
      setError('Relay Connection error.');
      setStatus('error');
    };

    ws.onclose = () => {
      if (status !== 'error' && status !== 'idle') setStatus('disconnected');
    };

    keepAlive.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 25000);

    const peer = new Peer(asHost ? code.toUpperCase() : '', {
      debug: 1,
    });
    peerRef.current = peer;

    peer.on('open', () => {
      if (!asHost) {
        // Remove serialization: 'none' to avoid PeerJS crash. Default msgpack works fine for 64KB chunks.
        const conn = peer.connect(code.toUpperCase(), { reliable: true });
        setupPeerConnection(conn);
      }
    });

    peer.on('connection', (conn) => {
      if (asHost) {
        setupPeerConnection(conn);
      }
    });

    peer.on('error', (err) => {
      console.warn('[PeerJS] Background connection error (Files might not work):', err);
    });

  }, [cleanup, status, addFeedItem, autoSync]);

  const activeRxMeta = useRef<{ fileId: string; fileName: string; mimeType: string; fileSize: number; received: number; bufs: ArrayBuffer[] } | null>(null);

  const setupPeerConnection = (conn: DataConnection) => {
    connRef.current = conn;
    conn.on('open', () => {
      console.log('[PeerJS] Data channel ready for files!');
    });

    conn.on('data', (data: any) => {
      if (typeof data === 'string') {
        let msg;
        try { msg = JSON.parse(data); } catch (_) { return; }
        
        if (msg.type === 'file-start') {
          activeRxMeta.current = {
            fileId: msg.fileId,
            fileName: msg.fileName,
            fileSize: msg.fileSize,
            mimeType: msg.mimeType,
            received: 0,
            bufs: []
          };
          setTransfers(prev => ({
            ...prev,
            [msg.fileId]: { fileId: msg.fileId, fileName: msg.fileName, totalSize: msg.fileSize, transferred: 0, type: 'download' }
          }));
        } else if (msg.type === 'file-done') {
          const rx = activeRxMeta.current;
          if (rx) {
            const blob = new Blob(rx.bufs, { type: rx.mimeType || 'application/octet-stream' });
            const fileUrl = URL.createObjectURL(blob);
            addFeedItem({
              type: rx.mimeType.startsWith('image/') ? 'image' : 'file',
              fileName: rx.fileName,
              fileSize: rx.fileSize,
              mimeType: rx.mimeType,
              fileUrl,
              sender: 'other'
            });
            setTransfers(prev => {
              const next = { ...prev };
              delete next[rx.fileId];
              return next;
            });
            activeRxMeta.current = null;
          }
        }
      } else if (data instanceof ArrayBuffer) {
        const rx = activeRxMeta.current;
        if (rx) {
          rx.bufs.push(data);
          rx.received += data.byteLength;
          
          setTransfers(prev => ({
            ...prev,
            [rx.fileId]: { ...prev[rx.fileId], transferred: rx.received }
          }));
        }
      }
    });
  };

  const drainBuffer = (c: DataConnection) => {
    return new Promise<void>(res => {
      const CHUNK = 64000;
      const chk = () => {
        // @ts-ignore - PeerJS exposes dataChannel internally
        if (c.dataChannel && c.dataChannel.bufferedAmount > CHUNK * 6) setTimeout(chk, 40);
        else res();
      };
      chk();
    });
  };

  const initAsHost = useCallback(async () => {
    const code = generateRoomCode();
    connectToRoom(code, true);
  }, [connectToRoom]);

  const joinRoom = useCallback(async (code: string) => {
    connectToRoom(code, false);
  }, [connectToRoom]);

  const sendText = useCallback((text: string) => {
    addFeedItem({ type: 'text', content: text, sender: 'me' });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'text', text }));
    }
  }, [addFeedItem]);

  const sendFile = useCallback(async (file: File) => {
    if (!connRef.current || !connRef.current.open) {
      console.warn('[PeerJS] Cannot send file, data channel not open');
      return;
    }

    const fileId = Math.random().toString(36).substring(2, 9);
    setTransfers(prev => ({
      ...prev,
      [fileId]: { fileId, fileName: file.name, totalSize: file.size, transferred: 0, type: 'upload' }
    }));

    connRef.current.send(JSON.stringify({
      type: 'file-start',
      fileId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type
    }));

    const CHUNK = 64000;
    const chunksCount = Math.ceil(file.size / CHUNK);
    let fileSent = 0;

    for (let n = 0; n < chunksCount; n++) {
      const start = n * CHUNK;
      const end = Math.min(start + CHUNK, file.size);
      const buf = await file.slice(start, end).arrayBuffer();

      await drainBuffer(connRef.current);
      connRef.current.send(buf);

      fileSent += (end - start);
      setTransfers(prev => ({
        ...prev,
        [fileId]: { ...prev[fileId], transferred: fileSent }
      }));
    }

    connRef.current.send(JSON.stringify({ type: 'file-done' }));

    // Create local preview immediately for sender
    const isImage = file.type.startsWith('image/');
    const localBlob = new Blob([await file.arrayBuffer()], { type: file.type });
    const fileUrl = URL.createObjectURL(localBlob);
    
    addFeedItem({
      type: isImage ? 'image' : 'file',
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      fileUrl,
      sender: 'me'
    });

    // Cleanup transfer state
    setTimeout(() => {
      setTransfers(prev => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });
    }, 500);

  }, [addFeedItem]);

  const disconnect = useCallback(() => {
    cleanup();
    setStatus('disconnected');
    setFeed([]);
    setMyCode('');
  }, [cleanup]);

  // Handle Auto-Sync Clipboard Read on Focus
  useEffect(() => {
    const handleFocus = async () => {
      if (status !== 'connected' || !autoSync) return;
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          // Avoid sending the same text repeatedly if it hasn't changed
          // We can check the latest text sent
          setFeed(prev => {
            const lastMyText = prev.find(p => p.sender === 'me' && p.type === 'text');
            if (lastMyText?.content !== text) {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'text', text }));
                
                // Return updated feed synchronously within setState
                return [{
                  id: Math.random().toString(36).substring(2, 9),
                  type: 'text',
                  content: text,
                  sender: 'me',
                  timestamp: Date.now()
                }, ...prev];
              }
            }
            return prev;
          });
        }
      } catch (err) {
        console.log('[AutoSync] Cannot read clipboard automatically');
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [status, autoSync]);

  // Handle Global Ctrl+V (Paste) for both Text and Images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (status !== 'connected') return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) await sendFile(file);
          e.preventDefault();
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [status, sendFile]);

  useEffect(() => () => cleanup(), [cleanup]);

  return { feed, transfers, sendText, sendFile, status, errorMsg, myCode, initAsHost, joinRoom, disconnect, isHost, autoSync: autoSync, setAutoSync };
}
