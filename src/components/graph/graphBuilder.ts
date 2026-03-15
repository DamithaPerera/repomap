import { Node, Edge } from 'reactflow';
import { ProjectAnalysis } from '@/types/analysis';

const H_GAP = 320;
const V_GAP = 120;

export function buildGraphElements(analysis: ProjectAnalysis): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const { apis, sockets, models, apiModelEdges } = analysis;

  // ── Column layout ──
  // Col 0: APIs (left)
  // Col 1: Sockets (middle-left, offset down)
  // Col 2: DB Models (right)

  const colX = { api: 0, socket: H_GAP, db: H_GAP * 2.2 };

  // API nodes
  apis.forEach((api, i) => {
    nodes.push({
      id: api.id,
      type: 'apiNode',
      position: { x: colX.api, y: i * V_GAP },
      data: {
        label: `${api.method} ${api.path}`,
        method: api.method,
        path: api.path,
        file: api.file,
        line: api.line,
        description: api.description,
        params: api.params,
        auth: api.auth,
        raw: api,
      },
    });
  });

  // Socket nodes
  sockets.forEach((sock, i) => {
    nodes.push({
      id: sock.id,
      type: 'socketNode',
      position: { x: colX.socket, y: apis.length * V_GAP + 40 + i * V_GAP },
      data: {
        label: sock.event,
        event: sock.event,
        type: sock.type,
        file: sock.file,
        line: sock.line,
        description: sock.description,
        raw: sock,
      },
    });
  });

  // DB Model nodes
  models.forEach((model, i) => {
    nodes.push({
      id: model.id,
      type: 'dbNode',
      position: { x: colX.db, y: i * (V_GAP + 40) },
      data: {
        label: model.name,
        dbType: model.type,
        file: model.file,
        fields: model.fields,
        relations: model.relations,
        raw: model,
      },
    });
  });

  // API → DB edges
  apiModelEdges.forEach((rel, i) => {
    edges.push({
      id: `edge-api-db-${i}`,
      source: rel.apiId,
      target: rel.modelId,
      label: rel.operation,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 1.5 },
      labelStyle: { fontSize: 9, fill: '#a5b4fc' },
      labelBgStyle: { fill: '#1e1b4b', fillOpacity: 0.8 },
    });
  });

  // DB → DB relation edges (from model.relations)
  models.forEach((model) => {
    model.relations.forEach((rel, i) => {
      const target = models.find(
        (m) => m.name.toLowerCase() === rel.targetModel.toLowerCase()
      );
      if (target) {
        edges.push({
          id: `edge-db-db-${model.id}-${i}`,
          source: model.id,
          target: target.id,
          label: rel.relationType,
          type: 'smoothstep',
          style: { stroke: '#22c55e', strokeWidth: 1.5, strokeDasharray: '4 2' },
          labelStyle: { fontSize: 9, fill: '#86efac' },
          labelBgStyle: { fill: '#14532d', fillOpacity: 0.8 },
        });
      }
    });
  });

  return { nodes, edges };
}
