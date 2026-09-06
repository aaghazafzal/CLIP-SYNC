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

interface UsePeerSyncReturn {
  feed: FeedItem[];
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

    // 1. WebSocket for Text and Presence
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
          // Auto-write to clipboard if enabled
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
        // Joiner connects to host - use default JSON serialization for reliability
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

  const fileChunksRef = useRef<Record<string, {
    fileName: string;
    fileSize: number;
    mimeType: string;
    totalChunks: number;
    chunks: string[];
    receivedChunks: number;
  }>>({});

  const setupPeerConnection = (conn: DataConnection) => {
    connRef.current = conn;
    conn.on('open', () => {
      console.log('[PeerJS] Data channel ready for files!');
    });

    conn.on('data', (data: any) => {
      if (data && data.type === 'file-start') {
        fileChunksRef.current[data.fileId] = {
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          totalChunks: data.totalChunks,
          chunks: new Array(data.totalChunks),
          receivedChunks: 0
        };
      } else if (data && data.type === 'file-chunk') {
        const fileInfo = fileChunksRef.current[data.fileId];
        if (fileInfo) {
          fileInfo.chunks[data.chunkIndex] = data.data;
          fileInfo.receivedChunks++;
          
          if (fileInfo.receivedChunks === fileInfo.totalChunks) {
            // Reconstruct file!
            const fullDataUrl = fileInfo.chunks.join('');
            
            addFeedItem({
              type: fileInfo.mimeType.startsWith('image/') ? 'image' : 'file',
              fileName: fileInfo.fileName,
              fileSize: fileInfo.fileSize,
              mimeType: fileInfo.mimeType,
              fileUrl: fullDataUrl,
              sender: 'other'
            });
            
            delete fileChunksRef.current[data.fileId];
          }
        }
      }
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
    const isImage = file.type.startsWith('image/');
    
    // Create local preview immediately
    const fileUrl = URL.createObjectURL(file);
    
    addFeedItem({
      type: isImage ? 'image' : 'file',
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      fileUrl,
      sender: 'me'
    });

    if (connRef.current && connRef.current.open) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64data = reader.result as string;
        
        // Chunk the base64 string
        const CHUNK_SIZE = 64000; // 64KB per chunk
        const totalChunks = Math.ceil(base64data.length / CHUNK_SIZE);
        const fileId = Math.random().toString(36).substring(2, 9);
        
        connRef.current!.send({
          type: 'file-start',
          fileId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          totalChunks
        });

        let currentChunk = 0;
        
        // Send chunks with a small delay to prevent buffer overflow
        const sendInterval = setInterval(() => {
          if (currentChunk >= totalChunks) {
            clearInterval(sendInterval);
            return;
          }
          const chunkData = base64data.slice(currentChunk * CHUNK_SIZE, (currentChunk + 1) * CHUNK_SIZE);
          connRef.current!.send({
            type: 'file-chunk',
            fileId,
            chunkIndex: currentChunk,
            data: chunkData
          });
          currentChunk++;
        }, 15); // 15ms delay ~ 4.2MB/s, very safe for WebRTC
      };
      reader.readAsDataURL(file);
    } else {
      console.warn('[PeerJS] Cannot send file, data channel not open');
      // Could show a toast error here
    }
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

  return { feed, sendText, sendFile, status, errorMsg, myCode, initAsHost, joinRoom, disconnect, isHost, autoSync: autoSync, setAutoSync };
}
