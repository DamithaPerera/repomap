export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ALL' | 'USE';

export interface ApiEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  file: string;
  line: number;
  description: string;
  params: string[];
  dbOperations: string[]; // IDs of DB models it touches
  auth: boolean;
}

export interface SocketEvent {
  id: string;
  event: string;
  type: 'emit' | 'on' | 'broadcast';
  file: string;
  line: number;
  description: string;
}

export interface DbModel {
  id: string;
  name: string;
  type: 'mongoose' | 'prisma' | 'sequelize' | 'typeorm' | 'drizzle' | 'dynamodb' | 'raw' | 'unknown';
  file: string;
  fields: DbField[];
  relations: DbRelation[];
}

export interface DbField {
  name: string;
  fieldType: string;
  required?: boolean;
  unique?: boolean;
}

export interface DbRelation {
  targetModel: string;
  relationType: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany' | 'ref' | 'unknown';
}

export interface ProjectAnalysis {
  repoUrl: string;
  projectName: string;
  summary: string;
  tech: string[];
  apis: ApiEndpoint[];
  sockets: SocketEvent[];
  models: DbModel[];
  // edges: api -> model relationships
  apiModelEdges: { apiId: string; modelId: string; operation: string }[];
}
