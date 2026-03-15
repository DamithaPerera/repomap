'use client';

import { Node } from 'reactflow';
import { ApiEndpoint, SocketEvent, DbModel } from '@/types/analysis';

interface Props {
  node: Node | null;
  onClose: () => void;
}

export function DetailPanel({ node, onClose }: Props) {
  if (!node) return null;

  const data = node.data?.raw;

  return (
    <div className="absolute top-4 right-4 z-10 w-80 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-white/10">
        <span className="text-white font-semibold text-sm">Details</span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-lg leading-none"
        >
          ✕
        </button>
      </div>

      <div className="p-4 max-h-[70vh] overflow-y-auto space-y-3 text-sm">
        {node.type === 'apiNode' && <ApiDetail api={data as ApiEndpoint} />}
        {node.type === 'socketNode' && <SocketDetail socket={data as SocketEvent} />}
        {node.type === 'dbNode' && <DbDetail model={data as DbModel} />}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-slate-500 text-[10px] uppercase tracking-wide">{label}</span>
      <span className="text-slate-200 font-mono text-xs break-all">{value}</span>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white ${color}`}>
      {text}
    </span>
  );
}

function ApiDetail({ api }: { api: ApiEndpoint }) {
  const methodColors: Record<string, string> = {
    GET: 'bg-green-600', POST: 'bg-blue-600', PUT: 'bg-yellow-600',
    PATCH: 'bg-orange-500', DELETE: 'bg-red-600', ALL: 'bg-purple-600', USE: 'bg-gray-600',
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge text={api.method} color={methodColors[api.method] ?? 'bg-gray-600'} />
        {api.auth && <Badge text="Auth Required" color="bg-yellow-700" />}
      </div>
      <Row label="Path" value={api.path} />
      <Row label="Description" value={api.description} />
      <Row label="File" value={`${api.file}:${api.line}`} />
      {api.params.length > 0 && (
        <Row label="URL Params" value={api.params.join(', ')} />
      )}
      {api.dbOperations.length > 0 && (
        <Row label="DB Models used" value={api.dbOperations.join(', ')} />
      )}
    </div>
  );
}

function SocketDetail({ socket }: { socket: SocketEvent }) {
  const typeColors: Record<string, string> = {
    on: 'bg-teal-600', emit: 'bg-indigo-600', broadcast: 'bg-purple-700',
  };
  return (
    <div className="space-y-3">
      <Badge text={socket.type.toUpperCase()} color={typeColors[socket.type] ?? 'bg-gray-600'} />
      <Row label="Event" value={`"${socket.event}"`} />
      <Row label="Description" value={socket.description} />
      <Row label="File" value={`${socket.file}:${socket.line}`} />
    </div>
  );
}

function DbDetail({ model }: { model: DbModel }) {
  return (
    <div className="space-y-3">
      <Badge text={model.type.toUpperCase()} color="bg-slate-600" />
      <Row label="Model" value={model.name} />
      <Row label="File" value={model.file} />
      {model.fields.length > 0 && (
        <div>
          <span className="text-slate-500 text-[10px] uppercase tracking-wide block mb-1">Fields</span>
          <div className="space-y-1 bg-slate-800 rounded p-2">
            {model.fields.map((f) => (
              <div key={f.name} className="flex justify-between text-xs">
                <span className="text-slate-200">{f.name}</span>
                <span className="text-slate-500">{f.fieldType}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {model.relations.length > 0 && (
        <div>
          <span className="text-slate-500 text-[10px] uppercase tracking-wide block mb-1">Relations</span>
          <div className="space-y-1 bg-slate-800 rounded p-2">
            {model.relations.map((r, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-slate-300">{r.targetModel}</span>
                <span className="text-teal-400">{r.relationType}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
