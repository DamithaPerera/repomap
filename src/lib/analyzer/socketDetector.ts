import { SocketEvent } from '@/types/analysis';
import { FileEntry } from './fileWalker';

const SOCKET_ON_REGEX = /(?:socket|io|server)\s*\.\s*(on|once)\s*\(\s*(['"`])([^'"`]+)\2/gi;
const SOCKET_EMIT_REGEX = /(?:socket|io|server|namespace)\s*\.\s*(emit|broadcast\.emit|to\([^)]+\)\.emit)\s*\(\s*(['"`])([^'"`]+)\2/gi;

let counter = 0;
function makeId() { return `socket_${++counter}`; }

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function extractFunctionBody(content: string, matchIndex: number): string {
  const slice = content.slice(matchIndex, matchIndex + 4000);
  let depth = 0, started = false, start = 0;
  for (let i = 0; i < slice.length; i++) {
    if (slice[i] === '{') {
      if (!started) { started = true; start = i; }
      depth++;
    } else if (slice[i] === '}' && started) {
      if (--depth === 0) return slice.slice(start, i + 1);
    }
  }
  return slice.slice(0, 800);
}

// Exported so the orchestrator can pass bodies to the LLM enricher
export interface SocketWithBody extends SocketEvent {
  _body?: string;
}

export function detectSockets(files: FileEntry[]): SocketWithBody[] {
  counter = 0;
  const sockets: SocketWithBody[] = [];

  for (const { content, relativePath } of files) {
    if (!/socket|ws|websocket/i.test(content)) continue;

    let match: RegExpExecArray | null;

    SOCKET_ON_REGEX.lastIndex = 0;
    while ((match = SOCKET_ON_REGEX.exec(content)) !== null) {
      const event = match[3];
      const isLifecycle = event === 'connection' || event === 'disconnect';
      sockets.push({
        id: makeId(), event, type: 'on', file: relativePath,
        line: getLineNumber(content, match.index),
        description: isLifecycle
          ? (event === 'connection' ? 'Client connected to WebSocket server' : 'Client disconnected from server')
          : `Handle "${event}" event`,
        _body: isLifecycle ? undefined : extractFunctionBody(content, match.index),
      });
    }

    SOCKET_EMIT_REGEX.lastIndex = 0;
    while ((match = SOCKET_EMIT_REGEX.exec(content)) !== null) {
      const emitType = match[1];
      const event = match[3];
      const type = emitType.includes('broadcast') ? 'broadcast' : 'emit';
      sockets.push({
        id: makeId(), event, type, file: relativePath,
        line: getLineNumber(content, match.index),
        description: `${type === 'broadcast' ? 'Broadcast' : 'Emit'} "${event}" to client`,
        _body: extractFunctionBody(content, match.index),
      });
    }
  }

  return sockets;
}
