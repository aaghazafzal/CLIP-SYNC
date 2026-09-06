'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateRoomCode } from '@/lib/utils';

export type SyncStatus =
  | 'idle'
  | 'initializing'
  | 'waiting'      // host: waiting for joiner
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

  const roomRef = useRef<any>(null);
  const sendTextFnRef = useRef<any>(null);
  const isSending = useRef(false);

  const cleanup = useCallback(() => {
    try {
      if (roomRef.current) {
        roomRef.current.leave();
      }
    } catch (_) {}
    roomRef.current = null;
    sendTextFnRef.current = null;
  }, []);

  const setupRoom = useCallback(async (code: string, asHost: boolean) => {
    cleanup();
    setStatus(asHost ? 'initializing' : 'connecting');
    setError('');
    setIsHost(asHost);
    setMyCode(code.toUpperCase());

    try {
      // Dynamic import to prevent SSR issues with WebRTC
      const { joinRoom: joinTrysteroRoom } = await import('@trystero-p2p/torrent');
      
      const appId = 'clipsync-zero-setup-v1';
      
      // Free STUN/TURN servers to bypass strict NAT (like mobile 5G)
      const rtcConfig = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          }
        ]
      };

      // Join the Trystero room (using torrent trackers for signaling + TURN for connection)
      const room = joinTrysteroRoom({ appId, rtcConfig }, code.toUpperCase());
      roomRef.current = room;

      if (asHost) {
        setStatus('waiting');
      }

      room.onPeerJoin = (peerId: string) => {
        console.log('[ClipSync] 🔗 Peer joined:', peerId);
        setStatus('connected');
      };

      room.onPeerLeave = (peerId: string) => {
        console.log('[ClipSync] ⚠️ Peer left:', peerId);
        setStatus('disconnected');
      };

      // Setup actions
      const action = room.makeAction('clipboard-text');
      sendTextFnRef.current = action.send;

      action.onMessage = (data: unknown, context: any) => {
        if (typeof data === 'string') {
          isSending.current = true;
          setText(data);
          setTimeout(() => { isSending.current = false; }, 50);
        }
      };

      // Timeout for joiner if no one is in the room after 25s
      if (!asHost) {
        setTimeout(() => {
          if (room.getPeers && Object.keys(room.getPeers()).length === 0) {
            setError('Could not reach the host. Make sure the code is correct and the other device still has the page open.');
            setStatus('error');
            cleanup();
          }
        }, 25_000);
      }

    } catch (err: any) {
      console.error('[ClipSync] Error:', err);
      setError(err?.message || 'Failed to connect');
      setStatus('error');
    }
  }, [cleanup]);

  const initAsHost = useCallback(async () => {
    const code = generateRoomCode();
    await setupRoom(code, true);
  }, [setupRoom]);

  const joinRoom = useCallback(async (code: string) => {
    await setupRoom(code, false);
  }, [setupRoom]);

  const sendText = useCallback((newText: string) => {
    setText(newText);
    if (sendTextFnRef.current && status === 'connected' && !isSending.current) {
      sendTextFnRef.current(newText);
    }
  }, [status]);

  const disconnect = useCallback(() => {
    cleanup();
    setStatus('disconnected');
    setText('');
    setMyCode('');
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  return { text, sendText, status, errorMsg, myCode, initAsHost, joinRoom, disconnect, isHost };
}
