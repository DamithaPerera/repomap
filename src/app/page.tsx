'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ProjectAnalysis } from '@/types/analysis';
import { StatsBar } from '@/components/ui/StatsBar';
import { ListView } from '@/components/ui/ListView';

const RepoGraph = dynamic(
  () => import('@/components/graph/RepoGraph').then((m) => m.RepoGraph),
  { ssr: false }
);

const EXAMPLE_REPOS = [
  'https://github.com/expressjs/express',
  'https://github.com/gothinkster/node-express-realworld-example-app',
];

type ViewMode = 'split' | 'graph' | 'list';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  async function handleAnalyze(repoUrl?: string) {
    const target = repoUrl ?? url;
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    if (repoUrl) setUrl(repoUrl);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
      setAnalysis(data);
      setSelectedNodeId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="border-b border-white/10 px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center text-white font-bold text-xs">R</div>
        <span className="text-white font-bold tracking-tight">RepoMap</span>
        <span className="text-slate-500 text-xs hidden sm:block">Visual API & DB explorer</span>

        {analysis && (
          <>
            {/* View toggle */}
            <div className="ml-auto flex items-center bg-slate-800 rounded-lg p-0.5 gap-0.5">
              {(['split', 'list', 'graph'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors capitalize ${
                    viewMode === mode
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mode === 'split' ? '⊞ Split' : mode === 'list' ? '☰ List' : '◈ Graph'}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setAnalysis(null); setUrl(''); setError(null); }}
              className="text-slate-400 hover:text-white text-xs transition-colors"
            >
              ← New repo
            </button>
          </>
        )}
      </header>

      {!analysis ? (
        /* ── Landing ── */
        <main className="flex-1 flex flex-col items-center justify-center px-4 gap-8 overflow-auto">
          <div className="text-center space-y-2 max-w-2xl">
            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
              Understand any repo<br />
              <span className="text-indigo-400">at a glance</span>
            </h1>
            <p className="text-slate-400 text-base">
              Paste a public GitHub URL to instantly visualize all APIs, WebSocket events,
              and database models — with their relationships mapped as an interactive graph.
            </p>
          </div>

          <div className="w-full max-w-xl space-y-3">
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                placeholder="https://github.com/owner/repo"
                className="flex-1 bg-slate-800 border border-white/10 text-white placeholder-slate-500 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                onClick={() => handleAnalyze()}
                disabled={loading || !url.trim()}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
              >
                {loading ? <><Spinner /> Analyzing…</> : 'Analyze'}
              </button>
            </div>

            {error && (
              <div className="bg-red-950/50 border border-red-500/30 text-red-300 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-slate-600 text-xs">Try:</span>
              {EXAMPLE_REPOS.map((repo) => (
                <button
                  key={repo}
                  onClick={() => handleAnalyze(repo)}
                  disabled={loading}
                  className="text-slate-400 hover:text-indigo-400 text-xs transition-colors disabled:opacity-50 underline underline-offset-2"
                >
                  {repo.replace('https://github.com/', '')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 max-w-lg">
            {['🔍 REST & Next.js APIs', '⚡ WebSocket events', '🗄️ Mongoose / Prisma / Sequelize', '🔗 API → DB relations', '📊 Interactive graph'].map((f) => (
              <span key={f} className="bg-slate-800 border border-white/10 text-slate-400 text-xs px-3 py-1.5 rounded-full">{f}</span>
            ))}
          </div>
        </main>
      ) : (
        /* ── Result view ── */
        <div className="flex-1 flex flex-col min-h-0">
          <StatsBar analysis={analysis} />
          <div className="flex-1 flex min-h-0">

            {/* List panel */}
            {(viewMode === 'split' || viewMode === 'list') && (
              <div className={viewMode === 'list' ? 'w-full' : 'w-80 flex-shrink-0'}>
                <ListView
                  analysis={analysis}
                  selectedNodeId={selectedNodeId}
                  onSelect={(id) => {
                    setSelectedNodeId(id);
                    if (viewMode === 'list') setViewMode('split');
                  }}
                />
              </div>
            )}

            {/* Graph panel */}
            {(viewMode === 'split' || viewMode === 'graph') && (
              <div className="flex-1 min-w-0 min-h-0">
                <RepoGraph
                  analysis={analysis}
                  focusNodeId={selectedNodeId}
                  onNodeSelect={setSelectedNodeId}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}
