// Generates a random 4-char alphanumeric room code (uppercase, no ambiguous chars)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  return Array.from(
    { length: 4 },
    () => CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('');
}

// Prefix used on PeerJS server to namespace our IDs
export const PEER_PREFIX = 'clipsync-v1-';

export function toPeerId(code: string): string {
  return `${PEER_PREFIX}${code.toUpperCase()}`;
}

export function formatCode(code: string): string {
  return code.toUpperCase();
}

export function isValidCode(code: string): boolean {
  return /^[A-Z2-9]{4}$/i.test(code);
}

export function buildJoinUrl(code: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.set('room', code.toUpperCase());
  return url.toString();
}
