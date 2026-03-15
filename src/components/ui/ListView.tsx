'use client';

import { useState } from 'react';
import { ProjectAnalysis, ApiEndpoint, SocketEvent, DbModel } from '@/types/analysis';

interface Props {
  analysis: ProjectAnalysis;
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-600 text-white',
  POST: 'bg-blue-600 text-white',
  PUT: 'bg-yellow-500 text-black',
  PATCH: 'bg-orange-500 text-white',
  DELETE: 'bg-red-600 text-white',
  ALL: 'bg-purple-600 text-white',
  USE: 'bg-slate-600 text-white',
};

const DB_TYPE_COLORS: Record<string, string> = {
  mongoose: 'text-green-400',
  prisma: 'text-blue-400',
  sequelize: 'text-cyan-400',
  typeorm: 'text-orange-400',
  drizzle: 'text-yellow-400',
  dynamodb: 'text-amber-400',
  unknown: 'text-slate-400',
};

export function ListView({ analysis, selectedNodeId, onSelect }: Props) {
  const { apis, sockets, models } = analysis;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    apis: true,
    sockets: true,
    models: true,
  });
  const [search, setSearch] = useState('');

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const q = search.toLowerCase();
  const filteredApis = apis.filter(
    (a) => a.path.toLowerCase().includes(q) || a.method.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
  );
  const filteredSockets = sockets.filter(
    (s) => s.event.toLowerCase().includes(q) || s.type.toLowerCase().includes(q)
  );
  const filteredModels = models.filter(
    (m) => m.name.toLowerCase().includes(q) || m.type.toLowerCase().includes(q)
  );

  return (
    <div className="h-full flex flex-col bg-slate-900 border-r border-white/10 overflow-hidden">
      {/* Search */}
      <div className="px-3 py-2 border-b border-white/10 flex-shrink-0">
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-800 border border-white/10 text-white placeholder-slate-500 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── APIs ── */}
        <Section
          title="API Endpoints"
          count={filteredApis.length}
          total={apis.length}
          color="text-indigo-400"
          open={openSections.apis}
          onToggle={() => toggle('apis')}
        >
          {filteredApis.map((api) => (
            <ApiRow
              key={api.id}
              api={api}
              selected={selectedNodeId === api.id}
              onClick={() => onSelect(api.id)}
            />
          ))}
          {filteredApis.length === 0 && <Empty />}
        </Section>

        {/* ── Sockets ── */}
        <Section
          title="Socket Events"
          count={filteredSockets.length}
          total={sockets.length}
          color="text-teal-400"
          open={openSections.sockets}
          onToggle={() => toggle('sockets')}
        >
          {filteredSockets.map((sock) => (
            <SocketRow
              key={sock.id}
              socket={sock}
              selected={selectedNodeId === sock.id}
              onClick={() => onSelect(sock.id)}
            />
          ))}
          {filteredSockets.length === 0 && <Empty />}
        </Section>

        {/* ── DB Models ── */}
        <Section
          title="Database Models"
          count={filteredModels.length}
          total={models.length}
          color="text-green-400"
          open={openSections.models}
          onToggle={() => toggle('models')}
        >
          {filteredModels.map((model) => (
            <ModelRow
              key={model.id}
              model={model}
              selected={selectedNodeId === model.id}
              onClick={() => onSelect(model.id)}
            />
          ))}
          {filteredModels.length === 0 && <Empty />}
        </Section>
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({
  title, count, total, color, open, onToggle, children,
}: {
  title: string; count: number; total: number; color: string;
  open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/5">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${color}`}>{title}</span>
          <span className="bg-slate-700 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-full">
            {count === total ? total : `${count}/${total}`}
          </span>
        </div>
        <span className="text-slate-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

// ── API row ───────────────────────────────────────────────────────────────────
function ApiRow({ api, selected, onClick }: { api: ApiEndpoint; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 border-l-2 transition-colors hover:bg-slate-800 ${
        selected ? 'border-indigo-400 bg-slate-800' : 'border-transparent'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${METHOD_COLORS[api.method] ?? 'bg-gray-600 text-white'}`}>
          {api.method}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-white text-xs font-mono truncate">{api.path}</div>
          <div className="text-slate-400 text-[10px] truncate">{api.description}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-slate-600 text-[9px] truncate">{api.file}:{api.line}</span>
            {api.auth && <span className="text-yellow-500 text-[9px]">🔒 auth</span>}
            {api.params.length > 0 && (
              <span className="text-slate-500 text-[9px]">:{api.params.join(', :')}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Socket row ────────────────────────────────────────────────────────────────
function SocketRow({ socket, selected, onClick }: { socket: SocketEvent; selected: boolean; onClick: () => void }) {
  const typeColor = socket.type === 'on' ? 'bg-teal-700' : socket.type === 'emit' ? 'bg-indigo-700' : 'bg-purple-700';
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 border-l-2 transition-colors hover:bg-slate-800 ${
        selected ? 'border-teal-400 bg-slate-800' : 'border-transparent'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 text-white ${typeColor}`}>
          {socket.type}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-white text-xs font-mono truncate">"{socket.event}"</div>
          <div className="text-slate-400 text-[10px] truncate">{socket.description}</div>
          <div className="text-slate-600 text-[9px] truncate mt-0.5">{socket.file}:{socket.line}</div>
        </div>
      </div>
    </button>
  );
}

// ── Model row ─────────────────────────────────────────────────────────────────
function ModelRow({ model, selected, onClick }: { model: DbModel; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 border-l-2 transition-colors hover:bg-slate-800 ${
        selected ? 'border-green-400 bg-slate-800' : 'border-transparent'
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-xs font-semibold">{model.name}</span>
          <span className={`text-[9px] font-medium capitalize ${DB_TYPE_COLORS[model.type] ?? 'text-slate-400'}`}>
            {model.type}
          </span>
        </div>
        {model.fields.length > 0 && (
          <div className="text-slate-500 text-[9px] mt-0.5 truncate">
            {model.fields.slice(0, 4).map(f => f.name).join(', ')}
            {model.fields.length > 4 ? ` +${model.fields.length - 4}` : ''}
          </div>
        )}
        {model.relations.length > 0 && (
          <div className="text-green-600 text-[9px] mt-0.5 truncate">
            → {model.relations.map(r => r.targetModel).join(', ')}
          </div>
        )}
        <div className="text-slate-600 text-[9px] mt-0.5 truncate">{model.file}</div>
      </div>
    </button>
  );
}

function Empty() {
  return <div className="px-3 py-3 text-slate-600 text-xs italic">None found</div>;
}
