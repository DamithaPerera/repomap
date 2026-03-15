import { SocketEvent } from '@/types/analysis';
import { FileEntry } from './fileWalker';

// socket.io: io.on('connection'), socket.on('event'), socket.emit('event'), io.emit(...)
const SOCKET_ON_REGEX = /(?:socket|io|server)\s*\.\s*(on|once)\s*\(\s*(['"`])([^'"`]+)\2/gi;
const SOCKET_EMIT_REGEX = /(?:socket|io|server|namespace)\s*\.\s*(emit|broadcast\.emit|to\([^)]+\)\.emit)\s*\(\s*(['"`])([^'"`]+)\2/gi;

let counter = 0;
function makeId() {
  return `socket_${++counter}`;
}

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

export function detectSockets(files: FileEntry[]): SocketEvent[] {
  counter = 0;
  const sockets: SocketEvent[] = [];

  for (const { content, relativePath } of files) {
    // Only process files that look like they use sockets
    if (!/socket|ws|websocket/i.test(content)) continue;

    let match: RegExpExecArray | null;

    SOCKET_ON_REGEX.lastIndex = 0;
    while ((match = SOCKET_ON_REGEX.exec(content)) !== null) {
      const event = match[3];
      if (event === 'connection' || event === 'disconnect') {
        sockets.push({
          id: makeId(),
          event,
          type: 'on',
          file: relativePath,
          line: getLineNumber(content, match.index),
          description: event === 'connection' ? 'Client connected' : 'Client disconnected',
        });
      } else {
        sockets.push({
          id: makeId(),
          event,
          type: 'on',
          file: relativePath,
          line: getLineNumber(content, match.index),
          description: `Listen for "${event}" event`,
        });
      }
    }

    SOCKET_EMIT_REGEX.lastIndex = 0;
    while ((match = SOCKET_EMIT_REGEX.exec(content)) !== null) {
      const emitType = match[1];
      const event = match[3];
      const type = emitType.includes('broadcast') ? 'broadcast' : 'emit';
      sockets.push({
        id: makeId(),
        event,
        type,
        file: relativePath,
        line: getLineNumber(content, match.index),
        description: `${type === 'broadcast' ? 'Broadcast' : 'Emit'} "${event}" event`,
      });
    }
  }

  return sockets;
}
