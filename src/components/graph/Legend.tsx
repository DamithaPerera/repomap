'use client';

export function Legend() {
  return (
    <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 border border-white/10 rounded-lg px-4 py-3 text-xs space-y-2 backdrop-blur-sm">
      <div className="text-slate-400 font-semibold mb-1">Legend</div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-indigo-500"></div>
        <span className="text-slate-300">API Endpoint</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-teal-500"></div>
        <span className="text-slate-300">Socket Event</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-green-600"></div>
        <span className="text-slate-300">Database Model</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 border-t-2 border-indigo-400 border-dashed"></div>
        <span className="text-slate-300">API → DB</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 border-t-2 border-green-400 border-dashed"></div>
        <span className="text-slate-300">DB Relation</span>
      </div>
    </div>
  );
}
