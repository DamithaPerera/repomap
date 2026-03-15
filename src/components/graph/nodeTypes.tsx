'use client';

import { Handle, Position, NodeProps } from 'reactflow';

// ── API Node ──────────────────────────────────────────────────────────────────
export function ApiNode({ data, selected }: NodeProps) {
  const methodColors: Record<string, string> = {
    GET: 'bg-green-500',
    POST: 'bg-blue-500',
    PUT: 'bg-yellow-500',
    PATCH: 'bg-orange-400',
    DELETE: 'bg-red-500',
    ALL: 'bg-purple-500',
    USE: 'bg-gray-500',
  };
  const color = methodColors[data.method] ?? 'bg-gray-500';

  return (
    <div
      className={`rounded-lg border-2 shadow-lg min-w-[180px] max-w-[240px] transition-all ${
        selected ? 'border-white shadow-white/30' : 'border-white/20'
      } bg-slate-800`}
    >
      <div className={`${color} rounded-t-md px-3 py-1 flex items-center gap-2`}>
        <span className="text-white text-xs font-bold">{data.method}</span>
        {data.auth && (
          <span className="text-yellow-200 text-xs ml-auto" title="Auth required">🔒</span>
        )}
      </div>
      <div className="px-3 py-2">
        <div className="text-white text-xs font-mono truncate" title={data.path}>
          {data.path}
        </div>
        <div className="text-slate-400 text-[10px] mt-1 truncate" title={data.description}>
          {data.description}
        </div>
        <div className="text-slate-500 text-[9px] mt-1 truncate">{data.file}</div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-blue-400" />
      <Handle type="target" position={Position.Left} className="!bg-blue-400" />
    </div>
  );
}

// ── Socket Node ───────────────────────────────────────────────────────────────
export function SocketNode({ data, selected }: NodeProps) {
  const typeColors: Record<string, string> = {
    on: 'bg-teal-600',
    emit: 'bg-indigo-600',
    broadcast: 'bg-purple-700',
  };
  const color = typeColors[data.type] ?? 'bg-gray-600';

  return (
    <div
      className={`rounded-lg border-2 shadow-lg min-w-[160px] max-w-[220px] transition-all ${
        selected ? 'border-white shadow-white/30' : 'border-white/20'
      } bg-slate-800`}
    >
      <div className={`${color} rounded-t-md px-3 py-1 flex items-center gap-2`}>
        <span className="text-white text-xs">⚡</span>
        <span className="text-white text-xs font-bold uppercase">{data.type}</span>
      </div>
      <div className="px-3 py-2">
        <div className="text-white text-xs font-mono truncate" title={data.event}>
          "{data.event}"
        </div>
        <div className="text-slate-400 text-[10px] mt-1 truncate">{data.description}</div>
        <div className="text-slate-500 text-[9px] mt-1 truncate">{data.file}</div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-teal-400" />
      <Handle type="target" position={Position.Left} className="!bg-teal-400" />
    </div>
  );
}

// ── DB Model Node ─────────────────────────────────────────────────────────────
export function DbNode({ data, selected }: NodeProps) {
  const typeColors: Record<string, string> = {
    mongoose: 'bg-green-700',
    prisma: 'bg-blue-700',
    sequelize: 'bg-cyan-700',
    typeorm: 'bg-orange-700',
    drizzle: 'bg-yellow-700',
    dynamodb: 'bg-amber-700',
    neo4j: 'bg-teal-700',
    firebase: 'bg-orange-600',
    redis: 'bg-red-700',
    elasticsearch: 'bg-yellow-600',
    // SQL ORMs
    knex: 'bg-sky-700',
    'mikro-orm': 'bg-violet-700',
    objection: 'bg-pink-700',
    bookshelf: 'bg-rose-700',
    waterline: 'bg-indigo-700',
    // NoSQL
    couchdb: 'bg-red-800',
    cassandra: 'bg-blue-800',
    mongodb: 'bg-green-800',
    fauna: 'bg-purple-800',
    supabase: 'bg-emerald-700',
    pouchdb: 'bg-orange-800',
    // Time-series / Analytics
    influxdb: 'bg-cyan-800',
    timescaledb: 'bg-sky-800',
    clickhouse: 'bg-yellow-800',
    // Multi-model / Graph
    arangodb: 'bg-teal-800',
    orientdb: 'bg-lime-800',
    rethinkdb: 'bg-pink-800',
    cockroachdb: 'bg-slate-700',
    // Cloud / Hosted
    planetscale: 'bg-purple-700',
    turso: 'bg-amber-800',
    neon: 'bg-green-600',
    upstash: 'bg-red-600',
    // Embedded / Local
    sqlite: 'bg-stone-600',
    leveldb: 'bg-zinc-700',
    loki: 'bg-fuchsia-700',
    // Other
    raw: 'bg-gray-700',
    unknown: 'bg-gray-600',
  };
  const color = typeColors[data.dbType] ?? 'bg-gray-600';

  return (
    <div
      className={`rounded-lg border-2 shadow-lg min-w-[160px] max-w-[220px] transition-all ${
        selected ? 'border-white shadow-white/30' : 'border-white/20'
      } bg-slate-800`}
    >
      <div className={`${color} rounded-t-md px-3 py-1 flex items-center gap-2`}>
        <span className="text-white text-xs">🗄️</span>
        <span className="text-white text-xs font-bold capitalize">{data.dbType}</span>
      </div>
      <div className="px-3 py-2">
        <div className="text-white text-sm font-semibold">{data.label}</div>
        {data.fields?.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {data.fields.slice(0, 5).map((f: { name: string; fieldType: string }) => (
              <div key={f.name} className="flex gap-1 text-[10px]">
                <span className="text-slate-300">{f.name}</span>
                <span className="text-slate-500">{f.fieldType}</span>
              </div>
            ))}
            {data.fields.length > 5 && (
              <div className="text-slate-500 text-[10px]">+{data.fields.length - 5} more</div>
            )}
          </div>
        )}
        <div className="text-slate-500 text-[9px] mt-1 truncate">{data.file}</div>
      </div>
      <Handle type="target" position={Position.Left} className="!bg-green-400" />
      <Handle type="source" position={Position.Right} className="!bg-green-400" />
    </div>
  );
}
