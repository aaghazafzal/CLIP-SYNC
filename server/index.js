import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const PORT = process.env.PORT || 8080;

// ── Room storage ─────────────────────────────────────────
// rooms: Map<roomCode, Set<WebSocket>>
const rooms = new Map();

// Auto-cleanup idle rooms every 10 minutes
const ROOM_TTL = 60 * 60 * 1000; // 1 hour
const roomTimestamps = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [code, ts] of roomTimestamps) {
    if (now - ts > ROOM_TTL) {
      const clients = rooms.get(code);
      if (clients) {
        for (const ws of clients) {
          try { ws.close(1000, 'Room expired'); } catch (_) {}
        }
      }
      rooms.delete(code);
      roomTimestamps.delete(code);
      console.log(`[Relay] Room ${code} expired`);
    }
  }
}, 10 * 60 * 1000);

// ── HTTP server (for health check on Render) ─────────────
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      rooms: rooms.size,
      uptime: Math.floor(process.uptime())
    }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ClipSync Relay Server');
});

// ── WebSocket server ─────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  let currentRoom = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (_) {
      return;
    }

    switch (msg.type) {
      // ── Join a room ──
      case 'join': {
        const code = String(msg.code || '').toUpperCase();
        if (!code) return;

        // Leave old room if any
        if (currentRoom && rooms.has(currentRoom)) {
          rooms.get(currentRoom).delete(ws);
          if (rooms.get(currentRoom).size === 0) {
            rooms.delete(currentRoom);
            roomTimestamps.delete(currentRoom);
          }
        }

        // Join new room
        if (!rooms.has(code)) {
          rooms.set(code, new Set());
        }
        rooms.get(code).add(ws);
        currentRoom = code;
        roomTimestamps.set(code, Date.now());

        const peerCount = rooms.get(code).size;
        console.log(`[Relay] ${code}: client joined (${peerCount} in room)`);

        // Notify this client
        ws.send(JSON.stringify({ type: 'joined', code, peers: peerCount }));

        // Notify ALL clients in room about peer count update
        for (const client of rooms.get(code)) {
          if (client.readyState === 1) {
            client.send(JSON.stringify({ 
              type: 'peer-count', 
              peers: peerCount 
            }));
          }
        }
        break;
      }

      // ── Clipboard text sync ──
      case 'text': {
        if (!currentRoom || !rooms.has(currentRoom)) return;
        roomTimestamps.set(currentRoom, Date.now());

        const payload = JSON.stringify({ type: 'text', text: msg.text });

        // Forward to all OTHER clients in the room
        for (const client of rooms.get(currentRoom)) {
          if (client !== ws && client.readyState === 1) {
            client.send(payload);
          }
        }
        break;
      }

      // ── Ping/pong keepalive ──
      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      }
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(ws);
      const remaining = rooms.get(currentRoom).size;
      console.log(`[Relay] ${currentRoom}: client left (${remaining} remaining)`);

      // Notify remaining clients
      for (const client of rooms.get(currentRoom)) {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ 
            type: 'peer-count', 
            peers: remaining 
          }));
        }
      }

      if (remaining === 0) {
        rooms.delete(currentRoom);
        roomTimestamps.delete(currentRoom);
      }
    }
  });

  ws.on('error', (err) => {
    console.error('[Relay] WS error:', err.message);
  });
});

// ── Start ────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`[ClipSync Relay] Running on port ${PORT}`);
  console.log(`[ClipSync Relay] Health check: http://localhost:${PORT}/health`);
});
