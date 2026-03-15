import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { ProjectAnalysis } from '@/types/analysis';
import { walkFiles } from './fileWalker';
import { detectApis } from './apiDetector';
import { detectSockets } from './socketDetector';
import { detectDbModels } from './dbDetector';
import { mapRelationships } from './relationMapper';

function getTempDir(): string {
  return path.join(os.tmpdir(), 'repomap-clones');
}

function sanitizeRepoUrl(url: string): string {
  // Allow only github/gitlab/bitbucket HTTPS URLs
  const allowed = /^https:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/[\w.\-]+\/[\w.\-]+(\.git)?$/i;
  if (!allowed.test(url.trim())) {
    throw new Error('Only public GitHub, GitLab, or Bitbucket HTTPS URLs are supported.');
  }
  return url.trim().replace(/\.git$/, '');
}

function getProjectName(url: string): string {
  return url.split('/').pop()?.replace(/\.git$/, '') ?? 'unknown';
}

function detectTech(files: { relativePath: string; content: string }[]): string[] {
  const tech = new Set<string>();
  const allContent = files.map((f) => f.content).join('\n');

  if (allContent.includes('express')) tech.add('Express');
  if (allContent.includes('fastify')) tech.add('Fastify');
  if (/next['"]|next\//.test(allContent)) tech.add('Next.js');
  if (allContent.includes('nestjs') || allContent.includes('@nestjs')) tech.add('NestJS');
  if (allContent.includes('mongoose')) tech.add('Mongoose');
  if (allContent.includes('prisma')) tech.add('Prisma');
  if (allContent.includes('sequelize')) tech.add('Sequelize');
  if (allContent.includes('typeorm')) tech.add('TypeORM');
  if (allContent.includes('socket.io') || allContent.includes('socket\.io')) tech.add('Socket.io');
  if (allContent.includes('ws') && allContent.includes('WebSocket')) tech.add('WebSocket (ws)');
  if (allContent.includes('graphql')) tech.add('GraphQL');
  if (allContent.includes('redis')) tech.add('Redis');
  if (allContent.includes('mongodb')) tech.add('MongoDB');
  if (/dynamodb|@aws-sdk\/client-dynamodb|@aws-sdk\/lib-dynamodb/i.test(allContent)) tech.add('DynamoDB');
  if (allContent.includes('postgres') || allContent.includes('pg')) tech.add('PostgreSQL');
  if (allContent.includes('mysql')) tech.add('MySQL');
  if (allContent.includes('sqlite')) tech.add('SQLite');

  return Array.from(tech);
}

function generateSummary(
  projectName: string,
  tech: string[],
  apiCount: number,
  socketCount: number,
  modelCount: number
): string {
  const parts: string[] = [];
  if (tech.length) parts.push(`Built with ${tech.slice(0, 4).join(', ')}.`);
  if (apiCount) parts.push(`Exposes ${apiCount} API endpoint${apiCount !== 1 ? 's' : ''}.`);
  if (socketCount) parts.push(`Uses ${socketCount} WebSocket event${socketCount !== 1 ? 's' : ''}.`);
  if (modelCount) parts.push(`Has ${modelCount} database model${modelCount !== 1 ? 's' : ''}.`);
  return parts.length ? parts.join(' ') : `${projectName} project.`;
}

export async function analyzeRepository(repoUrl: string): Promise<ProjectAnalysis> {
  const cleanUrl = sanitizeRepoUrl(repoUrl);
  const projectName = getProjectName(cleanUrl);
  const tempBase = getTempDir();
  const cloneDir = path.join(tempBase, `${projectName}-${Date.now()}`);

  try {
    // Ensure temp dir exists
    fs.mkdirSync(tempBase, { recursive: true });

    // Clone (shallow, no history)
    execSync(`git clone --depth 1 "${cleanUrl}.git" "${cloneDir}"`, {
      timeout: 60000,
      stdio: 'pipe',
    });

    // Walk and analyze
    const files = walkFiles(cloneDir);

    if (files.length === 0) {
      throw new Error('No supported source files found in this repository.');
    }

    const apis = detectApis(files);
    const sockets = detectSockets(files);
    const models = detectDbModels(files);
    const apiModelEdges = mapRelationships(apis, models, files);
    const tech = detectTech(files);

    return {
      repoUrl: cleanUrl,
      projectName,
      summary: generateSummary(projectName, tech, apis.length, sockets.length, models.length),
      tech,
      apis,
      sockets,
      models,
      apiModelEdges,
    };
  } finally {
    // Clean up cloned repo
    try {
      fs.rmSync(cloneDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}
