import { ApiEndpoint, HttpMethod } from '@/types/analysis';
import { FileEntry } from './fileWalker';

const EXPRESS_ROUTE_REGEX =
  /(?:router|app|server)\s*\.\s*(get|post|put|patch|delete|all|use)\s*\(\s*(['"`])([^'"`]+)\2/gi;

const DECORATOR_ROUTE_REGEX =
  /@(Get|Post|Put|Patch|Delete|All)\s*\(\s*(['"`])([^'"`]*)\2\s*\)/gi;

const NEXTJS_HANDLER_REGEX =
  /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g;

const AUTH_PATTERNS = [
  /auth/i, /middleware/i, /protected/i, /guard/i, /jwt/i, /token/i, /verify/i, /passport/i,
];

let idCounter = 0;
function makeId(p: string) { return `${p}_${++idCounter}`; }

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function detectAuth(content: string, line: number): boolean {
  const lines = content.split('\n');
  const snippet = lines.slice(Math.max(0, line - 5), Math.min(lines.length, line + 10)).join('\n');
  return AUTH_PATTERNS.some((p) => p.test(snippet));
}

function extractParams(path: string): string[] {
  const m = path.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
  return m ? m.map((s) => s.slice(1)) : [];
}

function humanize(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ─── Extract the comment/JSDoc immediately above a match ─────────────────────
function extractCommentAbove(content: string, matchIndex: number): string {
  const before = content.slice(0, matchIndex);
  const lines = before.split('\n');
  const out: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim();
    if (!l) { if (out.length) break; continue; }
    if (l.startsWith('//')) { out.unshift(l.replace(/^\/\/\s*/, '')); continue; }
    if (l.startsWith('*') || l.startsWith('/**') || l.startsWith('*/')) {
      const t = l.replace(/^[/*\s]+/, '').replace(/[/*\s]+$/, '');
      if (t && !t.startsWith('@')) out.unshift(t);
      if (l.startsWith('/**') || l === '/**') break;
      continue;
    }
    break;
  }
  const text = out.join(' ').trim();
  return text.length > 3 && text.length < 120 ? text : '';
}

// ─── Extract the NestJS controller method name ────────────────────────────────
function extractNestMethodName(content: string, matchIndex: number): string {
  const slice = content.slice(matchIndex, matchIndex + 400);
  const m = slice.match(/\)\s*\n+\s*(?:async\s+)?(\w+)\s*\(/);
  if (m && m[1] !== 'function') return humanize(m[1]);
  return '';
}

// ─── Extract the last named Express handler callback ─────────────────────────
function extractExpressHandlerName(content: string, matchIndex: number): string {
  const slice = content.slice(matchIndex, matchIndex + 400);
  const SKIP = new Set(['req', 'res', 'next', 'async', 'function', 'null', 'undefined', 'err', 'error']);
  const args = [...slice.matchAll(/,\s*(?:async\s+)?(\w+)\s*[,)]/g)];
  for (let i = args.length - 1; i >= 0; i--) {
    const fn = args[i][1].trim();
    if (fn && !SKIP.has(fn) && /^[a-zA-Z]/.test(fn)) return humanize(fn);
  }
  return '';
}

// ─── Extract complete function body using brace matching ─────────────────────
function extractFunctionBody(content: string, matchIndex: number): string {
  const slice = content.slice(matchIndex, matchIndex + 8000);
  let depth = 0;
  let started = false;
  let start = 0;
  for (let i = 0; i < slice.length; i++) {
    if (slice[i] === '{') {
      if (!started) { started = true; start = i; }
      depth++;
    } else if (slice[i] === '}' && started) {
      depth--;
      if (depth === 0) return slice.slice(start, i + 1);
    }
  }
  return slice.slice(0, 2000);
}

// ─── Infer resource name from path or body ───────────────────────────────────
function inferResourceFromPath(path: string): string {
  const SKIP = new Set(['api', 'v1', 'v2', 'v3', 'index', '']);
  const segs = path.split('/');
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i].replace(/[:{}[\]]/g, '').toLowerCase();
    if (s && !SKIP.has(s) && !/^\d+$/.test(s)) {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
  }
  return 'resource';
}

// ─── Core: extract business intent from the function body ────────────────────
function describeBusinessLogic(
  method: string,
  path: string,
  body: string,
  handlerName: string,
): string {
  // ── Specific business flows (checked first — most accurate) ──

  // Auth flows
  if (/\blogin\b|\bsignIn\b|\.login\s*\(/i.test(body)) {
    const hasJwt = /jwt\.sign|generateToken|accessToken/i.test(body);
    const hasSession = /req\.session|session\.save/i.test(body);
    return hasJwt
      ? 'Authenticate user credentials and return JWT token'
      : hasSession
      ? 'Authenticate user and create session'
      : 'Authenticate user and return access token';
  }

  if (/\bregister\b|\bsignUp\b|\bcreateUser\b|\bcreateAccount\b/i.test(body)) {
    const hasEmail = /sendMail|verificationEmail|confirmEmail/i.test(body);
    const hasHash = /bcrypt\.hash|hashPassword/i.test(body);
    return `Register new user account${hasHash ? ', hash password' : ''}${hasEmail ? ' and send verification email' : ''}`;
  }

  if (/\blogout\b|\bsignOut\b|\binvalidateToken\b|\bclearToken\b/i.test(body)) {
    return 'Logout user and invalidate session or token';
  }

  if (/resetPassword|forgotPassword|changePassword|updatePassword/i.test(body)) {
    const hasSendEmail = /sendMail|\.send\s*\(|emailService/i.test(body);
    return hasSendEmail
      ? 'Send password reset link to user email'
      : 'Reset or update user password';
  }

  if (/verifyEmail|confirmEmail|activateAccount|emailVerif/i.test(body)) {
    return 'Verify email address and activate user account';
  }

  if (/refreshToken|renewToken|rotateToken/i.test(body)) {
    return 'Refresh and reissue access token';
  }

  // Payment / billing
  if (/stripe\.|paypal\.|braintree\.|payment\.|checkout\./i.test(body)) {
    if (/webhook|event\.type/i.test(body)) return 'Handle payment webhook from Stripe/PayPal';
    if (/refund/i.test(body)) return 'Process refund for a transaction';
    if (/subscription|subscribe/i.test(body)) return 'Create or manage subscription plan';
    if (/checkout|session\.create/i.test(body)) return 'Create checkout session for payment';
    return 'Process payment transaction';
  }

  // File operations
  if (/multer|upload\.|\.single\s*\(|\.array\s*\(/i.test(body)) {
    const hasS3 = /s3\.|putObject|\.upload\s*\(/i.test(body);
    return hasS3 ? 'Upload file to S3 storage' : 'Handle file upload from client';
  }
  if (/s3\.|getObject|presignedUrl|signedUrl/i.test(body)) {
    return 'Generate pre-signed URL or download file from S3';
  }
  if (/res\.download|res\.sendFile|\.pipe\s*\(res\)/i.test(body)) {
    return 'Stream or send file to client';
  }

  // Email / notifications
  if (/sendMail|transporter\.|nodemailer|emailService|\.send\s*\(/i.test(body)) {
    const hasTemplate = /template|html|subject/i.test(body);
    return hasTemplate ? 'Send templated email to user' : 'Send email notification';
  }
  if (/twilio|sms\.send|sendSMS/i.test(body)) {
    return 'Send SMS notification via Twilio';
  }
  if (/fcm\.|push\.send|apns\.|expo\.sendPush|notify\./i.test(body)) {
    return 'Send push notification to device';
  }
  if (/slack\.|discord\.|telegram\./i.test(body)) {
    return 'Send message to Slack/Discord/Telegram';
  }

  // Search
  if (/\.search\s*\(|elasticsearch|solr|typesense|meilisearch/i.test(body)) {
    const resource = inferResourceFromPath(path);
    return `Search ${resource} with filters`;
  }

  // Export / reports
  if (/csv|xlsx|pdf|\.writeFile|exceljs|pdfkit|puppeteer/i.test(body)) {
    const resource = inferResourceFromPath(path);
    return `Export ${resource} as CSV/PDF report`;
  }

  // OAuth / social auth
  if (/google\.|facebook\.|github\.|\boauth\b|passport\.authenticate/i.test(body)) {
    return 'OAuth social login / third-party authentication';
  }

  // Token / API key management
  if (/apiKey|api_key|generateApiKey/i.test(body)) {
    return 'Generate or rotate API key';
  }
  if (/jwt\.verify|verifyToken|validateToken/i.test(body)) {
    return 'Validate and decode JWT token';
  }

  // Background jobs / scheduling
  if (/queue\.|bull\.|agenda\.|cron\.|schedule\./i.test(body)) {
    return 'Enqueue background job or schedule task';
  }

  // Webhook handling
  if (/webhook|\.rawBody|signature/i.test(body)) {
    return 'Handle incoming webhook event';
  }

  // Health / status
  if (/health|ping|status|alive|ready/i.test(path.toLowerCase())) {
    return 'Health check — returns service status';
  }

  // ── Now analyse what data flows in/out for CRUD ──

  // What fields come in via req.body
  const bodyDestructure = body.match(
    /const\s*\{([^}]{0,200})\}\s*=\s*(?:req|request)\.body/
  );
  const inputFields = bodyDestructure?.[1]
    ?.split(',')
    .map((f) => f.trim().split(/[=:]/)[0].trim())
    .filter((f) => f && /^[a-zA-Z]/.test(f) && f.length < 25)
    .slice(0, 4);

  // What service method is called
  const serviceCall = body.match(
    /(?:this\.|await\s+)?(\w+(?:Service|Repository|Manager|Helper|UseCase|Interactor))\s*\.\s*(\w+)\s*\(/i
  );

  // What goes back to client
  const responseMatch = body.match(/res\s*\.\s*(?:json|send)\s*\(\s*\{([^}]{0,150})\}/);
  const returnFields = responseMatch?.[1]
    ?.match(/\b([a-zA-Z]\w{2,20})\b/g)
    ?.filter(
      (f) =>
        !['res', 'req', 'null', 'true', 'false', 'undefined', 'new', 'await',
          'return', 'status', 'message', 'success', 'error', 'data'].includes(f)
    )
    .slice(0, 3);

  // Does it paginate?
  const paginates = /\b(?:page|limit|offset|skip|take|cursor)\b/i.test(body);
  // Does it filter?
  const filters = /\bwhere\b|\bfilter\b|\bquery\b/i.test(body);

  // ── Build sentence from signals ──

  // Service call is highly descriptive
  if (serviceCall) {
    const service = serviceCall[1].replace(/Service|Repository|Manager|UseCase/i, '').toLowerCase();
    const action = humanize(serviceCall[2]);
    const extra: string[] = [];
    if (paginates) extra.push('with pagination');
    if (returnFields?.length) extra.push(`returns ${returnFields.join(', ')}`);
    return `${action} ${service}${extra.length ? ` (${extra.join(', ')})` : ''}`;
  }

  // Handler name + enrichment
  if (handlerName) {
    const extra: string[] = [];
    if (paginates) extra.push('paginated');
    if (filters) extra.push('filtered');
    if (/sendMail|email/i.test(body)) extra.push('sends email');
    if (/jwt\.sign|generateToken/i.test(body)) extra.push('returns token');
    if (inputFields?.length) extra.push(`accepts ${inputFields.slice(0, 2).join(', ')}`);
    return handlerName + (extra.length ? ` — ${extra.join(', ')}` : '');
  }

  // CRUD with enriched context
  const m = method.toUpperCase();
  const resource = inferResourceFromPath(path);
  const extra: string[] = [];
  if (paginates) extra.push('paginated');
  if (filters) extra.push('filtered');
  if (inputFields?.length) extra.push(`with ${inputFields.slice(0, 2).join(', ')}`);
  if (returnFields?.length && !['id', 'ok'].includes(returnFields[0])) extra.push(`returns ${returnFields.join(', ')}`);

  const base: Record<string, string> = {
    GET: `Fetch ${resource} list`,
    POST: `Create new ${resource}`,
    PUT: `Replace ${resource} by ID`,
    PATCH: `Update ${resource} fields`,
    DELETE: `Delete ${resource} by ID`,
    ALL: `Handle all methods for ${resource}`,
    USE: `Middleware — ${resource}`,
  };

  // If path ends with a param, it's a single-item operation
  if (/:[a-zA-Z]/.test(path.split('/').pop() ?? '')) {
    base.GET = `Fetch ${resource} by ID`;
  }

  const sentence = base[m] ?? `${m} ${resource}`;
  return extra.length ? `${sentence} (${extra.join(', ')})` : sentence;
}

// Exported so the orchestrator can pass bodies to the LLM enricher
export interface ApiWithBody extends ApiEndpoint {
  _body?: string;
}

// ─── Main export ─────────────────────────────────────────────────────────────
export function detectApis(files: FileEntry[]): ApiWithBody[] {
  idCounter = 0;
  const apis: ApiWithBody[] = [];

  for (const file of files) {
    const { content, relativePath } = file;
    let match: RegExpExecArray | null;

    // ── Express / Fastify ──
    EXPRESS_ROUTE_REGEX.lastIndex = 0;
    while ((match = EXPRESS_ROUTE_REGEX.exec(content)) !== null) {
      const method = match[1].toUpperCase() as HttpMethod;
      const routePath = match[3];
      const line = getLineNumber(content, match.index);
      const comment = extractCommentAbove(content, match.index);
      const handlerName = extractExpressHandlerName(content, match.index);
      const body = extractFunctionBody(content, match.index);
      const description = comment || describeBusinessLogic(method, routePath, body, handlerName);
      apis.push({
        id: makeId('api'), method, path: routePath, file: relativePath, line,
        description, params: extractParams(routePath), dbOperations: [],
        auth: detectAuth(content, line), _body: body,
      });
    }

    // ── NestJS decorators ──
    DECORATOR_ROUTE_REGEX.lastIndex = 0;
    while ((match = DECORATOR_ROUTE_REGEX.exec(content)) !== null) {
      const method = match[1].toUpperCase() as HttpMethod;
      const routePath = match[3] || '/';
      const line = getLineNumber(content, match.index);
      const comment = extractCommentAbove(content, match.index);
      const handlerName = extractNestMethodName(content, match.index);
      const body = extractFunctionBody(content, match.index);
      const description = comment || describeBusinessLogic(method, routePath, body, handlerName);
      apis.push({
        id: makeId('api'), method, path: routePath, file: relativePath, line,
        description, params: extractParams(routePath), dbOperations: [],
        auth: detectAuth(content, line), _body: body,
      });
    }

    // ── Next.js App Router ──
    NEXTJS_HANDLER_REGEX.lastIndex = 0;
    while ((match = NEXTJS_HANDLER_REGEX.exec(content)) !== null) {
      const method = match[1] as HttpMethod;
      const routePath = '/' + relativePath
        .replace(/^src\//, '')
        .replace(/^app\//, '')
        .replace(/\/route\.(ts|tsx|js|jsx)$/, '')
        .replace(/\\/g, '/');
      const line = getLineNumber(content, match.index);
      const comment = extractCommentAbove(content, match.index);
      const body = extractFunctionBody(content, match.index);
      const description = comment || describeBusinessLogic(method, routePath, body, '');
      apis.push({
        id: makeId('api'), method, path: routePath, file: relativePath, line,
        description, params: extractParams(routePath), dbOperations: [],
        auth: detectAuth(content, line), _body: body,
      });
    }
  }

  return apis;
}
