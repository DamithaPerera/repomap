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

  // Frameworks
  if (allContent.includes('express')) tech.add('Express');
  if (allContent.includes('fastify')) tech.add('Fastify');
  if (/next['"]|next\//.test(allContent)) tech.add('Next.js');
  if (allContent.includes('nestjs') || allContent.includes('@nestjs')) tech.add('NestJS');
  if (allContent.includes('hapi') || allContent.includes('@hapi/hapi')) tech.add('Hapi');
  if (allContent.includes('koa') || allContent.includes('@koa/')) tech.add('Koa');
  if (allContent.includes('socket.io') || allContent.includes('socket\.io')) tech.add('Socket.io');
  if (allContent.includes('ws') && allContent.includes('WebSocket')) tech.add('WebSocket (ws)');
  if (allContent.includes('graphql')) tech.add('GraphQL');
  if (allContent.includes('trpc') || allContent.includes('@trpc/')) tech.add('tRPC');
  // SQL ORMs
  if (allContent.includes('mongoose')) tech.add('Mongoose');
  if (allContent.includes('prisma')) tech.add('Prisma');
  if (allContent.includes('sequelize')) tech.add('Sequelize');
  if (allContent.includes('typeorm')) tech.add('TypeORM');
  if (/drizzle-orm|pgTable|mysqlTable|sqliteTable/i.test(allContent)) tech.add('Drizzle ORM');
  if (/knex/i.test(allContent)) tech.add('Knex.js');
  if (/mikro-orm|MikroORM/i.test(allContent)) tech.add('MikroORM');
  if (/objection/i.test(allContent)) tech.add('Objection.js');
  if (/bookshelf/i.test(allContent)) tech.add('Bookshelf.js');
  if (/waterline/i.test(allContent)) tech.add('Waterline');
  // Relational
  if (allContent.includes('postgres') || allContent.includes('pg')) tech.add('PostgreSQL');
  if (allContent.includes('mysql')) tech.add('MySQL');
  if (/better-sqlite3|sqlite3|sql\.js/i.test(allContent)) tech.add('SQLite');
  if (/cockroachdb|cockroach|\.cockroachlabs\.com/i.test(allContent)) tech.add('CockroachDB');
  if (/@planetscale\/database/i.test(allContent)) tech.add('PlanetScale');
  if (/@libsql\/client|libsql:\/\//i.test(allContent)) tech.add('Turso/LibSQL');
  if (/@neondatabase\/serverless/i.test(allContent)) tech.add('Neon');
  if (/timescaledb|create_hypertable/i.test(allContent)) tech.add('TimescaleDB');
  // NoSQL / Document
  if (allContent.includes('mongodb') || /MongoClient/i.test(allContent)) tech.add('MongoDB');
  if (/dynamodb|@aws-sdk\/client-dynamodb|@aws-sdk\/lib-dynamodb/i.test(allContent)) tech.add('DynamoDB');
  if (/firebase|firestore|@firebase|firebase-admin/i.test(allContent)) tech.add('Firebase');
  if (/faunadb|@fauna-labs/i.test(allContent)) tech.add('FaunaDB');
  if (/@supabase\/supabase-js/i.test(allContent)) tech.add('Supabase');
  if (/\bnano\b.*couchdb|couchDB|nano\.db/i.test(allContent)) tech.add('CouchDB');
  if (/pouchdb|PouchDB/i.test(allContent)) tech.add('PouchDB');
  if (/cassandra-driver|@datastax/i.test(allContent)) tech.add('Cassandra');
  // Graph
  if (/neo4j|neo4j-driver|@neo4j/i.test(allContent)) tech.add('Neo4j');
  if (/arangojs|arangodb/i.test(allContent)) tech.add('ArangoDB');
  if (/orientjs|orientdb/i.test(allContent)) tech.add('OrientDB');
  if (/rethinkdb|rethinkdbdash/i.test(allContent)) tech.add('RethinkDB');
  // Key-Value / Cache
  if (/ioredis|['"`]redis['"`]/i.test(allContent)) tech.add('Redis');
  if (/@upstash\/redis/i.test(allContent)) tech.add('Upstash Redis');
  if (/levelup|leveldown|\blevel\b/i.test(allContent)) tech.add('LevelDB');
  // Search / Analytics
  if (/@elastic\/elasticsearch|elasticsearch/i.test(allContent)) tech.add('Elasticsearch');
  if (/@influxdata\/influxdb-client|influx/i.test(allContent)) tech.add('InfluxDB');
  if (/@clickhouse\/client|clickhouse/i.test(allContent)) tech.add('ClickHouse');
  // In-memory / Embedded
  if (/lokijs|loki\.js|new\s+Loki\s*\(/i.test(allContent)) tech.add('LokiJS');

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
