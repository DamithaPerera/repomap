import { ApiEndpoint, HttpMethod } from '@/types/analysis';
import { FileEntry } from './fileWalker';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ALL', 'USE'];

// Matches: router.get('/path', ...) or app.post('/path', ...)
const EXPRESS_ROUTE_REGEX =
  /(?:router|app|server)\s*\.\s*(get|post|put|patch|delete|all|use)\s*\(\s*(['"`])([^'"`]+)\2/gi;

// Matches: @Get('/path'), @Post('/path') etc (NestJS / decorators)
const DECORATOR_ROUTE_REGEX =
  /@(Get|Post|Put|Patch|Delete|All)\s*\(\s*(['"`])([^'"`]*)\2\s*\)/gi;

// Next.js App Router: export async function GET(request
const NEXTJS_HANDLER_REGEX =
  /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g;

// auth heuristics
const AUTH_PATTERNS = [
  /auth/i, /middleware/i, /protected/i, /guard/i, /jwt/i, /token/i, /verify/i, /passport/i,
];

let idCounter = 0;
function makeId(prefix: string) {
  return `${prefix}_${++idCounter}`;
}

function detectAuth(content: string, line: number): boolean {
  const lines = content.split('\n');
  // look in surrounding 10 lines
  const start = Math.max(0, line - 5);
  const end = Math.min(lines.length, line + 10);
  const snippet = lines.slice(start, end).join('\n');
  return AUTH_PATTERNS.some((p) => p.test(snippet));
}

function extractParams(path: string): string[] {
  const matches = path.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}

function describeEndpoint(method: string, path: string): string {
  const m = method.toUpperCase();
  const resource = path.split('/').filter(Boolean).pop() || path;
  const descriptions: Record<string, string> = {
    GET: `Retrieve ${resource}`,
    POST: `Create ${resource}`,
    PUT: `Update ${resource}`,
    PATCH: `Partially update ${resource}`,
    DELETE: `Delete ${resource}`,
    ALL: `Handle all methods for ${resource}`,
    USE: `Middleware for ${resource}`,
  };
  return descriptions[m] ?? `${m} ${path}`;
}

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

export function detectApis(files: FileEntry[]): ApiEndpoint[] {
  idCounter = 0;
  const apis: ApiEndpoint[] = [];

  for (const file of files) {
    const { content, relativePath } = file;

    // Express / Fastify routes
    let match: RegExpExecArray | null;
    EXPRESS_ROUTE_REGEX.lastIndex = 0;
    while ((match = EXPRESS_ROUTE_REGEX.exec(content)) !== null) {
      const method = match[1].toUpperCase() as HttpMethod;
      const routePath = match[3];
      const line = getLineNumber(content, match.index);
      apis.push({
        id: makeId('api'),
        method,
        path: routePath,
        file: relativePath,
        line,
        description: describeEndpoint(method, routePath),
        params: extractParams(routePath),
        dbOperations: [],
        auth: detectAuth(content, line),
      });
    }

    // NestJS decorators
    DECORATOR_ROUTE_REGEX.lastIndex = 0;
    while ((match = DECORATOR_ROUTE_REGEX.exec(content)) !== null) {
      const method = match[1].toUpperCase() as HttpMethod;
      const routePath = match[3];
      const line = getLineNumber(content, match.index);
      apis.push({
        id: makeId('api'),
        method,
        path: routePath || '/',
        file: relativePath,
        line,
        description: describeEndpoint(method, routePath || '/'),
        params: extractParams(routePath),
        dbOperations: [],
        auth: detectAuth(content, line),
      });
    }

    // Next.js App Router handlers
    NEXTJS_HANDLER_REGEX.lastIndex = 0;
    while ((match = NEXTJS_HANDLER_REGEX.exec(content)) !== null) {
      const method = match[1] as HttpMethod;
      // infer path from file path: app/api/users/route.ts -> /api/users
      const routePath = '/' + relativePath
        .replace(/^src\//, '')
        .replace(/^app\//, '')
        .replace(/\/route\.(ts|tsx|js|jsx)$/, '')
        .replace(/\\/g, '/');
      const line = getLineNumber(content, match.index);
      apis.push({
        id: makeId('api'),
        method,
        path: routePath,
        file: relativePath,
        line,
        description: describeEndpoint(method, routePath),
        params: extractParams(routePath),
        dbOperations: [],
        auth: detectAuth(content, line),
      });
    }
  }

  return apis;
}
