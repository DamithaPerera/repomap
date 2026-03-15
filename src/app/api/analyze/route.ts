import { NextRequest, NextResponse } from 'next/server';
import { analyzeRepository } from '@/lib/analyzer';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Repository URL is required.' }, { status: 400 });
    }

    const analysis = await analyzeRepository(url);
    return NextResponse.json(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
