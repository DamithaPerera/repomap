import { DbModel, DbField, DbRelation } from '@/types/analysis';
import { FileEntry } from './fileWalker';

let counter = 0;
function makeId(name: string) {
  return `model_${++counter}_${name.toLowerCase()}`;
}

// ─── Mongoose ────────────────────────────────────────────────────────────────
// const UserSchema = new Schema({ ... })
// mongoose.model('User', UserSchema)
const MONGOOSE_MODEL_REGEX = /mongoose\.model\s*\(\s*['"`]([^'"`]+)['"`]/gi;
const MONGOOSE_SCHEMA_FIELD_REGEX = /(\w+)\s*:\s*\{[^}]*type\s*:\s*(\w+)/g;
const MONGOOSE_REF_REGEX = /ref\s*:\s*['"`]([^'"`]+)['"`]/g;

// ─── Prisma ───────────────────────────────────────────────────────────────────
// Prisma schema is .prisma not .ts — we handle it in a separate pass
// But we can detect prisma client usage: prisma.user.findMany()
const PRISMA_USAGE_REGEX = /prisma\.(\w+)\.(findMany|findFirst|findUnique|create|update|delete|upsert)/gi;

// ─── Sequelize ───────────────────────────────────────────────────────────────
// Model.define('User', {...}) or class User extends Model
const SEQUELIZE_DEFINE_REGEX = /sequelize\.define\s*\(\s*['"`]([^'"`]+)['"`]/gi;
const SEQUELIZE_CLASS_REGEX = /class\s+(\w+)\s+extends\s+Model/g;

// ─── TypeORM ─────────────────────────────────────────────────────────────────
const TYPEORM_ENTITY_REGEX = /@Entity\s*\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)[\s\S]{0,200}?class\s+(\w+)/g;

// ─── DynamoDB ────────────────────────────────────────────────────────────────
// Trigger: file imports/requires DynamoDB OR uses TableName: anywhere
const DYNAMO_TRIGGER = /dynamodb|DynamoDBClient|DocumentClient|DynamoDBDocumentClient|aws-sdk|@aws-sdk|TableName\s*:/i;

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function normalizeTableName(raw: string): string {
  // e.g. "users-table" -> "Users", "USERS_TABLE" -> "Users", "UsersTable" -> "UsersTable"
  return raw
    .replace(/[-_](table|tbl)$/i, '')   // strip trailing -table / _TABLE
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('') || raw;
}

function extractMongooseFields(content: string, schemaStart: number): DbField[] {
  const fields: DbField[] = [];
  // Find the schema object after the Schema( call
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

function makeDynamoModel(name: string, file: string, ops: string[]): DbModel {
  return {
    id: makeId(name),
    name,
    type: 'dynamodb',
    file,
    fields: [...new Set(ops)].map((op) => ({ name: op, fieldType: 'operation' })),
    relations: [],
  };
}

function extractDynamoTables(content: string, relativePath: string, seen: Set<string>): DbModel[] {
  const results: DbModel[] = [];

  // ── Step 1: build variable → string value map from declarations in this file ──
  // Covers: const TABLE = 'name', const TABLE = process.env.X || 'name'
  const varToValue = new Map<string, string>();
  const varDeclRegex = /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:process\.env\.\w+\s*(?:\|\||[?][?])\s*)?['"`]([^'"`\n]+)['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = varDeclRegex.exec(content)) !== null) {
    varToValue.set(m[1], m[2]);
  }

  // ── Step 2: collect operations in this file ──
  const ops: string[] = [];
  // SDK v3 commands: new PutCommand, new QueryCommand, etc.
  const cmdRegex = /new\s+(Put|Get|Query|Scan|Update|Delete|BatchWrite|BatchGet|TransactWrite|TransactGet)(?:Item)?Command/gi;
  while ((m = cmdRegex.exec(content)) !== null) ops.push(m[1].toLowerCase());
  // SDK v2 style: docClient.put(, ddb.query(, dynamoDB.scan(
  const v2Regex = /(?:docClient|dynamodb|ddb|db|client)\s*\.\s*(put|get|query|scan|update|delete|batchWrite|batchGet)\s*\(/gi;
  while ((m = v2Regex.exec(content)) !== null) ops.push(m[1].toLowerCase());

  // ── Step 3: find all TableName references ──
  // 3a: literal string — TableName: 'my-table'
  const literalRegex = /TableName\s*:\s*['"`]([^'"`\n]+)['"`]/gi;
  while ((m = literalRegex.exec(content)) !== null) {
    const name = normalizeTableName(m[1]);
    if (seen.has(name)) continue;
    seen.add(name);
    results.push(makeDynamoModel(name, relativePath, ops));
  }

  // 3b: variable reference — TableName: someVar or TableName: process.env.X
  const varRefRegex = /TableName\s*:\s*(process\.env\.([A-Za-z_][A-Za-z0-9_]*)|([a-zA-Z_$][a-zA-Z0-9_$.]*))/g;
  while ((m = varRefRegex.exec(content)) !== null) {
    const envVar = m[2];   // process.env.VAR_NAME
    const varName = m[3];  // plain variable

    let raw: string;
    if (envVar) {
      // Use the env var name itself as a readable table name
      raw = varToValue.get(envVar) ?? envVar;
    } else {
      // Resolve variable to its string value if possible
      raw = varToValue.get(varName) ?? varName;
    }

    const name = normalizeTableName(raw);
    if (seen.has(name)) continue;
    seen.add(name);
    results.push(makeDynamoModel(name, relativePath, ops));
  }

  // ── Step 4: fallback — DynamoDB detected but no TableName found ──
  // This covers files that only create the client or helper wrappers
  if (results.length === 0 && ops.length > 0) {
    // Try env var declarations that look like table names
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
          id: makeId(name),
          name,
          type: 'mongoose',
          file: relativePath,
          fields: schemaStart >= 0 ? extractMongooseFields(content, schemaStart) : [],
          relations: extractMongooseRefs(content),
        });
      }
    }

    // ── Prisma client usage (infer models from method calls) ──
    if (/prisma\./i.test(content)) {
      PRISMA_USAGE_REGEX.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = PRISMA_USAGE_REGEX.exec(content)) !== null) {
        const rawName = m[1];
        const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        if (seen.has(name)) continue;
        seen.add(name);
        models.push({
          id: makeId(name),
          name,
          type: 'prisma',
          file: relativePath,
          fields: [],
          relations: [],
        });
      }
    }

    // ── Sequelize ──
    if (/sequelize/i.test(content)) {
      SEQUELIZE_DEFINE_REGEX.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = SEQUELIZE_DEFINE_REGEX.exec(content)) !== null) {
        const name = m[1];
        if (seen.has(name)) continue;
        seen.add(name);
        models.push({
          id: makeId(name),
          name,
          type: 'sequelize',
          file: relativePath,
          fields: [],
          relations: [],
        });
      }

      SEQUELIZE_CLASS_REGEX.lastIndex = 0;
      while ((m = SEQUELIZE_CLASS_REGEX.exec(content)) !== null) {
        const name = m[1];
        if (seen.has(name)) continue;
        seen.add(name);
        models.push({
          id: makeId(name),
          name,
          type: 'sequelize',
          file: relativePath,
          fields: [],
          relations: [],
        });
      }
    }

    // ── TypeORM ──
    if (/@Entity/i.test(content)) {
      TYPEORM_ENTITY_REGEX.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = TYPEORM_ENTITY_REGEX.exec(content)) !== null) {
        const name = m[2] || m[1];
        if (seen.has(name)) continue;
        seen.add(name);
        models.push({
          id: makeId(name),
          name,
          type: 'typeorm',
          file: relativePath,
          fields: [],
          relations: [],
        });
      }
    }

    // ── DynamoDB ──
    if (DYNAMO_TRIGGER.test(content)) {
      const dynModels = extractDynamoTables(content, relativePath, seen);
      models.push(...dynModels);
    }
  }

  return models;
}
