import { ApiEndpoint, DbModel } from '@/types/analysis';
import { FileEntry } from './fileWalker';

interface ApiModelEdge {
  apiId: string;
  modelId: string;
  operation: string;
}

const DB_OPERATIONS = ['find', 'findOne', 'findMany', 'findUnique', 'findFirst', 'create', 'save', 'update', 'updateOne', 'updateMany', 'delete', 'deleteOne', 'deleteMany', 'upsert', 'aggregate', 'count', 'insertOne', 'insertMany'];

function getFileContent(files: FileEntry[], relativePath: string): string {
  return files.find((f) => f.relativePath === relativePath)?.content ?? '';
}

function getLineRange(content: string, lineNum: number, range = 30): string {
  const lines = content.split('\n');
  const start = Math.max(0, lineNum - 1);
  const end = Math.min(lines.length, lineNum + range);
  return lines.slice(start, end).join('\n');
}

export function mapRelationships(
  apis: ApiEndpoint[],
  models: DbModel[],
  files: FileEntry[]
): ApiModelEdge[] {
  const edges: ApiModelEdge[] = [];
  const edgeSeen = new Set<string>();

  for (const api of apis) {
    const content = getFileContent(files, api.file);
    if (!content) continue;

    const snippet = getLineRange(content, api.line, 50);

    for (const model of models) {
      const modelNameLower = model.name.toLowerCase();
      const snippetLower = snippet.toLowerCase();

      // Check if any DB operation is mentioned alongside the model name
      for (const op of DB_OPERATIONS) {
        const patterns = [
          // prisma.user.findMany
          new RegExp(`prisma\\.${modelNameLower}\\.${op}`, 'i'),
          // User.findOne, UserModel.find
          new RegExp(`${model.name}(?:Model|Schema)?\\.${op}`, 'i'),
          // new User(), User.save()
          new RegExp(`new\\s+${model.name}\\s*\\(`, 'i'),
        ];

        if (patterns.some((p) => p.test(snippet))) {
          const key = `${api.id}:${model.id}:${op}`;
          if (!edgeSeen.has(key)) {
            edgeSeen.add(key);
            edges.push({ apiId: api.id, modelId: model.id, operation: op });
            if (!api.dbOperations.includes(model.id)) {
              api.dbOperations.push(model.id);
            }
          }
          break;
        }
      }

      // Also check by model name presence alone in snippet (weaker signal)
      if (
        (snippetLower.includes(modelNameLower) || snippetLower.includes(model.name.toLowerCase())) &&
        !edges.some((e) => e.apiId === api.id && e.modelId === model.id)
      ) {
        const key = `${api.id}:${model.id}:query`;
        if (!edgeSeen.has(key)) {
          edgeSeen.add(key);
          edges.push({ apiId: api.id, modelId: model.id, operation: 'query' });
          if (!api.dbOperations.includes(model.id)) {
            api.dbOperations.push(model.id);
          }
        }
      }
    }
  }

  return edges;
}
