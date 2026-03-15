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

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
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
  }

  return models;
}
