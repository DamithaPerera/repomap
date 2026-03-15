import { DbModel, DbField, DbRelation } from '@/types/analysis';
import { FileEntry } from './fileWalker';

let counter = 0;
function makeId(name: string) {
  return `model_${++counter}_${name.toLowerCase()}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function titleCase(raw: string) {
  return raw.split(/[-_\s]/).map((w) => capitalize(w)).join('');
}

// ─── Mongoose ────────────────────────────────────────────────────────────────
const MONGOOSE_MODEL_REGEX = /mongoose\.model\s*\(\s*['"`]([^'"`]+)['"`]/gi;
const MONGOOSE_REF_REGEX = /ref\s*:\s*['"`]([^'"`]+)['"`]/g;

function extractMongooseFields(content: string, schemaStart: number): DbField[] {
  const fields: DbField[] = [];
  const slice = content.slice(schemaStart, schemaStart + 2000);
  const fieldRegex = /['"`]?(\w+)['"`]?\s*:\s*\{[^}]*type\s*:\s*(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = fieldRegex.exec(slice)) !== null) {
    const [, name, fieldType] = m;
    if (name === 'type') continue;
    fields.push({ name, fieldType, required: /required\s*:\s*true/.test(m[0]) });
  }
  return fields;
}

function extractMongooseRefs(content: string): DbRelation[] {
  const relations: DbRelation[] = [];
  MONGOOSE_REF_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MONGOOSE_REF_REGEX.exec(content)) !== null) {
    relations.push({ targetModel: m[1], relationType: 'ref' });
  }
  return relations;
}

// ─── Prisma ───────────────────────────────────────────────────────────────────
const PRISMA_USAGE_REGEX = /prisma\.(\w+)\.(findMany|findFirst|findUnique|create|update|delete|upsert)/gi;

// ─── Sequelize ───────────────────────────────────────────────────────────────
const SEQUELIZE_DEFINE_REGEX = /sequelize\.define\s*\(\s*['"`]([^'"`]+)['"`]/gi;
const SEQUELIZE_CLASS_REGEX = /class\s+(\w+)\s+extends\s+Model/g;

// ─── TypeORM ─────────────────────────────────────────────────────────────────
const TYPEORM_ENTITY_REGEX = /@Entity\s*\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)[\s\S]{0,200}?class\s+(\w+)/g;

// ─── Drizzle ORM ─────────────────────────────────────────────────────────────
// pgTable('users', {...}), mysqlTable('orders'), sqliteTable('products')
const DRIZZLE_TABLE_REGEX = /(?:pgTable|mysqlTable|sqliteTable|table)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

// ─── Knex.js ─────────────────────────────────────────────────────────────────
// knex('users').select(), knex.schema.createTable('users')
const KNEX_QUERY_REGEX = /knex\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gi;
const KNEX_SCHEMA_REGEX = /(?:createTable|table)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

// ─── MikroORM ────────────────────────────────────────────────────────────────
// @Entity() class User extends BaseEntity
const MIKRO_ENTITY_REGEX = /@Entity\s*\([\s\S]{0,100}?\)\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)\s+extends\s+(?:BaseEntity|Entity)/g;

// ─── Objection.js ────────────────────────────────────────────────────────────
// class User extends Model { static tableName = 'users' }
const OBJECTION_CLASS_REGEX = /class\s+(\w+)\s+extends\s+Model/g;
const OBJECTION_TABLE_REGEX = /static\s+tableName\s*=\s*['"`]([^'"`]+)['"`]/g;

// ─── Bookshelf.js ────────────────────────────────────────────────────────────
// bookshelf.model('User', { tableName: 'users' })
const BOOKSHELF_MODEL_REGEX = /bookshelf\.model\s*\(\s*['"`]([^'"`]+)['"`]/gi;

// ─── Waterline ────────────────────────────────────────────────────────────────
// module.exports = { identity: 'user', tableName: 'users', ... }
const WATERLINE_IDENTITY_REGEX = /identity\s*:\s*['"`]([^'"`]+)['"`]/gi;

// ─── DynamoDB ────────────────────────────────────────────────────────────────
const DYNAMO_TRIGGER = /dynamodb|DynamoDBClient|DocumentClient|DynamoDBDocumentClient|aws-sdk|@aws-sdk|TableName\s*:/i;

// ─── Neo4j ────────────────────────────────────────────────────────────────────
const NEO4J_TRIGGER = /neo4j|neo4j-driver|@neo4j|neogma|neo4j-ogm/i;
const NEO4J_LABEL_REGEX = /\(\s*\w*\s*:\s*([A-Z][a-zA-Z0-9_]*)/g;
const NEO4J_REL_REGEX = /\[[\w\s]*:([A-Z_][A-Z0-9_]+)\]/g;
const NEO4J_RUN_REGEX = /(?:session|tx|transaction|driver)\s*\.\s*run\s*\(\s*[`'"]([\s\S]*?)[`'"]/g;

// ─── Firebase / Firestore ────────────────────────────────────────────────────
const FIREBASE_TRIGGER = /firebase|firestore|@firebase|firebase-admin/i;
const FIREBASE_COLLECTION_REGEX = /\.(?:collection|doc|ref)\s*\(\s*['"`]([^'"`\/\n]+)/g;

// ─── Redis ───────────────────────────────────────────────────────────────────
const REDIS_TRIGGER = /(?:require|from)\s*['"`](?:ioredis|redis)['"`]|new\s+Redis\s*\(/i;
const REDIS_KEY_REGEX = /(?:redis|client|cache|redisClient)\s*\.\s*(?:set|get|hset|hget|lpush|rpush|zadd|setex|expire)\s*\(\s*['"`]([^'"`\n]+)['"`]/gi;

// ─── Elasticsearch ───────────────────────────────────────────────────────────
const ELASTIC_TRIGGER = /@elastic\/elasticsearch|elasticsearch|ElasticSearch/i;
const ELASTIC_INDEX_REGEX = /index\s*:\s*['"`]([^'"`\n]+)['"`]/g;

// ─── MongoDB (native driver) ──────────────────────────────────────────────────
// db.collection('users'), client.db('mydb').collection('orders')
const MONGO_COLLECTION_REGEX = /\.collection\s*\(\s*['"`]([^'"`\n]+)['"`]/gi;

// ─── CouchDB (nano) ───────────────────────────────────────────────────────────
// nano.db.use('mydb'), couch.db.create('users'), db.insert(...)
const COUCH_TRIGGER = /nano|couchdb|couchDB|nano\.db|pouchdb|PouchDB/i;
const COUCH_DB_REGEX = /(?:nano\.db\.use|db\.use|couch\.db\.use|nano\.use)\s*\(\s*['"`]([^'"`\n]+)['"`]/gi;
const POUCHDB_REGEX = /new\s+PouchDB\s*\(\s*['"`]([^'"`\n]+)['"`]/gi;

// ─── Cassandra ────────────────────────────────────────────────────────────────
// client.execute('SELECT * FROM users'), CREATE TABLE keyspace.table_name
const CASSANDRA_TRIGGER = /cassandra-driver|@datastax|cassandra|scylladb/i;
const CASSANDRA_TABLE_REGEX = /(?:FROM|INTO|TABLE|UPDATE)\s+(?:[\w]+\.)?([a-z_][a-z0-9_]+)(?:\s|;|\()/gi;

// ─── FaunaDB ─────────────────────────────────────────────────────────────────
// q.Collection('users'), client.query(q.Get(q.Collection('users')))
const FAUNA_TRIGGER = /faunadb|@fauna-labs\/fauna|fauna\/src/i;
const FAUNA_COLLECTION_REGEX = /(?:q\.Collection|Collection)\s*\(\s*['"`]([^'"`\n]+)['"`]/gi;

// ─── Supabase ─────────────────────────────────────────────────────────────────
// supabase.from('users').select()
const SUPABASE_TRIGGER = /@supabase\/supabase-js|@supabase\/auth-helpers|supabase/i;
const SUPABASE_FROM_REGEX = /supabase\s*\.\s*from\s*\(\s*['"`]([^'"`\n]+)['"`]/gi;

// ─── InfluxDB ─────────────────────────────────────────────────────────────────
// writeApi.useDefaultTags({org}), influxDB.getWriteApi(..., 'bucket')
const INFLUX_TRIGGER = /@influxdata\/influxdb-client|influx|influxdb/i;
const INFLUX_BUCKET_REGEX = /(?:getBucket|bucket|measurement)\s*[:(=]\s*['"`]([^'"`\n]+)['"`]/gi;
const INFLUX_MEASUREMENT_REGEX = /new\s+Point\s*\(\s*['"`]([^'"`\n]+)['"`]/gi;

// ─── ClickHouse ───────────────────────────────────────────────────────────────
// client.insert({ table: 'events', ... }), client.query({ query: 'SELECT * FROM events' })
const CLICKHOUSE_TRIGGER = /@clickhouse\/client|clickhouse|ClickHouse/i;
const CLICKHOUSE_TABLE_REGEX = /(?:table|from|into)\s*[:`'"=\s]\s*['"`]?([a-zA-Z_][a-zA-Z0-9_]+)['"`]?/gi;

// ─── ArangoDB ────────────────────────────────────────────────────────────────
// db.collection('users'), db._collection('users'), db.query(aql`...`)
const ARANGO_TRIGGER = /arangojs|arangodb|ArangoDatabase|aql`/i;
const ARANGO_COLLECTION_REGEX = /db\s*\.\s*(?:collection|_collection)\s*\(\s*['"`]([^'"`\n]+)['"`]/gi;

// ─── RethinkDB ────────────────────────────────────────────────────────────────
// r.table('users').run(conn)
const RETHINK_TRIGGER = /rethinkdb|rethinkdbdash|r\.table/i;
const RETHINK_TABLE_REGEX = /r\s*\.\s*table\s*\(\s*['"`]([^'"`\n]+)['"`]/gi;

// ─── CockroachDB ─────────────────────────────────────────────────────────────
// Detected via pg driver + cockroachdb connection string / cluster mentions
const COCKROACH_TRIGGER = /cockroachdb|cockroach|crdb|\.cockroachlabs\.com/i;

// ─── PlanetScale ─────────────────────────────────────────────────────────────
// import { connect } from '@planetscale/database'
const PLANETSCALE_TRIGGER = /@planetscale\/database|planetscale/i;

// ─── Turso / LibSQL ───────────────────────────────────────────────────────────
// createClient({ url: 'libsql://...' })
const TURSO_TRIGGER = /@libsql\/client|@tursodatabase\/api|libsql:\/\//i;
const TURSO_TABLE_REGEX = /(?:CREATE\s+TABLE|INTO|FROM|UPDATE)\s+(?:IF\s+NOT\s+EXISTS\s+)?['"`]?([a-zA-Z_][a-zA-Z0-9_]+)['"`]?/gi;

// ─── Neon (serverless Postgres) ───────────────────────────────────────────────
const NEON_TRIGGER = /@neondatabase\/serverless|neon\s*\(/i;

// ─── Upstash (serverless Redis/Kafka) ────────────────────────────────────────
const UPSTASH_TRIGGER = /@upstash\/redis|@upstash\/kafka|@upstash\/qstash/i;
const UPSTASH_KEY_REGEX = /redis\s*\.\s*(?:set|get|hset|lpush)\s*\(\s*['"`]([^'"`\n]+)['"`]/gi;

// ─── SQLite ───────────────────────────────────────────────────────────────────
// better-sqlite3, sqlite3, sql.js
const SQLITE_TRIGGER = /better-sqlite3|require\s*\(\s*['"`]sqlite3['"`]\)|sql\.js|@capacitor\/sqlite/i;
const SQLITE_TABLE_REGEX = /(?:CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|INSERT\s+INTO|SELECT\s+\S+\s+FROM|UPDATE)\s+['"`]?([a-zA-Z_][a-zA-Z0-9_]+)['"`]?/gi;

// ─── LevelDB ─────────────────────────────────────────────────────────────────
const LEVELDB_TRIGGER = /levelup|leveldown|level|@google\/leveldb|level-rocksdb/i;
const LEVELDB_KEY_REGEX = /(?:db|level)\s*\.\s*(?:put|get|del)\s*\(\s*['"`]([^'"`\n]+)['"`]/gi;

// ─── LokiJS (in-memory/browser DB) ───────────────────────────────────────────
const LOKI_TRIGGER = /lokijs|loki\.js|new\s+Loki\s*\(/i;
const LOKI_COLLECTION_REGEX = /(?:db|loki)\s*\.\s*(?:addCollection|getCollection)\s*\(\s*['"`]([^'"`\n]+)['"`]/gi;

// ─── OrientDB ────────────────────────────────────────────────────────────────
const ORIENT_TRIGGER = /orientjs|orientdb|OrientDB/i;
const ORIENT_CLASS_REGEX = /(?:session|db)\s*\.\s*(?:class|create)\s*\(\s*['"`]([^'"`\n]+)['"`]/gi;

// ─── TimescaleDB (pg + timescale extension markers) ───────────────────────────
const TIMESCALE_TRIGGER = /timescaledb|timescale|create_hypertable/i;
const TIMESCALE_HYPER_REGEX = /create_hypertable\s*\(\s*['"`]([^'"`\n]+)['"`]/gi;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizeTableName(raw: string): string {
  return raw
    .replace(/[-_](table|tbl)$/i, '')
    .split(/[-_]/)
    .map((w) => capitalize(w))
    .join('') || raw;
}

function simpleModels(
  regex: RegExp,
  content: string,
  relativePath: string,
  type: DbModel['type'],
  seen: Set<string>,
  normalize = false
): DbModel[] {
  const results: DbModel[] = [];
  regex.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    const raw = m[1]?.trim();
    if (!raw || raw.length > 60) continue;
    const name = normalize ? normalizeTableName(raw) : titleCase(raw);
    if (seen.has(name)) continue;
    seen.add(name);
    results.push({ id: makeId(name), name, type, file: relativePath, fields: [], relations: [] });
  }
  return results;
}

// ─── Neo4j helper ─────────────────────────────────────────────────────────────
function extractNeo4jModels(content: string, relativePath: string, seen: Set<string>): DbModel[] {
  const results: DbModel[] = [];
  const labelRelMap = new Map<string, Set<string>>();
  const cyphers: string[] = [];
  let m: RegExpExecArray | null;
  NEO4J_RUN_REGEX.lastIndex = 0;
  while ((m = NEO4J_RUN_REGEX.exec(content)) !== null) cyphers.push(m[1]);
  cyphers.push(content);
  for (const cypher of cyphers) {
    NEO4J_LABEL_REGEX.lastIndex = 0;
    while ((m = NEO4J_LABEL_REGEX.exec(cypher)) !== null) {
      if (!labelRelMap.has(m[1])) labelRelMap.set(m[1], new Set());
    }
    NEO4J_REL_REGEX.lastIndex = 0;
    while ((m = NEO4J_REL_REGEX.exec(cypher)) !== null) {
      for (const [, rels] of labelRelMap) rels.add(m[1]);
    }
  }
  for (const [label, rels] of labelRelMap) {
    if (seen.has(label)) continue;
    seen.add(label);
    results.push({
      id: makeId(label), name: label, type: 'neo4j', file: relativePath, fields: [],
      relations: [...rels].map((r) => ({ targetModel: r, relationType: 'unknown' as const })),
    });
  }
  return results;
}

// ─── Firebase helper ──────────────────────────────────────────────────────────
function extractFirebaseCollections(content: string, relativePath: string, seen: Set<string>): DbModel[] {
  const results: DbModel[] = [];
  let m: RegExpExecArray | null;
  FIREBASE_COLLECTION_REGEX.lastIndex = 0;
  while ((m = FIREBASE_COLLECTION_REGEX.exec(content)) !== null) {
    const raw = m[1].trim();
    if (!raw || raw.includes('/') || raw.length > 40) continue;
    const name = capitalize(raw);
    if (seen.has(name)) continue;
    seen.add(name);
    results.push({ id: makeId(name), name, type: 'firebase', file: relativePath, fields: [], relations: [] });
  }
  return results;
}

// ─── Redis helper ─────────────────────────────────────────────────────────────
function extractRedisKeys(content: string, relativePath: string, seen: Set<string>): DbModel[] {
  const results: DbModel[] = [];
  let m: RegExpExecArray | null;
  REDIS_KEY_REGEX.lastIndex = 0;
  const namespaces = new Set<string>();
  while ((m = REDIS_KEY_REGEX.exec(content)) !== null) {
    const prefix = m[1].split(':')[0].split('-')[0];
    if (prefix) namespaces.add(prefix);
  }
  for (const ns of namespaces) {
    const name = capitalize(ns);
    if (seen.has(name)) continue;
    seen.add(name);
    results.push({ id: makeId(name), name, type: 'redis', file: relativePath, fields: [], relations: [] });
  }
  return results;
}

// ─── Elasticsearch helper ─────────────────────────────────────────────────────
function extractElasticIndexes(content: string, relativePath: string, seen: Set<string>): DbModel[] {
  const results: DbModel[] = [];
  if (!/client\.|esClient\.|elastic\./i.test(content)) return results;
  let m: RegExpExecArray | null;
  ELASTIC_INDEX_REGEX.lastIndex = 0;
  while ((m = ELASTIC_INDEX_REGEX.exec(content)) !== null) {
    const raw = m[1].trim();
    if (!raw || raw.length > 50) continue;
    const name = titleCase(raw);
    if (seen.has(name)) continue;
    seen.add(name);
    results.push({ id: makeId(name), name, type: 'elasticsearch', file: relativePath, fields: [], relations: [] });
  }
  return results;
}

// ─── DynamoDB helper ──────────────────────────────────────────────────────────
function makeDynamoModel(name: string, file: string, ops: string[]): DbModel {
  return {
    id: makeId(name), name, type: 'dynamodb', file,
    fields: [...new Set(ops)].map((op) => ({ name: op, fieldType: 'operation' })),
    relations: [],
  };
}

function extractDynamoTables(content: string, relativePath: string, seen: Set<string>): DbModel[] {
  const results: DbModel[] = [];
  const varToValue = new Map<string, string>();
  const varDeclRegex = /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:process\.env\.\w+\s*(?:\|\||[?][?])\s*)?['"`]([^'"`\n]+)['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = varDeclRegex.exec(content)) !== null) varToValue.set(m[1], m[2]);

  const ops: string[] = [];
  const cmdRegex = /new\s+(Put|Get|Query|Scan|Update|Delete|BatchWrite|BatchGet|TransactWrite|TransactGet)(?:Item)?Command/gi;
  while ((m = cmdRegex.exec(content)) !== null) ops.push(m[1].toLowerCase());
  const v2Regex = /(?:docClient|dynamodb|ddb|db|client)\s*\.\s*(put|get|query|scan|update|delete|batchWrite|batchGet)\s*\(/gi;
  while ((m = v2Regex.exec(content)) !== null) ops.push(m[1].toLowerCase());

  const literalRegex = /TableName\s*:\s*['"`]([^'"`\n]+)['"`]/gi;
  while ((m = literalRegex.exec(content)) !== null) {
    const name = normalizeTableName(m[1]);
    if (seen.has(name)) continue;
    seen.add(name);
    results.push(makeDynamoModel(name, relativePath, ops));
  }

  const varRefRegex = /TableName\s*:\s*(process\.env\.([A-Za-z_][A-Za-z0-9_]*)|([a-zA-Z_$][a-zA-Z0-9_$.]*))/g;
  while ((m = varRefRegex.exec(content)) !== null) {
    const envVar = m[2];
    const varName = m[3];
    const raw = envVar ? (varToValue.get(envVar) ?? envVar) : (varToValue.get(varName) ?? varName);
    const name = normalizeTableName(raw);
    if (seen.has(name)) continue;
    seen.add(name);
    results.push(makeDynamoModel(name, relativePath, ops));
  }

  if (results.length === 0 && ops.length > 0) {
    const envTableRegex = /process\.env\.([A-Za-z_][A-Za-z0-9_]*(?:TABLE|table)[A-Za-z0-9_]*|[A-Za-z_]*(?:TABLE|table)[A-Za-z0-9_]*)/g;
    while ((m = envTableRegex.exec(content)) !== null) {
      const name = normalizeTableName(m[1]);
      if (seen.has(name)) continue;
      seen.add(name);
      results.push(makeDynamoModel(name, relativePath, ops));
    }
  }
  return results;
}

// ─── Cassandra helper ─────────────────────────────────────────────────────────
function extractCassandraTables(content: string, relativePath: string, seen: Set<string>): DbModel[] {
  const results: DbModel[] = [];
  let m: RegExpExecArray | null;
  CASSANDRA_TABLE_REGEX.lastIndex = 0;
  const SKIP = new Set(['from', 'into', 'table', 'update', 'system', 'system_auth', 'system_schema']);
  while ((m = CASSANDRA_TABLE_REGEX.exec(content)) !== null) {
    const raw = m[1]?.trim().toLowerCase();
    if (!raw || SKIP.has(raw) || raw.length > 60) continue;
    const name = titleCase(raw);
    if (seen.has(name)) continue;
    seen.add(name);
    results.push({ id: makeId(name), name, type: 'cassandra', file: relativePath, fields: [], relations: [] });
  }
  return results;
}

// ─── SQLite helper ────────────────────────────────────────────────────────────
function extractSqliteTables(content: string, relativePath: string, seen: Set<string>): DbModel[] {
  const results: DbModel[] = [];
  let m: RegExpExecArray | null;
  SQLITE_TABLE_REGEX.lastIndex = 0;
  const SKIP = new Set(['select', 'from', 'table', 'if', 'not', 'exists', 'sqlite_master', 'sqlite_sequence']);
  while ((m = SQLITE_TABLE_REGEX.exec(content)) !== null) {
    const raw = m[1]?.trim().toLowerCase();
    if (!raw || SKIP.has(raw) || raw.length > 60) continue;
    const name = titleCase(raw);
    if (seen.has(name)) continue;
    seen.add(name);
    results.push({ id: makeId(name), name, type: 'sqlite', file: relativePath, fields: [], relations: [] });
  }
  return results;
}

// ─── Main export ─────────────────────────────────────────────────────────────
export function detectDbModels(files: FileEntry[]): DbModel[] {
  counter = 0;
  const models: DbModel[] = [];
  const seen = new Set<string>();

  for (const { content, relativePath } of files) {

    // ── Mongoose ──
    if (/mongoose|Schema/i.test(content)) {
      MONGOOSE_MODEL_REGEX.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = MONGOOSE_MODEL_REGEX.exec(content)) !== null) {
        const name = m[1];
        if (seen.has(name)) continue;
        seen.add(name);
        const schemaStart = content.lastIndexOf('new Schema', m.index);
        models.push({
          id: makeId(name), name, type: 'mongoose', file: relativePath,
          fields: schemaStart >= 0 ? extractMongooseFields(content, schemaStart) : [],
          relations: extractMongooseRefs(content),
        });
      }
    }

    // ── Prisma ──
    if (/prisma\./i.test(content)) {
      PRISMA_USAGE_REGEX.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = PRISMA_USAGE_REGEX.exec(content)) !== null) {
        const name = capitalize(m[1]);
        if (seen.has(name)) continue;
        seen.add(name);
        models.push({ id: makeId(name), name, type: 'prisma', file: relativePath, fields: [], relations: [] });
      }
    }

    // ── Sequelize ──
    if (/sequelize/i.test(content)) {
      let m: RegExpExecArray | null;
      SEQUELIZE_DEFINE_REGEX.lastIndex = 0;
      while ((m = SEQUELIZE_DEFINE_REGEX.exec(content)) !== null) {
        const name = m[1];
        if (seen.has(name)) continue;
        seen.add(name);
        models.push({ id: makeId(name), name, type: 'sequelize', file: relativePath, fields: [], relations: [] });
      }
      SEQUELIZE_CLASS_REGEX.lastIndex = 0;
      while ((m = SEQUELIZE_CLASS_REGEX.exec(content)) !== null) {
        const name = m[1];
        if (seen.has(name)) continue;
        seen.add(name);
        models.push({ id: makeId(name), name, type: 'sequelize', file: relativePath, fields: [], relations: [] });
      }
    }

    // ── TypeORM ──
    if (/@Entity/i.test(content) && !/@Entity[\s\S]{0,100}extends\s+(?:BaseEntity|Entity)/.test(content)) {
      TYPEORM_ENTITY_REGEX.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = TYPEORM_ENTITY_REGEX.exec(content)) !== null) {
        const name = m[2] || m[1];
        if (seen.has(name)) continue;
        seen.add(name);
        models.push({ id: makeId(name), name, type: 'typeorm', file: relativePath, fields: [], relations: [] });
      }
    }

    // ── MikroORM ──
    if (/@Entity/i.test(content) && /BaseEntity|MikroORM|mikro-orm/i.test(content)) {
      models.push(...simpleModels(MIKRO_ENTITY_REGEX, content, relativePath, 'mikro-orm', seen));
    }

    // ── Drizzle ──
    if (/drizzle|pgTable|mysqlTable|sqliteTable/i.test(content)) {
      models.push(...simpleModels(DRIZZLE_TABLE_REGEX, content, relativePath, 'drizzle', seen, true));
    }

    // ── Knex.js ──
    if (/knex/i.test(content)) {
      models.push(...simpleModels(KNEX_QUERY_REGEX, content, relativePath, 'knex', seen, true));
      models.push(...simpleModels(KNEX_SCHEMA_REGEX, content, relativePath, 'knex', seen, true));
    }

    // ── Objection.js ──
    if (/objection|extends\s+Model/i.test(content) && /tableName/i.test(content)) {
      models.push(...simpleModels(OBJECTION_TABLE_REGEX, content, relativePath, 'objection', seen, true));
      // Also capture class names if tableName found
      let m: RegExpExecArray | null;
      OBJECTION_CLASS_REGEX.lastIndex = 0;
      while ((m = OBJECTION_CLASS_REGEX.exec(content)) !== null) {
        const name = m[1];
        if (seen.has(name)) continue;
        seen.add(name);
        models.push({ id: makeId(name), name, type: 'objection', file: relativePath, fields: [], relations: [] });
      }
    }

    // ── Bookshelf.js ──
    if (/bookshelf/i.test(content)) {
      models.push(...simpleModels(BOOKSHELF_MODEL_REGEX, content, relativePath, 'bookshelf', seen));
    }

    // ── Waterline (Sails.js ORM) ──
    if (/waterline|sails/i.test(content) && /identity\s*:/i.test(content)) {
      models.push(...simpleModels(WATERLINE_IDENTITY_REGEX, content, relativePath, 'waterline', seen));
    }

    // ── DynamoDB ──
    if (DYNAMO_TRIGGER.test(content)) {
      models.push(...extractDynamoTables(content, relativePath, seen));
    }

    // ── Neo4j ──
    if (NEO4J_TRIGGER.test(content)) {
      models.push(...extractNeo4jModels(content, relativePath, seen));
    }

    // ── Firebase / Firestore ──
    if (FIREBASE_TRIGGER.test(content)) {
      models.push(...extractFirebaseCollections(content, relativePath, seen));
    }

    // ── Redis ──
    if (REDIS_TRIGGER.test(content)) {
      models.push(...extractRedisKeys(content, relativePath, seen));
    }

    // ── Upstash (Redis/Kafka serverless) ──
    if (UPSTASH_TRIGGER.test(content)) {
      models.push(...simpleModels(UPSTASH_KEY_REGEX, content, relativePath, 'upstash', seen));
    }

    // ── Elasticsearch ──
    if (ELASTIC_TRIGGER.test(content)) {
      models.push(...extractElasticIndexes(content, relativePath, seen));
    }

    // ── MongoDB native driver ──
    if (/MongoClient/i.test(content) && !/mongoose/i.test(content)) {
      models.push(...simpleModels(MONGO_COLLECTION_REGEX, content, relativePath, 'mongodb', seen, true));
    }

    // ── CouchDB / Nano ──
    if (COUCH_TRIGGER.test(content)) {
      if (/pouchdb|PouchDB/i.test(content)) {
        models.push(...simpleModels(POUCHDB_REGEX, content, relativePath, 'pouchdb', seen));
      } else {
        models.push(...simpleModels(COUCH_DB_REGEX, content, relativePath, 'couchdb', seen));
      }
    }

    // ── Cassandra / ScyllaDB ──
    if (CASSANDRA_TRIGGER.test(content)) {
      models.push(...extractCassandraTables(content, relativePath, seen));
    }

    // ── FaunaDB ──
    if (FAUNA_TRIGGER.test(content)) {
      models.push(...simpleModels(FAUNA_COLLECTION_REGEX, content, relativePath, 'fauna', seen));
    }

    // ── Supabase ──
    if (SUPABASE_TRIGGER.test(content)) {
      models.push(...simpleModels(SUPABASE_FROM_REGEX, content, relativePath, 'supabase', seen, true));
    }

    // ── InfluxDB ──
    if (INFLUX_TRIGGER.test(content)) {
      models.push(...simpleModels(INFLUX_BUCKET_REGEX, content, relativePath, 'influxdb', seen));
      models.push(...simpleModels(INFLUX_MEASUREMENT_REGEX, content, relativePath, 'influxdb', seen));
    }

    // ── ClickHouse ──
    if (CLICKHOUSE_TRIGGER.test(content)) {
      models.push(...simpleModels(CLICKHOUSE_TABLE_REGEX, content, relativePath, 'clickhouse', seen, true));
    }

    // ── ArangoDB ──
    if (ARANGO_TRIGGER.test(content)) {
      models.push(...simpleModels(ARANGO_COLLECTION_REGEX, content, relativePath, 'arangodb', seen, true));
    }

    // ── RethinkDB ──
    if (RETHINK_TRIGGER.test(content)) {
      models.push(...simpleModels(RETHINK_TABLE_REGEX, content, relativePath, 'rethinkdb', seen, true));
    }

    // ── CockroachDB (pg-based, detect via cluster markers) ──
    if (COCKROACH_TRIGGER.test(content)) {
      // Extract table names from SQL queries
      const sqlTableRegex = /(?:FROM|INTO|UPDATE|TABLE)\s+(?:public\.)?(['"`]?[a-zA-Z_][a-zA-Z0-9_]+['"`]?)/gi;
      models.push(...simpleModels(sqlTableRegex, content, relativePath, 'cockroachdb', seen, true));
    }

    // ── PlanetScale (MySQL-compatible) ──
    if (PLANETSCALE_TRIGGER.test(content)) {
      const psTableRegex = /(?:FROM|INTO|UPDATE|TABLE)\s+(['"`]?[a-zA-Z_][a-zA-Z0-9_]+['"`]?)/gi;
      models.push(...simpleModels(psTableRegex, content, relativePath, 'planetscale', seen, true));
    }

    // ── Turso / LibSQL ──
    if (TURSO_TRIGGER.test(content)) {
      models.push(...simpleModels(TURSO_TABLE_REGEX, content, relativePath, 'turso', seen, true));
    }

    // ── Neon (serverless Postgres) ──
    if (NEON_TRIGGER.test(content)) {
      const neonTableRegex = /(?:FROM|INTO|UPDATE|TABLE)\s+(['"`]?[a-zA-Z_][a-zA-Z0-9_]+['"`]?)/gi;
      models.push(...simpleModels(neonTableRegex, content, relativePath, 'neon', seen, true));
    }

    // ── SQLite ──
    if (SQLITE_TRIGGER.test(content)) {
      models.push(...extractSqliteTables(content, relativePath, seen));
    }

    // ── LevelDB ──
    if (LEVELDB_TRIGGER.test(content)) {
      models.push(...simpleModels(LEVELDB_KEY_REGEX, content, relativePath, 'leveldb', seen));
    }

    // ── LokiJS ──
    if (LOKI_TRIGGER.test(content)) {
      models.push(...simpleModels(LOKI_COLLECTION_REGEX, content, relativePath, 'loki', seen));
    }

    // ── OrientDB ──
    if (ORIENT_TRIGGER.test(content)) {
      models.push(...simpleModels(ORIENT_CLASS_REGEX, content, relativePath, 'orientdb', seen));
    }

    // ── TimescaleDB (must come after pg/postgres detection) ──
    if (TIMESCALE_TRIGGER.test(content)) {
      models.push(...simpleModels(TIMESCALE_HYPER_REGEX, content, relativePath, 'timescaledb', seen, true));
    }
  }

  return models;
}
