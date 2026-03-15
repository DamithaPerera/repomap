'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ProjectAnalysis } from '@/types/analysis';
import { StatsBar } from '@/components/ui/StatsBar';

// Dynamically import graph (client only, no SSR — ReactFlow requirement)
const RepoGraph = dynamic(
  () => import('@/components/graph/RepoGraph').then((m) => m.RepoGraph),
  { ssr: false }
);

const EXAMPLE_REPOS = [
  'https://github.com/expressjs/express',
  'https://github.com/gothinkster/node-express-realworld-example-app',
];

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">R</div>
        <span className="text-white font-bold text-lg tracking-tight">RepoMap</span>
        <span className="text-slate-500 text-sm">— Visual API & DB explorer</span>
        {analysis && (
          <button
            onClick={() => { setAnalysis(null); setUrl(''); setError(null); }}
            className="ml-auto text-slate-400 hover:text-white text-sm transition-colors"
          >
            ← New repo
          </button>
        )}
      </header>

      {!analysis ? (
        /* ── Landing ── */
        <main className="flex-1 flex flex-col items-center justify-center px-4 gap-10">
          <div className="text-center space-y-3 max-w-2xl">
            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
              Understand any repo<br />
              <span className="text-indigo-400">at a glance</span>
            </h1>
            <p className="text-slate-400 text-lg">
              Paste a public GitHub URL to instantly visualize all APIs, WebSocket events,
              and database models — with their relationships mapped as an interactive graph.
            </p>
          </div>

          {/* Input */}
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
                {loading ? (
                  <>
                    <Spinner />
                    Analyzing…
                  </>
                ) : (
                  'Analyze'
                )}
              </button>
            </div>

            {error && (
              <div className="bg-red-950/50 border border-red-500/30 text-red-300 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {/* Examples */}
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

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 max-w-lg">
            {[
              '🔍 REST & Next.js APIs',
              '⚡ WebSocket events',
              '🗄️ Mongoose / Prisma / Sequelize',
              '🔗 API → DB relations',
              '📊 Interactive graph',
            ].map((f) => (
              <span key={f} className="bg-slate-800 border border-white/10 text-slate-400 text-xs px-3 py-1.5 rounded-full">
                {f}
              </span>
            ))}
          </div>
        </main>
      ) : (
        /* ── Result view ── */
        <div className="flex-1 flex flex-col min-h-0" style={{ height: 'calc(100vh - 65px)' }}>
          <StatsBar analysis={analysis} />
          <div className="flex-1 min-h-0">
            <RepoGraph analysis={analysis} />
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
