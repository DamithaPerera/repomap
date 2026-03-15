'use client';

import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { ProjectAnalysis } from '@/types/analysis';
import { buildGraphElements } from './graphBuilder';
import { ApiNode, SocketNode, DbNode } from './nodeTypes';
import { DetailPanel } from './DetailPanel';
import { Legend } from './Legend';

const nodeTypes = {
  apiNode: ApiNode,
  socketNode: SocketNode,
  dbNode: DbNode,
};

interface Props {
  analysis: ProjectAnalysis;
}

export function RepoGraph({ analysis }: Props) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraphElements(analysis),
    [analysis]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <Controls className="!bg-slate-800 !border-slate-700 !rounded-lg" />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'apiNode') return '#6366f1';
            if (n.type === 'socketNode') return '#14b8a6';
            return '#22c55e';
          }}
          maskColor="rgba(15,23,42,0.7)"
          className="!bg-slate-900 !border-slate-700 !rounded-lg"
        />
      </ReactFlow>

      <DetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
      <Legend />
    </div>
  );
}
