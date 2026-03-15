'use client';

import { ProjectAnalysis } from '@/types/analysis';

interface Props {
  analysis: ProjectAnalysis;
}

export function StatsBar({ analysis }: Props) {
  const { apis, sockets, models, tech, summary, projectName } = analysis;

  return (
    <div className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm px-6 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Project info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-base truncate">{projectName}</span>
            <a
              href={analysis.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white text-xs transition-colors flex-shrink-0"
            >
              ↗ repo
            </a>
          </div>
          <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{summary}</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <StatPill count={apis.length} label="APIs" color="bg-indigo-500/20 text-indigo-300 border-indigo-500/30" />
          <StatPill count={sockets.length} label="Sockets" color="bg-teal-500/20 text-teal-300 border-teal-500/30" />
          <StatPill count={models.length} label="Models" color="bg-green-500/20 text-green-300 border-green-500/30" />
        </div>

        {/* Tech stack */}
        {tech.length > 0 && (
          <div className="flex flex-wrap gap-1 flex-shrink-0 max-w-xs">
            {tech.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px] border border-white/10"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${color}`}>
      <span className="font-bold">{count}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}
